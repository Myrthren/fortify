import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { OutboundLeadDetail } from "@/components/outbound-lead-detail";

export default async function OutboundLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as { id: string }).id;
  const { id } = await params;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/login");
  if (user.tier !== "ELITE" && user.tier !== "APEX") redirect("/dashboard/outbound");

  const lead = await db.outboundLead.findFirst({
    where: { id, userId },
    include: {
      campaign: { select: { id: true, name: true, maxFollowUps: true, autoSend: true } },
      emails: { orderBy: { createdAt: "asc" } },
      events: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!lead) notFound();

  return (
    <div className="min-h-screen">
      <DashboardNav user={user} active="outbound" />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
        <OutboundLeadDetail
          lead={{
            id: lead.id,
            company: lead.company,
            website: lead.website,
            domain: lead.domain,
            email: lead.email,
            phone: lead.phone,
            contactName: lead.contactName,
            industry: lead.industry,
            location: lead.location,
            source: lead.source,
            stage: lead.stage,
            analysis: lead.analysis as Record<string, unknown> | null,
            opportunities: (lead.opportunities ?? []) as unknown as {
              title: string;
              evidence: string;
              impact: string;
              fortifyService: string;
              score: number;
            }[],
            opportunityScore: lead.opportunityScore,
            summary: lead.summary,
            suggestedService: lead.suggestedService,
            scrapedPages: (lead.scrapedPages ?? []) as unknown as {
              url: string;
              title: string | null;
              chars: number;
            }[],
            notes: lead.notes,
            disqualifiedReason: lead.disqualifiedReason,
            lastError: lead.lastError,
            emailsSent: lead.emailsSent,
            followUpStep: lead.followUpStep,
            meetingBooked: lead.meetingBooked,
            replySentiment: lead.replySentiment,
            repliedAt: lead.repliedAt?.toISOString() ?? null,
            nextActionAt: lead.nextActionAt?.toISOString() ?? null,
            analysedAt: lead.analysedAt?.toISOString() ?? null,
            scrapedAt: lead.scrapedAt?.toISOString() ?? null,
          }}
          campaign={lead.campaign}
          emails={lead.emails.map((e) => ({
            id: e.id,
            step: e.step,
            status: e.status,
            subject: e.subject,
            body: e.body,
            wordCount: e.wordCount,
            variation: e.variation as Record<string, string | number> | null,
            scheduledAt: e.scheduledAt?.toISOString() ?? null,
            sentAt: e.sentAt?.toISOString() ?? null,
            openedAt: e.openedAt?.toISOString() ?? null,
            repliedAt: e.repliedAt?.toISOString() ?? null,
            failReason: e.failReason,
          }))}
          events={lead.events.map((ev) => ({
            id: ev.id,
            type: ev.type,
            detail: ev.detail,
            createdAt: ev.createdAt.toISOString(),
          }))}
        />
      </main>
    </div>
  );
}
