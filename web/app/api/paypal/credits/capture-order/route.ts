import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getPayPalAccessToken } from "@/lib/paypal";
import { getPackById } from "@/lib/credit-packs";
import { sendDM } from "@/lib/discord";

const PAYPAL_BASE =
  process.env.PAYPAL_ENV === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const { orderId } = (await req.json()) as { orderId?: string };
  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  const token = await getPayPalAccessToken();

  // Capture the order
  const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!captureRes.ok) {
    const err = await captureRes.text();
    console.error("[credits/capture-order] PayPal capture error:", err);
    return NextResponse.json({ error: "Capture failed" }, { status: 502 });
  }

  const captured = await captureRes.json();

  if (captured.status !== "COMPLETED") {
    return NextResponse.json({ error: `Order not completed: ${captured.status}` }, { status: 400 });
  }

  // Read the pack from custom_id stored on the order
  const customId: string =
    captured.purchase_units?.[0]?.custom_id ?? "";
  const pack = getPackById(customId);
  if (!pack) {
    console.error("[credits/capture-order] Unknown custom_id:", customId);
    return NextResponse.json({ error: "Unknown pack in order" }, { status: 400 });
  }

  // Idempotency — check if this order was already processed
  const existing = await db.creditTransaction.findFirst({
    where: { orderId },
  });
  if (existing) {
    const user = await db.user.findUnique({ where: { id: userId }, select: { credits: true } });
    return NextResponse.json({ ok: true, credits: user?.credits ?? 0, alreadyProcessed: true });
  }

  // Add credits + log transaction atomically
  const updated = await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { credits: { increment: pack.credits } },
    }),
    db.creditTransaction.create({
      data: {
        userId,
        amount: pack.credits,
        source: pack.id,
        orderId,
      },
    }),
  ]);

  const newBalance = updated[0].credits;

  // DM the user
  const user = await db.user.findUnique({ where: { id: userId }, select: { discordId: true, name: true } });
  if (user?.discordId) {
    await sendDM(
      user.discordId,
      `You just topped up **${pack.credits.toLocaleString()} credits** for £${pack.price}. New balance: **${newBalance.toLocaleString()} credits**. Dashboard: https://fortify-io.com/dashboard/credits`
    ).catch(() => {});
  }

  return NextResponse.json({ ok: true, credits: newBalance });
}
