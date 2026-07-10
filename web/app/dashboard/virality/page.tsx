import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { ViralityEngine } from "@/components/virality-engine";
import { AutoSlideshow } from "@/components/auto-slideshow";
import { TIER_LIMITS } from "@/lib/tiers";
import { LockedPage } from "@/components/locked-page";
import { TierBadge } from "@/components/tier-badge";
import { Clapperboard, Brain, CalendarClock, Rocket } from "lucide-react";
import Link from "next/link";

export default async function ViralityPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id as string;

  const [user, socialConnections] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.socialConnection.findMany({ where: { userId } }),
  ]);

  if (!user) redirect("/login");

  const canUse = TIER_LIMITS[user.tier].virality;
  const canAutoPublish = TIER_LIMITS[user.tier].autoPublish;

  if (!canUse) {
    return (
      <LockedPage
        user={user} active="virality" requiredTier="ELITE"
        title="Virality Engine"
        description="AI-powered video scoring, optimal publish timing, and automated social publishing to TikTok, YouTube, and Facebook."
        icon={<Clapperboard />}
        features={[
          { icon: <Brain />, title: "AI Video Scoring", desc: "Get a virality score, title suggestions, and hook analysis for any video." },
          { icon: <CalendarClock />, title: "Optimal Timing", desc: "AI finds the best time to post based on your audience and platform data." },
          { icon: <Rocket />, title: "Auto-Publish (Apex)", desc: "Schedule and auto-publish to TikTok, YouTube, and Facebook from one place." },
        ]}
      />
    );
  }

  const connections = socialConnections.map((c) => ({
    platform: c.platform as "tiktok" | "youtube" | "facebook",
    channelName: c.channelName ?? null,
    pageId: c.pageId ?? null,
  }));

  return (
    <div className="min-h-screen">
      <DashboardNav user={user} active="virality" />

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold tracking-tight">Virality Engine</h1>
            <TierBadge tier={canAutoPublish ? "APEX" : "ELITE"} />
          </div>
          <p className="text-sm text-text-muted">
            Upload videos to your Media Pool, get AI virality scores per platform, and{" "}
            {canAutoPublish
              ? "auto-publish at the optimal time."
              : "publish manually with AI-optimised tags and titles."}
          </p>
        </div>

        <ViralityEngine
          initialConnections={connections}
          canAutoPublish={canAutoPublish}
        />

        <div className="mt-6">
          <AutoSlideshow credits={user.credits} />
        </div>
      </main>
    </div>
  );
}
