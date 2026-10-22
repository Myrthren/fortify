import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getWorkspaceSnapshot } from "@/lib/workspace-activity";
import { creationTitle } from "@/lib/recent-creations";
import { DashboardNav } from "@/components/dashboard-nav";
import { WorkspaceActivity } from "@/components/workspace-activity";
import { CopyButton } from "@/components/copy-button";
import Link from "next/link";

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  const session = await auth(); const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");
  const params = await searchParams;
  const [user, snapshot, result] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }), getWorkspaceSnapshot(userId),
    params.item ? db.generation.findFirst({ where: { id: params.item, userId, type: { not: "credit-job" } } }) : null,
  ]);
  if (!user) redirect("/login"); if (params.item && !result) notFound();
  return <div className="min-h-screen"><DashboardNav user={user} active="activity"/><main className="mx-auto max-w-6xl px-4 py-10 sm:px-6"><div className="workspace-page-heading"><span className="eyebrow">YOUR WORK, IN ONE PLACE</span><h1>Workspace activity</h1><p>Recent results, lead updates and automation runs from your account.</p></div>{result && <section className="workspace-result card" aria-label="Saved result"><div className="workspace-section-heading"><div><span className="eyebrow">{result.type.replaceAll("-", " ")}</span><h2>{creationTitle(result.input, result.type)}</h2></div><CopyButton text={result.output}/></div><pre>{result.output}</pre><Link href="/dashboard/activity">Close result</Link></section>}<WorkspaceActivity initial={snapshot} tier={user.tier} expanded/></main></div>;
}
