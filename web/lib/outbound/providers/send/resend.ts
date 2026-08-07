import { Resend } from "resend";
import type {
  OutboundMessage,
  SendProvider,
  SendResult,
} from "@/lib/outbound/types";

let _client: Resend | null = null;
function client(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  if (!_client) _client = new Resend(key);
  return _client;
}

/**
 * Resend sender.
 *
 * Cold email is sent as plain text only — no HTML part. An HTML cold email
 * looks like a campaign no matter how well written it is, and the multipart
 * boundary itself is a spam signal for one-to-one mail.
 *
 * Open and bounce tracking arrive by webhook (/api/outbound/webhook/resend),
 * not from the send call.
 */
export const resendSender: SendProvider = {
  key: "resend",
  label: "Resend",
  tracksOpens: true,
  tracksBounces: true,

  isAvailable() {
    return Boolean(process.env.RESEND_API_KEY);
  },

  async send(message: OutboundMessage): Promise<SendResult> {
    const headers: Record<string, string> = { ...(message.headers ?? {}) };
    if (message.inReplyTo) {
      headers["In-Reply-To"] = message.inReplyTo;
      headers["References"] = (message.references ?? [message.inReplyTo]).join(" ");
    }

    const res = await client().emails.send({
      from: message.fromName
        ? `${message.fromName} <${message.from}>`
        : message.from,
      to: message.to,
      replyTo: message.replyTo ?? message.from,
      subject: message.subject,
      text: message.text,
      headers,
    });

    if (res.error) {
      throw new Error(`Resend rejected the message: ${res.error.message}`);
    }

    const id = res.data?.id ?? null;
    return {
      providerId: id,
      // Resend does not return the RFC Message-ID, but it derives from the send
      // id on their domain, which is what threading needs.
      messageId: id ? `<${id}@resend.dev>` : null,
    };
  },
};
