import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TIER_LIMITS } from "@/lib/tiers";
import { DashboardNav } from "@/components/dashboard-nav";
import { VoiceManager } from "@/components/voice-manager";

export default async function VoicePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id;

  // Parallel: user + voices
  const [user, voices] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.brandVoice.findMany({
      where: { userId },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        isActive: true,
        systemPrompt: true,
        createdAt: true,
      },
    }),
  ]);
  if (!user) redirect("/login");

  const limit = TIER_LIMITS[user.tier].brandVoices;
  const limitDisplay = limit === Infinity ? "unlimited" : String(limit);

  return (
    <div className="min-h-screen bg-bg">
      <DashboardNav user={user} active="voice" />

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Brand Voice Studio</h1>
            <p className="mt-3 text-text-muted">
              Train Claude on your writing. Every output sounds like you, not generic AI.
            </p>
          </div>
          <span className="text-sm text-text-muted">
            {voices.length} / {limitDisplay} used
          </span>
        </div>

        <VoiceManager
          initialVoices={voices.map((v) => ({
            ...v,
            createdAt: v.createdAt.toISOString(),
          }))}
          tier={user.tier}
          limit={limit === Infinity ? -1 : limit}
        />
      </main>
    </div>
  );
}
