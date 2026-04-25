import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/paypal";
import { syncTierRole } from "@/lib/discord";

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
        await db.$transaction([
          db.subscription.update({
            where: { paypalSubId: subId },
            data: {
              status: type.split(".").pop()!, // CANCELLED / SUSPENDED / EXPIRED
              cancelledAt: new Date(),
            },
          }),
          db.user.update({ where: { id: sub.userId }, data: { tier: "FREE" } }),
        ]);
        if (sub.user.discordId) await syncTierRole(sub.user.discordId, "FREE");
      }
      break;
    }

    case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
      // TODO: dunning email via Resend
      break;

    case "PAYMENT.SALE.COMPLETED":
      // TODO: log revenue, send receipt
      break;
  }

  return NextResponse.json({ ok: true });
}
