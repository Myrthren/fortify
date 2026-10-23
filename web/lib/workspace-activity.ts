import { db } from "@/lib/db";
import { contentHref,contentAccess,isContentKind,CONTENT_VIEWS } from "@/lib/content-workspace";
import { creationTitle } from "@/lib/recent-creations";
import { CLOSED_STAGES, stageLabel } from "@/lib/pipeline";
import { isWorkspaceGoal, type GoalSignals, type WorkspaceGoal } from "@/lib/workspace-goals";

export type ActivityItem = { id: string; title: string; detail: string; href: string; action: string; at: string; kind: "lead" | "workflow" | "research" | "creation"; warning?: boolean };
export type AttentionItem = Omit<ActivityItem, "at" | "kind">;
export type WorkspaceSnapshot = {
  updatedAt: string;
  metrics: { openLeads: number; dueFollowUps: number; failedWorkflows: number; competitorChanges: number };
  attention: AttentionItem[];
  activity: ActivityItem[];
  goal: WorkspaceGoal | null;
  dismissed: boolean;
  signals: GoalSignals;
};

export async function getWorkspaceSnapshot(userId: string): Promise<WorkspaceSnapshot> {
  const now = new Date();
  const endOfDay = new Date(now); endOfDay.setUTCHours(23, 59, 59, 999);
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const dueWhere = { userId, followUpAt: { lte: endOfDay }, status: { notIn: CLOSED_STAGES } };
  const [preference, stages, dueCount, due, leads, searches, workflows, scans, changeCount, generations, generationCounts, drafts, watches, topics, savedContent, storyCount, account] = await Promise.all([
    db.workspacePreference.findUnique({ where: { userId } }),
    db.leadStatus.groupBy({ by: ["status"], where: { userId }, _count: true }),
    db.leadStatus.count({ where: dueWhere }),
    db.leadStatus.findMany({ where: dueWhere, orderBy: { followUpAt: "asc" }, take: 4, select: { id: true, company: true, url: true, followUpAt: true } }),
    db.leadStatus.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, company: true, url: true, status: true, updatedAt: true } }),
    db.reconSearch.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 3, select: { id: true, category: true, location: true, totalLeads: true, createdAt: true } }),
    db.workflow.findMany({ where: { userId }, select: { id: true, name: true, runs: { orderBy: { startedAt: "desc" }, take: 1, select: { id: true, status: true, startedAt: true } } } }),
    db.competitorWatchScan.findMany({ where: { watch: { userId }, hasChange: true }, orderBy: { scannedAt: "desc" }, take: 5, select: { id: true, scannedAt: true, watch: { select: { name: true } } } }),
    db.competitorWatchScan.count({ where: { watch: { userId }, hasChange: true, scannedAt: { gte: weekAgo } } }),
    db.generation.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, type: true, input: true, createdAt: true } }),
    db.generation.groupBy({ by: ["type"], where: { userId }, _count: true }),
    db.leadStatus.count({ where: { userId, draft: { not: null } } }),
    db.competitorWatch.count({ where: { userId, active: true } }),
    db.watchTerm.count({ where: { userId } }),
    db.contentRecord.findMany({where:{userId},orderBy:{updatedAt:'desc'},take:8,select:{id:true,title:true,kind:true,updatedAt:true}}),
    db.contentRecord.count({where:{userId,kind:'story'}}),
    db.user.findUnique({where:{id:userId},select:{tier:true}}),
  ]);
  const name = (lead: { company: string | null; url: string }) => {
    if (lead.company) return lead.company;
    try { return new URL(lead.url).hostname; } catch { return "Saved prospect"; }
  };
  const failed = workflows.filter(item => item.runs[0]?.status === "failed");
  const activity: ActivityItem[] = [
    ...savedContent.flatMap(item=>isContentKind(item.kind)&&contentAccess(item.kind,account?.tier??'FREE')?[{id:`content:${item.id}`,kind:'creation' as const,title:item.title,detail:CONTENT_VIEWS[item.kind].name,href:contentHref(item.kind,item.id),action:'Continue work',at:item.updatedAt.toISOString()}]:[]),
    ...leads.map(item => ({ id: `lead:${item.id}`, kind: "lead" as const, title: name(item), detail: `Pipeline · ${stageLabel(item.status)}`, href: `/dashboard/pipeline?lead=${encodeURIComponent(item.id)}`, action: "Review lead", at: item.updatedAt.toISOString() })),
    ...searches.map(item => ({ id: `search:${item.id}`, kind: "lead" as const, title: `${item.totalLeads} leads found`, detail: [item.category, item.location].filter(Boolean).join(" · "), href: `/dashboard/recon?search=${encodeURIComponent(item.id)}`, action: "Review results", at: item.createdAt.toISOString() })),
    ...workflows.filter(item => item.runs.length).map(item => ({ id: `run:${item.runs[0].id}`, kind: "workflow" as const, title: item.name, detail: `Workflow ${item.runs[0].status}`, warning: item.runs[0].status === "failed", href: `/dashboard/workflows/${item.id}`, action: item.runs[0].status === "failed" ? "Review failure" : "Open workflow", at: item.runs[0].startedAt.toISOString() })),
    ...scans.map(item => ({ id: `scan:${item.id}`, kind: "research" as const, title: `${item.watch.name} changed`, detail: "Competitor Watch detected a page change", href: "/dashboard/competitor-tracking", action: "Review change", at: item.scannedAt.toISOString() })),
    ...generations.map(item => ({ id: `generation:${item.id}`, kind: "creation" as const, title: creationTitle(item.input, item.type), detail: item.type.replaceAll("-", " "), href: `/dashboard/activity?item=${encodeURIComponent(item.id)}`, action: "Open result", at: item.createdAt.toISOString() })),
  ];
  activity.sort((a, b) => b.at.localeCompare(a.at));
  const countTypes = (predicate: (type: string) => boolean) => generationCounts.filter(item => predicate(item.type)).reduce((sum, item) => sum + item._count, 0);
  return {
    updatedAt: now.toISOString(), goal: isWorkspaceGoal(preference?.goal) ? preference.goal : null, dismissed: preference?.dismissed ?? false,
    signals: { leads: stages.reduce((sum, item) => sum + item._count, 0), drafts, content: storyCount + countTypes(type => /^(hook|caption|voice|content|script|post)/.test(type)), research: topics + countTypes(type => /competitor|trend/.test(type)), watches },
    metrics: { openLeads: stages.filter(item => !CLOSED_STAGES.includes(item.status)).reduce((sum, item) => sum + item._count, 0), dueFollowUps: dueCount, failedWorkflows: failed.length, competitorChanges: changeCount },
    attention: [
      ...due.map(item => ({ id: `due:${item.id}`, title: `Follow up with ${name(item)}`, detail: `Due ${item.followUpAt!.toISOString().slice(0, 10)}`, href: `/dashboard/pipeline?lead=${encodeURIComponent(item.id)}`, action: "Review lead" })),
      ...failed.slice(0, 4).map(item => ({ id: `failed:${item.id}`, title: item.name, detail: "The latest run failed. Review the log before retrying.", href: `/dashboard/workflows/${item.id}`, action: "Review failure", warning: true })),
    ],
    activity: activity.slice(0, 24),
  };
}
