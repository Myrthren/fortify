import { redirect } from "next/navigation";
import { dashboardSession as auth } from "@/lib/session-user";
import { db } from "@/lib/db";
import { WorkspaceMemberSync } from "./workspace-member-sync";
import { LockedPage } from "./locked-page";
import { ContentWorkbench } from "./content-workbench";
import {
  CONTENT_VIEWS,
  contentAccess,
  type ContentKind,
} from "@/lib/content-workspace";
import { Orbit, Clapperboard, ScanLine, GitFork } from "lucide-react";
import Link from "next/link";
import { AutoSlideshow } from "./auto-slideshow";
const active = {
  research: "inspiration",
  story: "story",
  test: "virality",
  decision: "advisor",
} as const;
const icons = {
  research: Orbit,
  story: Clapperboard,
  test: ScanLine,
  decision: GitFork,
};
// Keep the existing asset creator accessible alongside the replacement review
// workspace; replacing the scoring page must not remove this paid capability.
export async function ContentAssetPage() {
  const session = await auth(),
    userId = (session?.user as { id?: unknown } | undefined)?.id;
  if (typeof userId !== "string" || !userId) redirect("/login");
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/login");
  if (!contentAccess("test", user.tier))
    return (
      <LockedPage
        user={user}
        active="virality"
        requiredTier="ELITE"
        title="Slideshow creator"
        description="Create slideshow assets with the existing image tools."
        icon={<Clapperboard />}
      />
    );
  return (
    <div className="min-h-screen">
      <WorkspaceMemberSync user={user} active="virality" />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <span className="eyebrow">Content / Creative assets</span>
        <h1 className="my-3 text-3xl">Slideshow creator</h1>
        <p className="mb-5 text-sm text-text-muted">
          Create your visual assets, then return to your story or content
          review.
        </p>
        <Link
          className="mb-6 inline-block text-sm underline"
          href="/dashboard/content?view=test"
        >
          Back to Content Test Track
        </Link>
        <AutoSlideshow credits={user.credits} />
      </main>
    </div>
  );
}
export async function ContentWorkspacePage({
  kind,
  id,
}: {
  kind: ContentKind;
  id?: string;
}) {
  const session = await auth();
  const userId = (session?.user as { id?: unknown } | undefined)?.id;
  if (typeof userId !== "string" || !userId) redirect("/login");
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/login");
  const v = CONTENT_VIEWS[kind],
    Icon = icons[kind];
  if (!contentAccess(kind, user.tier))
    return (
      <LockedPage
        user={user}
        active={active[kind]}
        requiredTier={v.tier || "PRO"}
        title={`${v.action} / ${v.name}`}
        description={v.help}
        icon={<Icon />}
        features={[
          {
            icon: <Icon />,
            title: "A guided workspace for your own work",
            desc: "Keep sources, drafts and decisions in your account. Nothing is sent or published automatically.",
          },
        ]}
      />
    );
  return (
    <div className="min-h-screen">
      <WorkspaceMemberSync user={user} active={active[kind]} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <ContentWorkbench
          key={kind}
          kind={kind}
          initialId={id}
          tier={user.tier}
        />
      </main>
    </div>
  );
}
