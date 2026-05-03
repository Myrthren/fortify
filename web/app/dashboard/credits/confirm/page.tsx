import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getPayPalAccessToken } from "@/lib/paypal";
import { getPackById } from "@/lib/credit-packs";
import { sendDM } from "@/lib/discord";

const PAYPAL_BASE =
  process.env.PAYPAL_ENV === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

export default async function CreditsConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const orderId = params.token;
  if (!orderId) redirect("/dashboard/credits?cancelled=1");

  const userId = (session.user as any).id as string;

  try {
    // Idempotency check — already processed?
    const existing = await db.creditTransaction.findFirst({ where: { orderId } });
    if (existing) redirect("/dashboard/credits?success=1");

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
      console.error("[credits/confirm] capture failed:", captureRes.status, await captureRes.text());
      redirect("/dashboard/credits?error=1");
    }

    const captured = await captureRes.json();
    if (captured.status !== "COMPLETED") redirect("/dashboard/credits?error=1");

    const customId: string = captured.purchase_units?.[0]?.custom_id ?? "";
    const pack = getPackById(customId);
    if (!pack) redirect("/dashboard/credits?error=1");

    // Add credits
    const [updated] = await db.$transaction([
      db.user.update({
        where: { id: userId },
        data: { credits: { increment: pack.credits } },
      }),
      db.creditTransaction.create({
        data: { userId, amount: pack.credits, source: pack.id, orderId },
      }),
    ]);

    // Discord DM receipt
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { discordId: true },
    });
    if (user?.discordId) {
      await sendDM(
        user.discordId,
        `You just topped up **${pack.credits.toLocaleString()} credits** for £${pack.price}. New balance: **${updated.credits.toLocaleString()} credits**. Dashboard: https://fortify-io.com/dashboard/credits`
      ).catch(() => {});
    }
  } catch (e: any) {
    // If it's a Next.js redirect, rethrow it
    if (e?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    console.error("[credits/confirm] error:", e);
    redirect("/dashboard/credits?error=1");
  }

  redirect("/dashboard/credits?success=1");
}
