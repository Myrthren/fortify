import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { applyReply } from "@/lib/outbound/engine/reply";
import { logEvent, suppress } from "@/lib/outbound/engine/shared";

export const maxDuration = 60;

/**
 * PATCH /api/outbound/leads/[id]
 * Human overrides on a single lead: notes, marking a meeting booked, logging a
 * reply that arrived somewhere the system cannot see, or disqualifying it.
 *
 * body: { notes?, meetingBooked?, action?: "disqualify" | "log_reply" | "unsubscribe" | "requeue", reason?, replyBody? }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { id } = await params;

  const lead = await db.outboundLead.findFirst({ where: { id, userId } });
  if (!lead) return new NextResponse("Not found", { status: 404 });

  const body = (await req.json()) as {
    notes?: string;
    meetingBooked?: boolean;
    action?: string;
    reason?: string;
    replyBody?: string;
  };

  if (typeof body.notes === "string") {
    await db.outboundLead.update({
      where: { id },
      data: { notes: body.notes.slice(0, 10_000) },
    });
  }

  if (typeof body.meetingBooked === "boolean") {
    await db.outboundLead.update({
      where: { id },
      data: { meetingBooked: body.meetingBooked },
    });
    await logEvent(id, "meeting", body.meetingBooked ? "Meeting booked" : "Meeting unmarked");
  }

  switch (body.action) {
    case "disqualify": {
      const reason = body.reason?.trim().slice(0, 400) || "Disqualified by user";
      await db.outboundLead.update({
        where: { id },
        data: { stage: "DISQUALIFIED", disqualifiedReason: reason, nextActionAt: null },
      });
      await db.outboundEmail.updateMany({
        where: { leadId: id, status: { in: ["DRAFT", "QUEUED"] } },
        data: { status: "SKIPPED", failReason: "lead disqualified" },
      });
      await logEvent(id, "disqualified", reason);
      break;
    }

    case "unsubscribe": {
      if (lead.email) await suppress(userId, lead.email, "email", "manual");
      if (lead.domain) await suppress(userId, lead.domain, "domain", "manual");
      await db.outboundLead.update({
        where: { id },
        data: { stage: "UNSUBSCRIBED", nextActionAt: null },
      });
      await db.outboundEmail.updateMany({
        where: { leadId: id, status: { in: ["DRAFT", "QUEUED"] } },
        data: { status: "SKIPPED", failReason: "unsubscribed" },
      });
      await logEvent(id, "unsubscribed", "Added to do-not-contact by user");
      break;
    }

    case "log_reply": {
      // Replies that came to a mailbox the engine cannot read still have to
      // stop the sequence, so this runs the same path as an inbound webhook.
      const replyBody = body.replyBody?.trim();
      if (!replyBody) return new NextResponse("replyBody is required", { status: 400 });
      const classification = await applyReply(id, replyBody.slice(0, 20_000));
      return NextResponse.json({ ok: true, classification });
    }

    case "requeue": {
      // Put a disqualified or errored lead back into the pipeline at the
      // earliest stage its existing data supports.
      const stage = lead.analysedAt ? "ANALYSED" : lead.scrapedAt ? "SCRAPED" : "DISCOVERED";
      await db.outboundLead.update({
        where: { id },
        data: {
          stage,
          disqualifiedReason: null,
          lastError: null,
          errorCount: 0,
          nextActionAt: new Date(),
        },
      });
      await logEvent(id, "requeued", `Put back into the pipeline at ${stage}`);
      break;
    }
  }

  const updated = await db.outboundLead.findUnique({ where: { id } });
  return NextResponse.json({ lead: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { id } = await params;

  const lead = await db.outboundLead.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!lead) return new NextResponse("Not found", { status: 404 });

  await db.outboundLead.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
