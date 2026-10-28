import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session-user";
import { LockedPage } from "@/components/locked-page";
import { WorkspaceMemberSync } from "@/components/workspace-member-sync";
import { GrowthMissionClient, type MissionView, type MissionProspect } from "@/components/growth-mission-client";
import { Target, ClipboardCheck, ChartNoAxesCombined } from "lucide-react";
import "../../growth-mission.css";

export default async function MissionsPage({ searchParams }: { searchParams: Promise<{ mission?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.tier === "FREE") return <LockedPage user={user} active="missions" requiredTier="PRO" title="Growth Missions" description="Set a measurable business goal, choose the prospects worth pursuing, and track the work through your pipeline." icon={<Target />} features={[
    { icon: <Target />, title: "One clear target", desc: "Tie a goal and deadline to a saved business." },
    { icon: <ClipboardCheck />, title: "Review before action", desc: "Choose which existing prospects belong to the mission. Nothing sends automatically." },
    { icon: <ChartNoAxesCombined />, title: "See progress", desc: "Track outcomes from the pipeline stages you record." },
  ]}/>;

  const params = await searchParams;
  const [businesses, summaries, prospects] = await Promise.all([
    db.businessProfile.findMany({ where: { userId: user.id }, orderBy: [{ active: "desc" }, { updatedAt: "desc" }], select: { id: true, name: true, offer: true, audience: true, active: true } }),
    db.growthMission.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { id: true, businessId: true, goal: true, target: true, status: true, business: { select: { name: true } } } }),
    db.leadStatus.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 60, select: { id: true, company: true, url: true, status: true, source: true, updatedAt: true } }),
  ]);
  const selectedId = summaries.find(item => item.id === params.mission)?.id ?? summaries.find(item => item.status === "active")?.id ?? summaries[0]?.id;
  const mission = selectedId ? await db.growthMission.findFirst({ where: { id: selectedId, userId: user.id }, include: { business: { select: { name: true } }, leads: { orderBy: { createdAt: "desc" }, include: { lead: { select: { id: true, company: true, url: true, status: true, source: true, context: true, draft: true, email: true, updatedAt: true } } } } } }) : null;
  const view: MissionView | null = mission ? ({
    id: mission.id, businessId: mission.businessId, businessName: mission.business.name,
    goal: mission.goal, target: mission.target, deadline: mission.deadline.toISOString(),
    offer: mission.offer, audience: mission.audience, status: mission.status,
    createdAt: mission.createdAt.toISOString(), updatedAt: mission.updatedAt.toISOString(),
    leads: mission.leads.map(item => ({ id: item.id, decision: item.decision, reviewedAt: item.reviewedAt?.toISOString() ?? null, repliedAt: item.repliedAt?.toISOString() ?? null, bookedAt: item.bookedAt?.toISOString() ?? null, wonAt: item.wonAt?.toISOString() ?? null, lead: { ...item.lead, updatedAt: item.lead.updatedAt.toISOString() } })),
  }) : null;
  const missionSummaries = summaries.map(item => ({ id: item.id, businessName: item.business.name, goal: item.goal, target: item.target, status: item.status }));

  const recentProspects: MissionProspect[] = prospects.map(item => ({ ...item, context: null, draft: null, email: null, updatedAt: item.updatedAt.toISOString() }));
  return <div className="min-h-screen"><WorkspaceMemberSync user={user} active="missions"/><main className="mission-page"><GrowthMissionClient tier={user.tier} businesses={businesses} missions={missionSummaries} mission={view} prospects={recentProspects}/></main></div>;
}
