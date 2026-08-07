import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/outbound/engine/shared";
import { queueApprovedEmail } from "@/lib/outbound/engine/tick";
import { draftEmail } from "@/lib/outbound/engine/stages";

export const maxDuration = 60;

/**
 * PATCH /api/outbound/emails/[id]
 * Human control over a drafted email: edit it, approve it for sending, reject
 * it, or have it rewritten.
 *
 * body: { action: "edit" | "approve" | "reject" | "regenerate", subject?, body? }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { id } = await params;

  const email = await db.outboundEmail.findFirst({
    where: { id, lead: { userId } },
    include: { lead: true, campaign: true },
  });
  if (!email) return new NextResponse("Not found", { status: 404 });

  const payload = (await req.json()) as {
    action?: string;
    subject?: string;
    body?: string;
  };

  // Anything already handed to a provider is history, not a draft.
  const editable = email.status === "DRAFT" || email.status === "QUEUED";
  if (!editable && payload.action !== "reject") {
    return NextResponse.json(
      { error: `Cannot modify an email that is already ${email.status.toLowerCase()}` },
      { status: 409 }
    );
  }

  switch (payload.action) {
    case "edit": {
      const subject = payload.subject?.trim().slice(0, 200);
      const body = payload.body?.trim().slice(0, 10_000);
      if (!subject || !body) {
        return new NextResponse("Subject and body are required", { status: 400 });
      }
      const updated = await db.outboundEmail.update({
        where: { id },
        data: {
          subject,
          body,
          wordCount: body.split(/\s+/).filter(Boolean).length,
        },
      });
      await logEvent(email.leadId, "edited", "Draft edited by hand", undefined, id);
      return NextResponse.json({ email: updated });
    }

    case "approve": {
      await queueApprovedEmail(id);
      return NextResponse.json({ ok: true });
    }

    case "reject": {
      await db.outboundEmail.update({
        where: { id },
        data: { status: "SKIPPED", failReason: "rejected by user" },
      });
      await db.outboundLead.update({
        where: { id: email.leadId },
        data: { nextActionAt: null },
      });
      await logEvent(email.leadId, "rejected", "Draft rejected", undefined, id);
      return NextResponse.json({ ok: true });
    }

    case "regenerate": {
      // Replace rather than mutate, so the rejected version stays visible in
      // the lead's history and the variation dice for this step still apply.
      await db.outboundEmail.update({
        where: { id },
        data: { status: "SKIPPED", failReason: "regenerated" },
      });
      const { emailId, passedGuardrails } = await draftEmail(
        email.lead,
        email.campaign,
        email.step
      );
      const fresh = await db.outboundEmail.findUnique({ where: { id: emailId } });
      return NextResponse.json({ email: fresh, passedGuardrails });
    }

    default:
      return new NextResponse("Unknown action", { status: 400 });
  }
}
