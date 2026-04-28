import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/paypal";
import { syncTierRole, sendDM } from "@/lib/discord";
import { sendDMConditional } from "@/lib/notifications";

export async function POST(req: Request) {
  const raw = await req.text();
  const event = JSON.parse(raw);

  const ok = await verifyWebhookSignature(req.headers, event);
  if (!ok) return new NextResponse("Invalid signature", { status: 401 });

  const type = event.event_type as string;
  const subId: string | undefined = event.resource?.id ?? event.resource?.billing_agreement_id;
  if (!subId) return NextResponse.json({ ok: true });

  switch (type) {
    case "BILLING.SUBSCRIPTION.ACTIVATED": {
      const sub = await db.subscription.findUnique({
        where: { paypalSubId: subId },
        include: { user: true },
      });
      if (sub) {
        await db.subscription.update({
          where: { paypalSubId: subId },
          data: { status: "ACTIVE", cancelledAt: null },
        });
        if (sub.user.discordId) await syncTierRole(sub.user.discordId, sub.tier);
      }
      break;
    }

    case "BILLING.SUBSCRIPTION.CANCELLED":
    case "BILLING.SUBSCRIPTION.SUSPENDED":
    case "BILLING.SUBSCRIPTION.EXPIRED": {
      const sub = await db.subscription.findUnique({
        where: { paypalSubId: subId },
        include: { user: true },
      });
      if (sub) {
        const status = type.split(".").pop()!; // CANCELLED / SUSPENDED / EXPIRED
        await db.$transaction([
          db.subscription.update({
            where: { paypalSubId: subId },
            data: { status, cancelledAt: new Date() },
          }),
          db.user.update({ where: { id: sub.userId }, data: { tier: "FREE" } }),
        ]);
        if (sub.user.discordId) {
          await syncTierRole(sub.user.discordId, "FREE");
          await sendDM(
            sub.user.discordId,
            `Your Fortify subscription has been ${status.toLowerCase()}. You've been moved to the Free tier. Resubscribe any time at https://fortify-io.com/pricing`
          );
        }
      }
      break;
    }

    case "BILLING.SUBSCRIPTION.PAYMENT.FAILED": {
      const sub = await db.subscription.findUnique({
        where: { paypalSubId: subId },
        include: { user: true },
      });
      if (sub?.user.discordId) {
        await sendDMConditional(
          sub.user.discordId,
          sub.userId,
          "dmPaymentFailed",
          `Your Fortify payment failed. Update your billing to keep your access: https://fortify-io.com/pricing`
        );
      }
      break;
    }

    case "PAYMENT.SALE.COMPLETED":
      // TODO: log revenue
      break;
  }

  return NextResponse.json({ ok: true });
}
