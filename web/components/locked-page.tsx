import { Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import { DashboardNav } from "@/components/dashboard-nav";
import type { Tier } from "@prisma/client";

// Tier display config
const TIER_META: Record<string, { label: string; color: string; plans: string }> = {
  PRO:   { label: "Pro",        color: "#d69130", plans: "Pro, Elite, and Apex plans" },
  ELITE: { label: "Elite+",     color: "#35d9e2", plans: "Elite and Apex plans" },
  APEX:  { label: "Apex",       color: "#e74c3c", plans: "Apex plan" },
};

type LockedPageProps = {
  // What to show in the locked state
  title: string;
  description: string;
  requiredTier: "PRO" | "ELITE" | "APEX";
  icon?: React.ReactNode;     // lucide icon (or string), default Lock
  features?: { icon: React.ReactNode; title: string; desc: string }[];

  // Nav props
  user: {
    email: string | null;
    username?: string | null;
    tier: Tier;
    discordId: string | null;
    credits?: number;
  };
  active: string;
};

export function LockedPage({
  title,
  description,
  requiredTier,
  icon,
  features,
  user,
  active,
}: LockedPageProps) {
  const meta = TIER_META[requiredTier];

  return (
    <div className="min-h-screen">
      <style>{`
        @keyframes tierGlow {
          0%,100% { opacity: 0.7; box-shadow: 0 0 20px ${meta.color}22; }
          50%      { opacity: 1;   box-shadow: 0 0 40px ${meta.color}55, 0 0 80px ${meta.color}22; }
        }
        @keyframes lockIconFloat {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-4px); }
        }
        @keyframes tierTextShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .locked-tier-text {
          background: linear-gradient(90deg, ${meta.color}99, ${meta.color}, ${meta.color}cc, ${meta.color});
          background-size: 200% 200%;
          animation: tierTextShift 2.4s ease infinite;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          font-weight: 600;
        }
        .locked-icon-wrap {
          animation: lockIconFloat 3s ease-in-out infinite;
        }
        .locked-icon-glow {
          animation: tierGlow 3s ease-in-out infinite;
        }
      `}</style>

      <DashboardNav user={user} active={active as any} />

      <main className="mx-auto max-w-3xl px-4 py-20 sm:px-6 text-center">

        {/* Icon */}
        <div className="locked-icon-wrap mx-auto mb-8 flex h-24 w-24 items-center justify-center">
          <div
            className="locked-icon-glow flex h-24 w-24 items-center justify-center rounded-3xl border"
            style={{
              background: "linear-gradient(135deg, #111 0%, #1e1e1e 60%, #161616 100%)",
              borderColor: `${meta.color}30`,
            }}
          >
            {icon ? (
              <span
                className="text-4xl [&>svg]:h-10 [&>svg]:w-10"
                style={{ color: `${meta.color}bb` }}
              >
                {icon}
              </span>
            ) : (
              <Lock className="h-10 w-10" style={{ color: `${meta.color}bb` }} />
            )}
          </div>
        </div>

        {/* Title */}
        <h1 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>

        {/* Description */}
        <p className="mx-auto mb-3 max-w-md text-base text-text-muted leading-relaxed">
          {description}
        </p>

        {/* Tier requirement */}
        <p className="mb-10 text-sm text-text-dim">
          Available on{" "}
          <span className="locked-tier-text">{meta.plans}</span>.
        </p>

        {/* Feature tiles (optional) */}
        {features && features.length > 0 && (
          <div className={`mb-10 grid gap-3 text-left mx-auto max-w-2xl ${features.length === 3 ? "sm:grid-cols-3" : features.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2"}`}>
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-bg-border bg-bg-panel p-4 space-y-1.5"
                style={{ borderColor: `${meta.color}15` }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm [&>svg]:h-4 [&>svg]:w-4"
                    style={{ color: `${meta.color}cc` }}
                  >
                    {f.icon}
                  </span>
                  <p className="text-sm font-semibold">{f.title}</p>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all hover:scale-105"
          style={{
            background: `linear-gradient(135deg, ${meta.color}cc, ${meta.color}99)`,
            boxShadow: `0 4px 20px ${meta.color}44`,
          }}
        >
          <Sparkles className="h-4 w-4" />
          Upgrade to {meta.label}
        </Link>

        <p className="mt-4 text-xs text-text-dim">Cancel anytime · Instant access</p>
      </main>
    </div>
  );
}
