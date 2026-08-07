import type { OutboundReplySentiment } from "@prisma/client";
import { claude, CLAUDE_MODELS } from "@/lib/claude";
import { db } from "@/lib/db";
import { sendDM } from "@/lib/discord";
import { logEvent, suppress } from "./shared";

/**
 * Reply handling.
 *
 * The single most important behaviour in the whole system: the instant a human
 * replies, every automated follow-up to that lead stops. A sequence that keeps
 * running after a reply is the thing that makes automated outreach feel like
 * spam, and it is unrecoverable — the prospect has already decided.
 */

export type ClassifiedReply = {
  sentiment: OutboundReplySentiment;
  meetingBooked: boolean;
  /** One-line summary for the notification and the lead timeline. */
  summary: string;
};

export async function classifyReply(body: string): Promise<ClassifiedReply> {
  const trimmed = body.slice(0, 6000);

  // Auto-responders and opt-outs are recognisable without an AI call, and both
  // need handling faster and more reliably than a model can promise.
  const quick = quickClassify(trimmed);
  if (quick) return quick;

  try {
    const res = await claude().messages.create({
      model: CLAUDE_MODELS.fast,
      max_tokens: 300,
      system: CLASSIFIER_SYSTEM,
      messages: [{ role: "user", content: trimmed }],
    });

    const text = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "");

    const parsed = JSON.parse(text) as {
      sentiment?: string;
      meetingBooked?: boolean;
      summary?: string;
    };

    return {
      sentiment: toSentiment(parsed.sentiment),
      meetingBooked: Boolean(parsed.meetingBooked),
      summary: (parsed.summary ?? "").slice(0, 300),
    };
  } catch (e) {
    // A classification failure must never lose the reply. Default to NEUTRAL,
    // which still stops the sequence and still alerts a human.
    console.error("[outbound] reply classification failed", e);
    return { sentiment: "NEUTRAL", meetingBooked: false, summary: "Reply received (unclassified)" };
  }
}

const CLASSIFIER_SYSTEM = `You classify replies to cold sales emails. Return ONLY JSON:
{"sentiment":"POSITIVE|NEUTRAL|NEGATIVE|AUTO_REPLY|UNSUBSCRIBE","meetingBooked":true|false,"summary":"one short sentence"}

POSITIVE — interested, asking questions, wants a call, asks for pricing or more detail.
NEUTRAL — asks who you are, defers to later, forwards to a colleague, ambiguous.
NEGATIVE — not interested, already has a supplier, annoyed, tells you to stop contacting them about this.
AUTO_REPLY — out of office, autoresponder, ticket acknowledgement, delivery notification.
UNSUBSCRIBE — explicitly asks to be removed from the list, or threatens a spam report.

meetingBooked is true only when they have agreed to a specific call or meeting, or sent a booking link/time.`;

function quickClassify(body: string): ClassifiedReply | null {
  const lower = body.toLowerCase();

  if (
    /\b(unsubscribe|remove me|take me off|opt.?out|do not contact|stop emailing|stop contacting)\b/.test(
      lower
    ) ||
    /\bgdpr\b.*\b(erase|delete|remove)\b/.test(lower)
  ) {
    return { sentiment: "UNSUBSCRIBE", meetingBooked: false, summary: "Asked to be removed" };
  }

  if (
    /\b(out of (the )?office|automatic reply|auto.?reply|autoresponder|on annual leave|on holiday until|currently away|maternity leave|do not reply to this)\b/.test(
      lower
    )
  ) {
    return { sentiment: "AUTO_REPLY", meetingBooked: false, summary: "Automatic reply" };
  }

  return null;
}

function toSentiment(v?: string): OutboundReplySentiment {
  switch ((v ?? "").toUpperCase()) {
    case "POSITIVE":
      return "POSITIVE";
    case "NEGATIVE":
      return "NEGATIVE";
    case "AUTO_REPLY":
      return "AUTO_REPLY";
    case "UNSUBSCRIBE":
      return "UNSUBSCRIBE";
    default:
      return "NEUTRAL";
  }
}

/**
 * Apply a reply to a lead: stop the sequence, record the outcome, suppress if
 * required, and tell the owner.
 *
 * An out-of-office is the one reply that does not stop the sequence — the
 * person never saw the email. It is pushed out instead so the follow-up lands
 * after they are back.
 */
export async function applyReply(
  leadId: string,
  body: string,
  opts: { emailId?: string | null; receivedAt?: Date } = {}
): Promise<ClassifiedReply> {
  const lead = await db.outboundLead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      userId: true,
      company: true,
      email: true,
      domain: true,
      repliedAt: true,
    },
  });
  if (!lead) throw new Error("lead not found");

  const classification = await classifyReply(body);
  const at = opts.receivedAt ?? new Date();

  if (classification.sentiment === "AUTO_REPLY") {
    await db.outboundLead.update({
      where: { id: leadId },
      data: { nextActionAt: new Date(Date.now() + 7 * 86_400_000) },
    });
    await logEvent(leadId, "auto_reply", classification.summary, undefined, opts.emailId);
    return classification;
  }

  await db.outboundLead.update({
    where: { id: leadId },
    data: {
      stage: classification.sentiment === "UNSUBSCRIBE" ? "UNSUBSCRIBED" : "REPLIED",
      repliedAt: lead.repliedAt ?? at,
      replySentiment: classification.sentiment,
      meetingBooked: classification.meetingBooked,
      // The sequence is over either way.
      nextActionAt: null,
    },
  });

  // Kill anything still waiting to go out to this lead.
  await db.outboundEmail.updateMany({
    where: { leadId, status: { in: ["DRAFT", "QUEUED"] } },
    data: { status: "SKIPPED", failReason: "lead replied" },
  });

  if (opts.emailId) {
    await db.outboundEmail.update({
      where: { id: opts.emailId },
      data: { status: "REPLIED", repliedAt: at },
    });
  }

  if (classification.sentiment === "UNSUBSCRIBE" || classification.sentiment === "NEGATIVE") {
    if (lead.email) {
      await suppress(
        lead.userId,
        lead.email,
        "email",
        classification.sentiment === "UNSUBSCRIBE" ? "unsubscribed" : "not interested"
      );
    }
    // An explicit opt-out covers the company, not just the individual.
    if (classification.sentiment === "UNSUBSCRIBE" && lead.domain) {
      await suppress(lead.userId, lead.domain, "domain", "unsubscribed");
    }
  }

  await logEvent(
    leadId,
    "replied",
    `${classification.sentiment}: ${classification.summary}`,
    { sentiment: classification.sentiment, meetingBooked: classification.meetingBooked },
    opts.emailId
  );

  // Positive replies are the only thing in this system a human must see now.
  if (classification.sentiment === "POSITIVE" || classification.meetingBooked) {
    await notifyOwner(
      lead.userId,
      classification.meetingBooked
        ? `Meeting booked — ${lead.company}`
        : `Positive reply — ${lead.company}`,
      classification.summary,
      `/dashboard/outbound/${leadId}`
    );
  }

  return classification;
}

/**
 * In-app notification plus a Discord DM. Both are best-effort — a reply is
 * already safely recorded on the lead by the time this runs, and failing to
 * deliver an alert must not roll that back.
 */
async function notifyOwner(
  userId: string,
  title: string,
  body: string,
  link: string
): Promise<void> {
  try {
    await db.notification.create({
      data: { userId, type: "outbound_reply", title, body, link },
    });
  } catch (e) {
    console.error("[outbound] failed to write reply notification", e);
  }

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { discordId: true },
    });
    if (user?.discordId) {
      await sendDM(
        user.discordId,
        [`**${title}**`, "", body, "", `https://fortify-io.com${link}`].join("\n")
      );
    }
  } catch (e) {
    console.error("[outbound] failed to DM owner about reply", e);
  }
}
