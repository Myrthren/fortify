import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TIER_LIMITS, TIERS } from "@/lib/tiers";
import { Logo } from "@/components/logo";
import { isOwner } from "@/lib/owner";
import { VoiceManager } from "@/components/voice-manager";
import Link from "next/link";

export default async function VoicePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: (session.user as any).id },
  });
  if (!user) redirect("/login");

  const voices = await db.brandVoice.findMany({
    where: { userId: user.id },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      isActive: true,
      systemPrompt: true,
      createdAt: true,
    },
  });

  const limit = TIER_LIMITS[user.tier].brandVoices;
  const limitDisplay = limit === Infinity ? "unlimited" : String(limit);

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-bg-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Logo withWord />
            <nav className="hidden gap-4 text-sm text-text-muted sm:flex">
              <Link href="/dashboard" className="hover:text-text">Dashboard</Link>
              <Link href="/dashboard/voice" className="text-text">Brand Voice</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="rounded-md border border-bg-border bg-bg-panel px-2.5 py-1 text-xs font-medium">
              {TIERS[user.tier].name}
            </span>
            {isOwner(user.discordId) && (
              <Link href="/admin" className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-1 text-xs font-medium text-yellow-200 hover:bg-yellow-500/20">
                Admin
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Brand Voice Studio</h1>
            <p className="mt-2 text-text-muted">
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
