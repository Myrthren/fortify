import nodemailer, { type Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type {
  OutboundMessage,
  SendProvider,
  SendResult,
} from "@/lib/outbound/types";

let _transport: Transporter | null = null;

function transport(): Transporter {
  const host = process.env.OUTBOUND_SMTP_HOST ?? process.env.SMTP_HOST;
  const user = process.env.OUTBOUND_SMTP_USER ?? process.env.SMTP_USER;
  const pass = process.env.OUTBOUND_SMTP_PASS ?? process.env.SMTP_PASS;
  if (!host || !user || !pass) throw new Error("SMTP credentials are not set");

  if (!_transport) {
    const port = Number(process.env.OUTBOUND_SMTP_PORT ?? process.env.SMTP_PORT ?? 587);
    const options: SMTPTransport.Options = {
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    };
    // Deliberately unpooled (nodemailer's default): mailbox providers throttle
    // long-lived pooled connections far harder than individual messages.
    _transport = nodemailer.createTransport(options);
  }
  return _transport;
}

/**
 * Direct SMTP sender — the same IONOS mailbox marketing/cold-outreach.js uses.
 *
 * Deliverability is better than an ESP for genuine one-to-one cold mail: it is
 * a real mailbox with real reputation and no shared-IP campaign fingerprint.
 * The trade-off is no open tracking and no bounce webhook — bounces arrive in
 * the mailbox as messages, which is why replies must be polled rather than
 * pushed when this provider is active.
 */
export const smtpSender: SendProvider = {
  key: "smtp",
  label: "SMTP (IONOS)",
  tracksOpens: false,
  tracksBounces: false,

  isAvailable() {
    return Boolean(
      (process.env.OUTBOUND_SMTP_HOST ?? process.env.SMTP_HOST) &&
        (process.env.OUTBOUND_SMTP_USER ?? process.env.SMTP_USER) &&
        (process.env.OUTBOUND_SMTP_PASS ?? process.env.SMTP_PASS)
    );
  },

  async send(message: OutboundMessage): Promise<SendResult> {
    const info = await transport().sendMail({
      from: message.fromName
        ? `${message.fromName} <${message.from}>`
        : message.from,
      to: message.toName ? `${message.toName} <${message.to}>` : message.to,
      replyTo: message.replyTo ?? message.from,
      subject: message.subject,
      text: message.text,
      inReplyTo: message.inReplyTo ?? undefined,
      references: message.references?.length ? message.references : undefined,
      headers: message.headers,
    });

    return {
      providerId: info.messageId ?? null,
      messageId: info.messageId ?? null,
    };
  },
};
