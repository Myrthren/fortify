import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applyReply } from "@/lib/outbound/engine/reply";
import { logEvent, suppress } from "@/lib/outbound/engine/shared";

/**
 * Resend delivery events: opens, bounces, complaints, and (where the account
 * has inbound configured) replies.
 *
 * Signed with Standard Webhooks, the same scheme as the Whop handler — see
 * app/api/whop/webhook/route.ts. The secret is `whsec_`-prefixed and base64
 * after the prefix, which is the part that differs from Whop's raw key.
 */
const TOLERANCE_SECONDS = 5 * 60;

export async function POST(req: Request) {
  const raw = await req.text();

  const secret = process.env.OUTBOUND_RESEND_WEBHOOK_SECRET;
  if (secret) {
    if (!verify(req, raw, secret)) {
      return new NextResponse("Invalid signature", { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // Refusing unsigned deliveries in production is the point of the check —
    // without it anyone who finds the URL can mark leads as bounced.
    console.error("[outbound] OUTBOUND_RESEND_WEBHOOK_SECRET is not set");
    return new NextResponse("Webhook secret not configured", { status: 503 });
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(raw) as ResendEvent;
  } catch {
    return new NextResponse("Bad payload", { status: 400 });
  }

  const providerId = event.data?.email_id ?? null;
  if (!providerId) return NextResponse.json({ ok: true, ignored: "no email_id" });

  const email = await db.outboundEmail.findUnique({
    where: { providerId },
    include: { lead: true },
  });
  // Not one of ours (a transactional send, say). Acknowledge so Resend stops
  // retrying.
  if (!email) return NextResponse.json({ ok: true, ignored: "unknown email" });

  const now = new Date();

  switch (event.type) {
    case "email.delivered":
      if (email.status === "SENT") {
        await db.outboundEmail.update({ where: { id: email.id }, data: { status: "DELIVERED" } });
      }
      break;

    case "email.opened":
      // Only the first open is meaningful; later ones are the same person
      // re-reading, or an image proxy.
      if (!email.openedAt) {
        await db.outboundEmail.update({
          where: { id: email.id },
          data: { openedAt: now, status: email.status === "REPLIED" ? "REPLIED" : "OPENED" },
        });
        await logEvent(email.leadId, "opened", "Email opened", undefined, email.id);
      }
      break;

    case "email.bounced": {
      const hard = (event.data?.bounce?.type ?? "").toLowerCase() !== "transient";
      await db.outboundEmail.update({
        where: { id: email.id },
        data: {
          status: "BOUNCED",
          bouncedAt: now,
          failReason: event.data?.bounce?.message?.slice(0, 500) ?? "bounced",
        },
      });
      if (hard) {
        await db.outboundLead.update({
          where: { id: email.leadId },
          data: { stage: "BOUNCED", nextActionAt: null },
        });
        await db.outboundEmail.updateMany({
          where: { leadId: email.leadId, status: { in: ["DRAFT", "QUEUED"] } },
          data: { status: "SKIPPED", failReason: "address bounced" },
        });
        // A dead address must never be tried again — continuing to mail it is
        // the fastest way to lose the sending domain.
        if (email.lead.email) {
          await suppress(email.lead.userId, email.lead.email, "email", "bounced");
        }
      }
      await logEvent(
        email.leadId,
        "bounced",
        `${hard ? "Hard" : "Soft"} bounce`,
        { bounce: event.data?.bounce },
        email.id
      );
      break;
    }

    case "email.complained":
      await db.outboundLead.update({
        where: { id: email.leadId },
        data: { stage: "UNSUBSCRIBED", nextActionAt: null },
      });
      if (email.lead.email) {
        await suppress(email.lead.userId, email.lead.email, "email", "spam complaint");
      }
      if (email.lead.domain) {
        await suppress(email.lead.userId, email.lead.domain, "domain", "spam complaint");
      }
      await logEvent(email.leadId, "complained", "Marked as spam", undefined, email.id);
      break;

    case "email.replied": {
      const body = event.data?.text ?? event.data?.html ?? "";
      if (body) await applyReply(email.leadId, body, { emailId: email.id, receivedAt: now });
      break;
    }
  }

  return NextResponse.json({ ok: true });
}

type ResendEvent = {
  type?: string;
  data?: {
    email_id?: string;
    text?: string;
    html?: string;
    bounce?: { type?: string; message?: string };
  };
};

function verify(req: Request, body: string, secret: string): boolean {
  const id = req.headers.get("svix-id") ?? req.headers.get("webhook-id");
  const timestamp = req.headers.get("svix-timestamp") ?? req.headers.get("webhook-timestamp");
  const signature = req.headers.get("svix-signature") ?? req.headers.get("webhook-signature");
  if (!id || !timestamp || !signature) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");

  // The header carries a space-separated list of `v1,<sig>` — any match passes,
  // which is how secret rotation works without dropping deliveries.
  return signature
    .split(" ")
    .map((part) => part.split(",")[1])
    .filter(Boolean)
    .some((sig) => safeEqual(sig, expected));
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
