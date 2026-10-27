import { redirect } from "next/navigation";
import { dashboardSession as auth } from "@/lib/session-user";
import { db } from "@/lib/db";
import { WorkspaceMemberSync } from "@/components/workspace-member-sync";
import { LockedPage } from "@/components/locked-page";
import { LeadPackClient, type PackView } from "@/components/lead-pack-client";
import { PACK_SIZE, PACK_TIERS, weekStart, type PackLead } from "@/lib/lead-pack-core";
import { CalendarClock, MailPlus, PackageOpen, Repeat } from "lucide-react";

export default async function LeadPackPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id as string;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/login");

  if (!PACK_TIERS.includes(user.tier)) {
    return (
      <LockedPage
        user={user} active="lead-pack" requiredTier="ELITE"
        title="Weekly Lead Pack"
        description="Tell Fortify who you sell to and where. Every Monday it finds new local businesses that fit, digs out their published emails and drafts a cold email to each one."
        icon={<PackageOpen />}
        features={[
          { icon: <CalendarClock />, title: "Every Monday", desc: `${PACK_SIZE.ELITE} new businesses a week on Elite, ${PACK_SIZE.APEX} on Apex. Never the same one twice.` },
          { icon: <MailPlus />, title: "Drafts included", desc: "A cold email for each lead, written from your offer and brand voice." },
          { icon: <Repeat />, title: "No credits", desc: "Packs are part of the plan. Your credits stay for everything else." },
        ]}
      />
    );
  }

  const [setting, packs] = await Promise.all([
    db.leadPackSetting.findUnique({ where: { userId } }),
    db.reconSearch.findMany({
      where: { userId, filters: { path: ["pack"], equals: true } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, category: true, location: true, createdAt: true, leads: true },
    }),
  ]);

  const nextMonday = weekStart(new Date());
  nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);

  const views: PackView[] = packs.map((p) => ({
    id: p.id,
    category: p.category ?? "",
    location: p.location,
    createdAt: p.createdAt.toISOString(),
    leads: (p.leads as PackLead[]) ?? [],
  }));

  return (
    <div className="min-h-screen">
      <WorkspaceMemberSync user={user} active="lead-pack" />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        <LeadPackClient
          packSize={PACK_SIZE[user.tier as "ELITE" | "APEX"]}
          nextPackAt={nextMonday.toISOString()}
          initialSetting={setting ? {
            category: setting.category,
            location: setting.location,
            offer: setting.offer,
            enabled: setting.enabled,
            pending: !!setting.pendingRunId,
            lastRunAt: setting.lastRunAt?.toISOString() ?? null,
            lastError: setting.lastError,
          } : null}
          packs={views}
        />
      </main>
    </div>
  );
}
