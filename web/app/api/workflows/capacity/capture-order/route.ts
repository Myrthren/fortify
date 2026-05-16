import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getPayPalAccessToken } from "@/lib/paypal";
import { getCapPackById } from "@/lib/workflow-capacity";
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

  // Capture
  const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });

  if (!captureRes.ok) {
    const err = await captureRes.text();
    console.error("[workflows/capacity/capture-order] PayPal error:", err);
    return NextResponse.json({ error: "Capture failed" }, { status: 502 });
  }

  const captured = await captureRes.json();
  if (captured.status !== "COMPLETED") {
    return NextResponse.json({ error: `Order not completed: ${captured.status}` }, { status: 400 });
  }

  const customId: string = captured.purchase_units?.[0]?.custom_id ?? "";
  const pack = getCapPackById(customId);
  if (!pack) {
    console.error("[workflows/capacity/capture-order] Unknown custom_id:", customId);
    return NextResponse.json({ error: "Unknown pack in order" }, { status: 400 });
  }

  // Idempotency
  const existing = await db.workflowCapacityPack.findFirst({ where: { orderId } });
  if (existing) return NextResponse.json({ ok: true, units: pack.units, alreadyProcessed: true });

  // Record the purchase
  await db.workflowCapacityPack.create({
    data: { userId, units: pack.units, pricePounds: parseFloat(pack.price), orderId },
  });

  // DM
  const user = await db.user.findUnique({ where: { id: userId }, select: { discordId: true } });
  if (user?.discordId) {
    await sendDM(
      user.discordId,
      `✅ You purchased **${pack.label}** of workflow capacity for £${pack.price}. Dashboard: https://fortify-io.com/dashboard/workflows`
    ).catch(() => {});
  }

  return NextResponse.json({ ok: true, units: pack.units });
}
