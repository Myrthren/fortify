import { db } from "@/lib/db";
import { getInboxProvider } from "@/lib/outbound/registry";
import type { InboundMessage } from "@/lib/outbound/types";
import { applyReply } from "./reply";
import { logEvent, suppress } from "./shared";

/**
 * Pull replies out of the sending mailbox and apply them to leads.
 *
 * This is what makes "a reply stops the sequence" true on an SMTP mailbox,
 * which has no webhook. It runs on the same cron as the engine tick.
 *
 * The matching is deliberately conservative. A false positive here attaches a
 * stranger's email to a lead and stops a live sequence; a false negative just
 * means a reply is handled by hand. So an unmatched message is left alone
 * rather than guessed at.
 */

const MAX_PER_RUN = 40;

export type InboxPollResult = {
  polled: boolean;
  fetched: number;
  replies: number;
  bounces: number;
  unmatched: number;
  reason?: string;
};

export async function pollInbox(): Promise<InboxPollResult> {
  const empty: InboxPollResult = {
    polled: false,
    fetched: 0,
    replies: 0,
    bounces: 0,
    unmatched: 0,
  };

  let provider;
  try {
    provider = getInboxProvider();
  } catch (e) {
    return { ...empty, reason: e instanceof Error ? e.message : String(e) };
  }

  const { host, username, mailbox } = provider.identity();
  const state = await db.outboundInbox.upsert({
    where: { host_username_mailbox: { host, username, mailbox } },
    create: { host, username, mailbox },
    update: {},
  });

  let fetch;
  try {
    fetch = await provider.fetchSince(
      { uidValidity: state.uidValidity, lastUid: state.lastUid },
      MAX_PER_RUN
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.outboundInbox.update({
      where: { id: state.id },
      data: { lastError: msg.slice(0, 500), lastPolledAt: new Date() },
    });
    return { ...empty, reason: msg };
  }

  const result: InboxPollResult = { ...empty, polled: true, fetched: fetch.messages.length };

  for (const message of fetch.messages) {
    try {
      const outcome = await handleMessage(message);
      if (outcome === "reply") result.replies++;
      else if (outcome === "bounce") result.bounces++;
      else result.unmatched++;
    } catch (e) {
      console.error("[outbound/inbox] failed to handle message", message.uid, e);
      result.unmatched++;
    }
  }

  // The cursor advances even for messages that did not match, otherwise every
  // unrelated email in the mailbox would be re-examined on every single run.
  await db.outboundInbox.update({
    where: { id: state.id },
    data: {
      uidValidity: fetch.cursor.uidValidity,
      lastUid: fetch.cursor.lastUid,
      lastPolledAt: new Date(),
      lastError: null,
    },
  });

  return result;
}

async function handleMessage(
  message: InboundMessage
): Promise<"reply" | "bounce" | "unmatched"> {
  if (message.isBounce) return handleBounce(message);

  const match = await matchLead(message);
  if (!match) return "unmatched";

  // Already closed out — a later message in the same thread must not reopen it
  // or re-fire the notification.
  const lead = await db.outboundLead.findUnique({
    where: { id: match.leadId },
    select: { repliedAt: true, stage: true },
  });
  if (lead?.repliedAt) return "reply";

  const body = message.text.trim();
  if (!body) return "unmatched";

  await applyReply(match.leadId, body, {
    emailId: match.emailId,
    receivedAt: message.receivedAt,
  });

  return "reply";
}

async function handleBounce(message: InboundMessage): Promise<"bounce" | "unmatched"> {
  // Prefer the address the DSN names; fall back to threading headers, since
  // some servers return the original message without a machine-readable part.
  let leadId: string | null = null;
  let emailId: string | null = null;

  if (message.bouncedRecipient) {
    const lead = await db.outboundLead.findFirst({
      where: { email: message.bouncedRecipient, emailsSent: { gt: 0 } },
      orderBy: { lastSentAt: "desc" },
      select: { id: true },
    });
    leadId = lead?.id ?? null;
  }

  if (!leadId) {
    const match = await matchByThread(message);
    leadId = match?.leadId ?? null;
    emailId = match?.emailId ?? null;
  }

  if (!leadId) return "unmatched";

  const lead = await db.outboundLead.findUnique({
    where: { id: leadId },
    select: { id: true, userId: true, email: true, domain: true },
  });
  if (!lead) return "unmatched";

  if (emailId) {
    await db.outboundEmail.update({
      where: { id: emailId },
      data: {
        status: "BOUNCED",
        bouncedAt: message.receivedAt,
        failReason: message.subject.slice(0, 500),
      },
    });
  }

  if (message.isHardBounce) {
    await db.outboundLead.update({
      where: { id: leadId },
      data: { stage: "BOUNCED", nextActionAt: null },
    });
    await db.outboundEmail.updateMany({
      where: { leadId, status: { in: ["DRAFT", "QUEUED"] } },
      data: { status: "SKIPPED", failReason: "address bounced" },
    });
    if (lead.email) await suppress(lead.userId, lead.email, "email", "bounced");
  }

  await logEvent(
    leadId,
    "bounced",
    `${message.isHardBounce ? "Hard" : "Soft"} bounce via mailbox: ${message.subject}`,
    { uid: message.uid },
    emailId
  );

  return "bounce";
}

/**
 * Find the lead a message belongs to. Threading headers first — they are the
 * only genuinely reliable signal — then the sender address.
 */
async function matchLead(
  message: InboundMessage
): Promise<{ leadId: string; emailId: string | null } | null> {
  const threaded = await matchByThread(message);
  if (threaded) return threaded;

  if (!message.from) return null;

  // Address fallback. Restricted to leads we have actually emailed and have not
  // already closed, so an unrelated message from a shared domain cannot latch
  // onto a lead that was never contacted.
  const lead = await db.outboundLead.findFirst({
    where: {
      email: message.from,
      emailsSent: { gt: 0 },
      repliedAt: null,
      stage: { in: ["SENT", "QUEUED"] },
    },
    orderBy: { lastSentAt: "desc" },
    select: {
      id: true,
      emails: {
        where: { status: { in: ["SENT", "DELIVERED", "OPENED"] } },
        orderBy: { sentAt: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });
  if (!lead) return null;

  return { leadId: lead.id, emailId: lead.emails[0]?.id ?? null };
}

async function matchByThread(
  message: InboundMessage
): Promise<{ leadId: string; emailId: string | null } | null> {
  if (!message.inReplyTo.length) return null;

  const email = await db.outboundEmail.findFirst({
    where: { messageId: { in: message.inReplyTo } },
    select: { id: true, leadId: true },
  });
  if (!email) return null;

  return { leadId: email.leadId, emailId: email.id };
}
