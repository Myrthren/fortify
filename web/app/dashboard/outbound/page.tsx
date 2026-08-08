import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { LockedPage } from "@/components/locked-page";
import { OutboundClient } from "@/components/outbound-client";
import { describeSendProvider, listProviders } from "@/lib/outbound/registry";
import { Send, Search, Brain, MessagesSquare } from "lucide-react";

export default async function OutboundPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as { id: string }).id;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/login");

  const canAccess = user.tier === "ELITE" || user.tier === "APEX";
  if (!canAccess) {
    return (
      <LockedPage
        user={user}
        active="outbound"
        requiredTier="ELITE"
        title="Outbound Engine"
        description="An autonomous AI that finds businesses, studies their websites, works out where you could genuinely help, and writes a different email to every one of them."
        icon={<Send />}
        features={[
          {
            icon: <Search />,
            title: "Finds and qualifies",
            desc: "Sources businesses matching your target, reads their site, and drops the ones that are not a fit before you spend anything on them.",
          },
          {
            icon: <Brain />,
            title: "Real personalisation",
            desc: "Every email is built from what is actually on that company's website. No templates, no merge tags, no two emails alike.",
          },
          {
            icon: <MessagesSquare />,
            title: "Runs the follow-ups",
            desc: "Chases on your schedule, stops the moment someone replies, and alerts you when a reply is worth reading.",
          },
        ]}
      />
    );
  }

  const [campaigns, voices, stats, recentLeads] = await Promise.all([
    db.outboundCampaign.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { leads: true } } },
    }),
    db.brandVoice.findMany({
      where: { userId },
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
    }),
    loadStats(userId),
    db.outboundLead.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 60,
      select: {
        id: true,
        company: true,
        website: true,
        email: true,
        contactName: true,
        industry: true,
        location: true,
        stage: true,
        opportunityScore: true,
        suggestedService: true,
        emailsSent: true,
        replySentiment: true,
        meetingBooked: true,
        lastSentAt: true,
        updatedAt: true,
        campaignId: true,
      },
    }),
  ]);

  // Whether any campaign sends through something that reports opens/bounces at
  // all. If none do, those rates are unmeasurable rather than zero.
  const tracking = {
    opens: campaigns.some((c) => describeSendProvider(c.sendProvider)?.tracksOpens),
    bounces: campaigns.some((c) => describeSendProvider(c.sendProvider)?.tracksBounces),
  };

  return (
    <div className="min-h-screen">
      <DashboardNav user={user} active="outbound" />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <OutboundClient
          tracking={tracking}
          campaigns={campaigns.map((c) => ({
            id: c.id,
            name: c.name,
            status: c.status,
            targetQuery: c.targetQuery,
            industry: c.industry,
            location: c.location,
            offer: c.offer,
            senderName: c.senderName,
            senderEmail: c.senderEmail,
            senderTitle: c.senderTitle,
            brandVoiceId: c.brandVoiceId,
            discoveryProvider: c.discoveryProvider,
            sendProvider: c.sendProvider,
            dailySendCap: c.dailySendCap,
            sendWindowStartUtc: c.sendWindowStartUtc,
            sendWindowEndUtc: c.sendWindowEndUtc,
            sendOnWeekends: c.sendOnWeekends,
            autoSend: c.autoSend,
            maxFollowUps: c.maxFollowUps,
            minOpportunityScore: c.minOpportunityScore,
            leadTarget: c.leadTarget,
            leadCount: c._count.leads,
            lastTickAt: c.lastTickAt?.toISOString() ?? null,
            lastError: c.lastError,
          }))}
          voices={voices}
          stats={stats}
          leads={recentLeads.map((l) => ({
            ...l,
            lastSentAt: l.lastSentAt?.toISOString() ?? null,
            updatedAt: l.updatedAt.toISOString(),
          }))}
          providers={listProviders()}
        />
      </main>
    </div>
  );
}

/**
 * Headline numbers. Counted straight from the tables rather than kept in a
 * rollup column — the volumes here are small enough that a live count is
 * cheaper than the bugs a denormalised counter would cause.
 */
async function loadStats(userId: string) {
  const [leads, byStage, emails, sent, opened, replied, bounced, positive, meetings] =
    await Promise.all([
      db.outboundLead.count({ where: { userId } }),
      db.outboundLead.groupBy({
        by: ["stage"],
        where: { userId },
        _count: { _all: true },
      }),
      db.outboundEmail.count({ where: { lead: { userId } } }),
      db.outboundEmail.count({
        where: {
          lead: { userId },
          status: { in: ["SENT", "DELIVERED", "OPENED", "REPLIED", "BOUNCED"] },
        },
      }),
      db.outboundEmail.count({ where: { lead: { userId }, openedAt: { not: null } } }),
      db.outboundLead.count({ where: { userId, repliedAt: { not: null } } }),
      db.outboundEmail.count({ where: { lead: { userId }, status: "BOUNCED" } }),
      db.outboundLead.count({ where: { userId, replySentiment: "POSITIVE" } }),
      db.outboundLead.count({ where: { userId, meetingBooked: true } }),
    ]);

  return {
    leads,
    emailsGenerated: emails,
    emailsSent: sent,
    opened,
    replies: replied,
    positiveReplies: positive,
    meetings,
    bounced,
    // Rates are meaningless on a handful of sends, so the UI is given the raw
    // denominator and decides whether to show a percentage at all.
    stages: Object.fromEntries(byStage.map((s) => [s.stage, s._count._all])),
  };
}
