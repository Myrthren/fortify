import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/paypal";
import { syncTierRole, sendDM } from "@/lib/discord";
import { sendDMConditional, alertOwner } from "@/lib/notifications";
import { runWorkflow } from "@/lib/workflow-runner";

/** Fire all active workflows that have a trigger_new_member node (fire-and-forget) */
async function fireMemberWorkflows(userId: string, tier: string, name: string, email: string) {
  try {
    const workflows = await db.workflow.findMany({
      where: { userId, active: true },
      select: { id: true, nodes: true },
    });
    for (const wf of workflows) {
      const raw = wf.nodes as any;
      const nodes: any[] = Array.isArray(raw?.nodes) ? raw.nodes : Array.isArray(raw) ? raw : [];
      const hasTrigger = nodes.some((n: any) => n.type === "trigger_new_member");
      const tierFilter = nodes.find((n: any) => n.type === "trigger_new_member")?.config?.tier;
      if (!hasTrigger) continue;
      if (tierFilter && tierFilter !== "" && tierFilter !== tier) continue;
      runWorkflow(wf.id, userId, { memberName: name, memberEmail: email, memberTier: tier }).catch(() => {});
    }
  } catch { /* ignore — don't block the webhook response */ }
}

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
          data: { status: "ACTIVE", cancelledAt: null, paymentFailedAt: null, paymentRescueStep: 0 },
        });
        if (sub.user.discordId) await syncTierRole(sub.user.discordId, sub.tier);
        await alertOwner(
          "dmOwnerNewSub",
          `New subscriber: **${sub.user.name ?? sub.user.email ?? "unknown"}** — ${sub.tier} tier`
        );
        // Fire trigger_new_member workflows (fire-and-forget)
        fireMemberWorkflows(
          sub.userId,
          sub.tier,
          sub.user.name ?? "",
          sub.user.email ?? "",
        );
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
        await alertOwner(
          "dmOwnerChurn",
          `Churn: **${sub.user.name ?? sub.user.email ?? "unknown"}** — ${sub.tier} tier — ${status.toLowerCase()}`
        );
      }
      break;
    }

    case "BILLING.SUBSCRIPTION.PAYMENT.FAILED": {
      const sub = await db.subscription.findUnique({
        where: { paypalSubId: subId },
        include: { user: true },
      });
      if (sub) {
        // Record failure time for rescue sequence cron (only if not already in rescue)
        if (!sub.paymentFailedAt) {
          await db.subscription.update({
            where: { paypalSubId: subId },
            data: { paymentFailedAt: new Date(), paymentRescueStep: 0 },
          });
        }
        if (sub.user.discordId) {
          await sendDMConditional(
            sub.user.discordId,
            sub.userId,
            "dmPaymentFailed",
            `Your Fortify payment failed. Update your billing to keep your access: https://fortify-io.com/pricing\n\nIf this keeps failing we'll follow up with next steps.`
          );
        }
      }
      break;
    }

    case "PAYMENT.SALE.COMPLETED":
      // TODO: log revenue
      break;
  }

  return NextResponse.json({ ok: true });
}
