import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import type {
  InboxCursor,
  InboxFetch,
  InboxProvider,
  InboundMessage,
} from "@/lib/outbound/types";

/**
 * IMAP reader for the sending mailbox.
 *
 * Strictly read-only. It never marks a message seen, moves it, or deletes it —
 * this is the owner's real inbox, and a background job that silently changes
 * what looks unread in it is worse than no automation at all. Progress is
 * tracked with a UID cursor instead of message flags.
 */
export const imapInbox: InboxProvider = {
  key: "imap",
  label: "IMAP (sending mailbox)",

  isAvailable() {
    return Boolean(host() && username() && password());
  },

  identity() {
    return { host: host() ?? "", username: username() ?? "", mailbox: mailbox() };
  },

  async fetchSince(cursor: InboxCursor, limit: number): Promise<InboxFetch> {
    const client = new ImapFlow({
      host: host()!,
      port: Number(process.env.OUTBOUND_IMAP_PORT ?? 993),
      secure: process.env.OUTBOUND_IMAP_SECURE !== "false",
      auth: { user: username()!, pass: password()! },
      logger: false,
      // Never let a hung mailbox eat the whole cron budget.
      socketTimeout: 30_000,
      greetingTimeout: 15_000,
    });

    await client.connect();
    try {
      // readOnly opens the mailbox with EXAMINE rather than SELECT, so the
      // server itself will not clear \Recent or set \Seen on fetch.
      const lock = await client.getMailboxLock(mailbox(), { readOnly: true });
      try {
        const box = client.mailbox;
        if (!box || typeof box === "boolean") throw new Error("mailbox did not open");

        const uidValidity = String(box.uidValidity);

        // A uidValidity change means the server renumbered everything; the old
        // cursor is meaningless. Restart from the current end rather than
        // reprocessing the entire mailbox and re-alerting on old replies.
        const validityChanged = cursor.uidValidity !== null && cursor.uidValidity !== uidValidity;
        const startUid = validityChanged ? Math.max(0, box.uidNext - 1) : cursor.lastUid;

        // First ever run: start from now. Everything already in the mailbox
        // predates the system and must not be replayed as fresh replies.
        if (cursor.uidValidity === null || validityChanged) {
          return {
            messages: [],
            cursor: { uidValidity, lastUid: Math.max(startUid, box.uidNext - 1) },
          };
        }

        const messages: InboundMessage[] = [];
        let highestUid = cursor.lastUid;

        for await (const msg of client.fetch(
          { uid: `${cursor.lastUid + 1}:*` },
          { uid: true, source: true, envelope: true, internalDate: true },
          { uid: true }
        )) {
          // The `n:*` range always returns at least one message even when
          // nothing is newer, so old UIDs have to be filtered out here.
          if (msg.uid <= cursor.lastUid) continue;
          if (msg.uid > highestUid) highestUid = msg.uid;

          if (messages.length >= limit) continue;

          try {
            const parsed = await simpleParser(msg.source as Buffer);
            messages.push(toInbound(msg.uid, parsed, asDate(msg.internalDate)));
          } catch (e) {
            console.error("[outbound/imap] could not parse message", msg.uid, e);
          }
        }

        return { messages, cursor: { uidValidity, lastUid: highestUid } };
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => client.close());
    }
  },
};

function host(): string | undefined {
  const explicit = process.env.OUTBOUND_IMAP_HOST;
  if (explicit) return explicit;
  // Most providers mirror smtp.x -> imap.x, IONOS included. Guessing beats
  // failing outright, and an explicit var overrides it.
  const smtp = process.env.OUTBOUND_SMTP_HOST ?? process.env.SMTP_HOST;
  return smtp?.replace(/^smtp\./i, "imap.");
}

function username(): string | undefined {
  return (
    process.env.OUTBOUND_IMAP_USER ??
    process.env.OUTBOUND_SMTP_USER ??
    process.env.SMTP_USER
  );
}

function password(): string | undefined {
  return (
    process.env.OUTBOUND_IMAP_PASS ??
    process.env.OUTBOUND_SMTP_PASS ??
    process.env.SMTP_PASS
  );
}

function mailbox(): string {
  return process.env.OUTBOUND_IMAP_MAILBOX ?? "INBOX";
}

/** imapflow types internalDate loosely; servers return either form. */
function asDate(v: string | Date | undefined): Date | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toInbound(uid: number, mail: ParsedMail, internalDate?: Date): InboundMessage {
  const from = mail.from?.value?.[0];
  const bounce = detectBounce(mail);

  return {
    uid,
    messageId: mail.messageId ?? null,
    inReplyTo: collectReferences(mail),
    from: from?.address?.toLowerCase() ?? null,
    fromName: from?.name || null,
    to: toAddresses(mail),
    subject: mail.subject ?? "",
    text: stripQuoted(mail.text ?? textFromHtml(mail.html)),
    receivedAt: mail.date ?? internalDate ?? new Date(),
    isBounce: bounce.isBounce,
    bouncedRecipient: bounce.recipient,
    isHardBounce: bounce.hard,
  };
}

function toAddresses(mail: ParsedMail): string[] {
  const to = mail.to;
  if (!to) return [];
  const list = Array.isArray(to) ? to : [to];
  return list.flatMap((t) => t.value.map((v) => v.address?.toLowerCase() ?? "")).filter(Boolean);
}

/**
 * In-Reply-To first, then References newest-last. Threading clients are
 * inconsistent about which they set, so both are collected and the matcher
 * tries them in order.
 */
function collectReferences(mail: ParsedMail): string[] {
  const out: string[] = [];
  if (mail.inReplyTo) {
    out.push(...(mail.inReplyTo.match(/<[^>]+>/g) ?? [mail.inReplyTo]));
  }
  const refs = mail.references;
  if (refs) {
    const list = Array.isArray(refs) ? refs : [refs];
    for (const r of list) out.push(...(r.match(/<[^>]+>/g) ?? [r]));
  }
  return [...new Set(out.map((s) => s.trim()).filter(Boolean))].reverse();
}

// ─── Bounce detection ─────────────────────────────────────

const DSN_SENDERS = /(mailer-daemon|postmaster|no-?reply@.*(mail|smtp)|mail delivery (subsystem|system))/i;
const DSN_SUBJECTS =
  /(undelivered mail returned to sender|delivery status notification|returned mail|mail delivery failed|undeliverable|delivery has failed)/i;

/** 5.x.x is permanent; 4.x.x is a transient defer and must not disqualify. */
const HARD_STATUS = /\bstatus:\s*5\.\d+\.\d+/i;
const SOFT_STATUS = /\bstatus:\s*4\.\d+\.\d+/i;

function detectBounce(mail: ParsedMail): {
  isBounce: boolean;
  recipient: string | null;
  hard: boolean;
} {
  const fromAddr = mail.from?.value?.[0]?.address ?? "";
  const subject = mail.subject ?? "";
  const contentType = (mail.headers.get("content-type") as { value?: string } | undefined)?.value ?? "";

  const isBounce =
    contentType.includes("report") ||
    DSN_SENDERS.test(fromAddr) ||
    DSN_SENDERS.test(mail.from?.text ?? "") ||
    DSN_SUBJECTS.test(subject);

  if (!isBounce) return { isBounce: false, recipient: null, hard: false };

  // The delivery-status part usually lands in `text`, but depending on how the
  // server structures the report mailparser can surface it as an attachment
  // instead. Miss it and a permanent failure reads as transient — meaning we
  // keep mailing a dead address, which is the fastest way to lose the domain.
  const reportParts = mail.attachments
    .filter((a) => /delivery-status|rfc822|report/i.test(a.contentType ?? ""))
    .map((a) => a.content?.toString("utf8") ?? "")
    .join("\n");

  const body = `${mail.text ?? ""}\n${textFromHtml(mail.html)}\n${reportParts}`;

  // RFC 3464 delivery-status parts carry the failed address explicitly; fall
  // back to any address in the body that is not our own mailbox.
  const originalRecipient =
    body.match(/(?:original|final)-recipient:\s*(?:rfc822;)?\s*([^\s<>]+@[^\s<>]+)/i)?.[1] ??
    body.match(/<([^\s<>]+@[^\s<>]+)>:?\s*(?:host|said|failed)/i)?.[1] ??
    null;

  const hard = HARD_STATUS.test(body) || (!SOFT_STATUS.test(body) && /permanent|does not exist|no such user|user unknown|mailbox unavailable/i.test(body));

  return {
    isBounce: true,
    recipient: originalRecipient?.toLowerCase().replace(/^rfc822;/, "") ?? null,
    hard,
  };
}

// ─── Body cleanup ─────────────────────────────────────────

/**
 * Cut quoted history and signatures.
 *
 * Without this the classifier reads our own email back inside the reply and
 * scores the sentiment of our pitch rather than their answer — which reliably
 * turns "not interested" into POSITIVE.
 */
const QUOTE_MARKERS = [
  /^\s*on .{0,120}\bwrote:\s*$/im,
  /^\s*-{2,}\s*original message\s*-{2,}\s*$/im,
  /^\s*_{5,}\s*$/m,
  /^\s*from:\s*.+\s*$/im,
  /^\s*>{1,}\s?/m,
  /^\s*sent from my \w+/im,
  // RFC 3676 says the signature separator is "-- " with a trailing space, but
  // plenty of clients strip it, so the space cannot be required.
  /^--\s*$/m,
];

function stripQuoted(body: string): string {
  let text = body.replace(/\r\n/g, "\n");

  let cut = text.length;
  for (const marker of QUOTE_MARKERS) {
    const m = text.match(marker);
    if (m?.index !== undefined && m.index < cut) cut = m.index;
  }
  text = text.slice(0, cut);

  return text
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function textFromHtml(html: string | false | undefined): string {
  if (!html) return "";
  return html
    .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|br|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .trim();
}
