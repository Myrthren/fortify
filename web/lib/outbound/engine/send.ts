import type { OutboundCampaign, OutboundEmail, OutboundLead } from "@prisma/client";
import { db } from "@/lib/db";
import { getSendProvider } from "@/lib/outbound/registry";
import { isSendableEmail, isSuppressed, logEvent } from "./shared";

/**
 * Sending policy and delivery.
 *
 * Everything here exists to make the output look like a person sending mail,
 * not a system emptying a queue: office-hours only, a daily ceiling, jittered
 * gaps between messages, and a hard stop the moment a lead becomes untouchable.
 */

export type SendWindow = {
  open: boolean;
  reason?: string;
};

export function isWithinSendWindow(
  campaign: OutboundCampaign,
  now = new Date()
): SendWindow {
  const day = now.getUTCDay(); // 0 = Sunday
  if (!campaign.sendOnWeekends && (day === 0 || day === 6)) {
    return { open: false, reason: "weekend" };
  }

  const hour = now.getUTCHours();
  const start = campaign.sendWindowStartUtc;
  const end = campaign.sendWindowEndUtc;

  // A window that wraps midnight (e.g. 22 -> 6) is legitimate for other
  // timezones, so handle it rather than assuming start < end.
  const inWindow = start <= end ? hour >= start && hour < end : hour >= start || hour < end;

  return inWindow
    ? { open: true }
    : { open: false, reason: `outside send window ${start}:00-${end}:00 UTC` };
}

export async function sentToday(campaignId: string, now = new Date()): Promise<number> {
  const startOfDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  return db.outboundEmail.count({
    where: {
      campaignId,
      sentAt: { gte: startOfDay },
      status: { in: ["SENT", "DELIVERED", "OPENED", "REPLIED", "BOUNCED"] },
    },
  });
}

/**
 * How long to wait before the next send. Spreads the remaining daily allowance
 * across the remaining window rather than firing the whole batch at 08:00, then
 * jitters it so the gaps are not machine-regular.
 */
export function nextSendDelayMs(
  campaign: OutboundCampaign,
  alreadySentToday: number,
  now = new Date()
): number {
  if (campaign.minHoursBetweenSends > 0) {
    return jitter(campaign.minHoursBetweenSends * 3600_000);
  }

  const remaining = Math.max(1, campaign.dailySendCap - alreadySentToday);
  const end = campaign.sendWindowEndUtc;
  const hour = now.getUTCHours();
  const hoursLeft =
    campaign.sendWindowStartUtc <= end
      ? Math.max(0.25, end - hour - now.getUTCMinutes() / 60)
      : 1;

  const evenGapMs = (hoursLeft * 3600_000) / remaining;
  // Floor at 4 minutes: anything tighter reads as a blast to the receiving MTA.
  return jitter(Math.max(4 * 60_000, evenGapMs));
}

/** ±35%, so gaps never form a visible pattern. */
function jitter(ms: number): number {
  return Math.round(ms * (0.65 + Math.random() * 0.7));
}

export type SendOutcome =
  | { sent: true; emailId: string }
  | { sent: false; reason: string };

/**
 * Send one queued email. Marks SENDING before the network call so a crash
 * mid-send cannot double-send — a stuck SENDING row is visible and recoverable,
 * a duplicate delivery is not.
 */
export async function sendEmail(
  email: OutboundEmail,
  lead: OutboundLead,
  campaign: OutboundCampaign
): Promise<SendOutcome> {
  if (!isSendableEmail(lead.email)) {
    await markFailed(email.id, lead.id, "lead has no usable email address");
    return { sent: false, reason: "no usable email" };
  }

  if (await isSuppressed(lead.userId, lead.email, lead.domain)) {
    await db.outboundEmail.update({
      where: { id: email.id },
      data: { status: "SKIPPED", failReason: "on do-not-contact list" },
    });
    await db.outboundLead.update({
      where: { id: lead.id },
      data: { stage: "UNSUBSCRIBED", nextActionAt: null },
    });
    return { sent: false, reason: "suppressed" };
  }

  const from = campaign.senderEmail ?? process.env.OUTBOUND_FROM_EMAIL;
  if (!from) {
    await markFailed(email.id, lead.id, "campaign has no sender address");
    return { sent: false, reason: "no sender address" };
  }

  // Claim the row. If another tick got there first, stand down.
  const claimed = await db.outboundEmail.updateMany({
    where: { id: email.id, status: { in: ["QUEUED", "DRAFT"] } },
    data: { status: "SENDING" },
  });
  if (claimed.count === 0) return { sent: false, reason: "already claimed" };

  const provider = getSendProvider(campaign.sendProvider);

  // Follow-ups thread under the original so they land in the same conversation.
  const thread =
    email.step > 0
      ? await db.outboundEmail.findFirst({
          where: { leadId: lead.id, step: 0, messageId: { not: null } },
          select: { messageId: true },
        })
      : null;

  try {
    const result = await provider.send({
      to: lead.email!,
      toName: lead.contactName,
      from,
      fromName: campaign.senderName,
      replyTo: campaign.senderEmail ?? from,
      subject: email.subject,
      text: email.body,
      inReplyTo: thread?.messageId ?? null,
      references: thread?.messageId ? [thread.messageId] : undefined,
      headers: {
        // Lets a recipient's client offer one-click unsubscribe, and gives us a
        // token to match the opt-out back to this lead.
        "List-Unsubscribe": `<${unsubscribeUrl(lead.id)}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        "X-Fortify-Lead": lead.id,
      },
    });

    const now = new Date();
    await db.$transaction([
      db.outboundEmail.update({
        where: { id: email.id },
        data: {
          status: "SENT",
          sentAt: now,
          providerId: result.providerId,
          messageId: result.messageId,
          fromEmail: from,
          toEmail: lead.email,
        },
      }),
      db.outboundLead.update({
        where: { id: lead.id },
        data: {
          stage: "SENT",
          emailsSent: { increment: 1 },
          followUpStep: email.step,
          lastSentAt: now,
          nextActionAt: followUpDueAt(campaign, email.step, now),
          lastError: null,
        },
      }),
    ]);

    await logEvent(lead.id, "sent", `Sent "${email.subject}"`, { step: email.step }, email.id);
    return { sent: true, emailId: email.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await markFailed(email.id, lead.id, msg);
    return { sent: false, reason: msg };
  }
}

/**
 * When the next follow-up in the sequence is due. Returns null once the
 * sequence is exhausted, which is what takes the lead out of the working set.
 */
export function followUpDueAt(
  campaign: OutboundCampaign,
  justSentStep: number,
  from = new Date()
): Date | null {
  const nextStep = justSentStep + 1;
  if (nextStep > campaign.maxFollowUps) return null;

  const delays = Array.isArray(campaign.followUpDelaysDays)
    ? (campaign.followUpDelaysDays as unknown[]).map(Number).filter((n) => Number.isFinite(n) && n > 0)
    : [];
  const days = delays[nextStep - 1] ?? delays[delays.length - 1] ?? 7;

  // Jitter the day too — follow-ups landing exactly 72 hours apart is a tell.
  const ms = days * 86_400_000 * (0.9 + Math.random() * 0.25);
  return new Date(from.getTime() + ms);
}

export function unsubscribeUrl(leadId: string): string {
  const base = process.env.NEXTJS_URL ?? "https://fortify-io.com";
  return `${base}/api/outbound/unsubscribe?lead=${leadId}`;
}

async function markFailed(emailId: string, leadId: string, reason: string) {
  await db.outboundEmail.update({
    where: { id: emailId },
    data: { status: "FAILED", failReason: reason.slice(0, 500) },
  });
  await logEvent(leadId, "error", `Send failed: ${reason}`, undefined, emailId);
}
