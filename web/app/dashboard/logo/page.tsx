import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { LogoIntelligence } from "@/components/logo-intelligence";
import { Lock, Wand2, Sparkles } from "lucide-react";
import Link from "next/link";

export default async function LogoPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id as string;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/login");

  if (user.tier === "FREE") {
    return (
      <div className="min-h-screen">
        <DashboardNav user={user} active="logo" />
        <main className="mx-auto max-w-3xl px-4 py-20 sm:px-6 text-center">
          {/* Glow orb */}
          <div
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-bg-border"
            style={{
              background: "linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)",
              boxShadow: "0 0 40px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            <Lock className="h-8 w-8 text-text-muted" />
          </div>

          <h1 className="text-3xl font-bold tracking-tight mb-3">Logo Intelligence</h1>
          <p className="text-text-muted mb-2 max-w-md mx-auto">
            Generate professional logos from scratch or enhance your existing logo with AI feedback.
          </p>
          <p className="text-sm text-text-dim mb-8">
            Available on <span className="text-text-muted font-medium">Pro, Elite, and Apex</span> plans.
          </p>

          {/* Feature preview */}
          <div className="mb-10 grid gap-3 sm:grid-cols-2 text-left max-w-lg mx-auto">
            {[
              { icon: <Sparkles className="h-3.5 w-3.5" />, title: "Logo Generator", desc: "Text prompt + reference images → AI generates criteria → gpt-image-1 produces your logo. 150 credits." },
              { icon: <Wand2 className="h-3.5 w-3.5" />, title: "Logo Enhancer", desc: "Upload your logo → AI analyses strengths & weaknesses → enhanced output with your instructions. 100 credits." },
            ].map((f) => (
              <div key={f.title} className="card p-4 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-text-muted text-xs">{f.icon}</span>
                  <p className="text-sm font-semibold">{f.title}</p>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          <Link href="/pricing" className="btn-primary">
            <Sparkles className="h-4 w-4" />
            Upgrade to unlock Logo Intelligence
          </Link>
          <p className="mt-4 text-xs text-text-dim">
            Plans from £29/mo · Cancel anytime
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <DashboardNav user={user} active="logo" />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="anim-fade-up mb-8">
          <span className="eyebrow">Content</span>
          <div className="mt-2 flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight">Logo Intelligence</h1>
            <span className="rounded-md border border-bg-border bg-bg-panel px-2 py-0.5 text-xs text-text-muted">
              {user.credits.toLocaleString()} credits
            </span>
          </div>
          <p className="text-text-muted">
            Generate professional logos from scratch, or enhance your existing logo with AI feedback.
          </p>
        </div>

        <LogoIntelligence credits={user.credits} />
      </main>
    </div>
  );
}
