import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logEvent, suppress } from "@/lib/outbound/engine/shared";

/**
 * Public opt-out endpoint, linked from the List-Unsubscribe header on every
 * email. Deliberately unauthenticated — an opt-out that requires a login is not
 * an opt-out.
 *
 * Handles GET (a person clicking) and POST (RFC 8058 one-click, which mail
 * clients fire automatically). Both do the same thing, and both must be
 * idempotent because clients retry.
 */
export async function GET(req: Request) {
  const leadId = new URL(req.url).searchParams.get("lead");
  const done = await optOut(leadId);

  return new NextResponse(page(done), {
    status: done ? 200 : 404,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function POST(req: Request) {
  const leadId = new URL(req.url).searchParams.get("lead");
  const done = await optOut(leadId);
  return NextResponse.json({ ok: done }, { status: done ? 200 : 404 });
}

async function optOut(leadId: string | null): Promise<boolean> {
  if (!leadId) return false;

  const lead = await db.outboundLead.findUnique({
    where: { id: leadId },
    select: { id: true, userId: true, email: true, domain: true, stage: true },
  });
  if (!lead) return false;

  // Already opted out — report success rather than erroring. A second click
  // should look identical to the first.
  if (lead.stage === "UNSUBSCRIBED") return true;

  if (lead.email) await suppress(lead.userId, lead.email, "email", "unsubscribed");
  if (lead.domain) await suppress(lead.userId, lead.domain, "domain", "unsubscribed");

  await db.outboundLead.update({
    where: { id: lead.id },
    data: { stage: "UNSUBSCRIBED", nextActionAt: null },
  });
  await db.outboundEmail.updateMany({
    where: { leadId: lead.id, status: { in: ["DRAFT", "QUEUED"] } },
    data: { status: "SKIPPED", failReason: "unsubscribed" },
  });
  await logEvent(lead.id, "unsubscribed", "Opted out via the unsubscribe link");

  return true;
}

/** Monochrome to match the rest of the product — this page is still Fortify. */
function page(done: boolean): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${done ? "Unsubscribed" : "Link not found"}</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#050505;color:#fafafa;
       font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:24px}
  .card{max-width:420px;text-align:center;background:linear-gradient(180deg,#141416,#0d0d0f);
        border:1px solid #2a2a2a;border-radius:16px;padding:40px 32px}
  h1{font-size:20px;font-weight:700;letter-spacing:-0.02em;margin:0 0 12px}
  p{color:#8a8a8a;line-height:1.6;margin:0;font-size:14px}
</style></head>
<body><div class="card">
  <h1>${done ? "You're unsubscribed." : "That link isn't valid."}</h1>
  <p>${
    done
      ? "You won't receive any further emails from us. Nothing else is required."
      : "This unsubscribe link has expired or was not recognised. Reply to the email directly and you'll be removed."
  }</p>
</div></body></html>`;
}
