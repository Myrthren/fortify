"use client";

// Animated gradient tier badge
// Pro: #d69130 · Elite: #35d9e2 · Apex: #e74c3c

import type { Tier } from "@prisma/client";

const TIER_CONFIG: Record<string, { label: string; color: string }> = {
  PRO:   { label: "Pro",   color: "#d69130" },
  ELITE: { label: "Elite", color: "#35d9e2" },
  APEX:  { label: "Apex",  color: "#e74c3c" },
};

export function TierBadge({
  tier,
  size = "sm",
  className = "",
}: {
  tier: "PRO" | "ELITE" | "APEX" | Tier;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const cfg = TIER_CONFIG[tier as string];
  if (!cfg) return null;

  const sizeClasses =
    size === "xs" ? "px-1.5 py-0.5 text-[9px]" :
    size === "md" ? "px-3 py-1 text-sm" :
    "px-2 py-0.5 text-[10px]";

  return (
    <>
      <style>{`
        @keyframes tierGradientShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .tier-badge-animated {
          background-size: 200% 200%;
          animation: tierGradientShift 2.4s ease infinite;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>
      <span
        className={`tier-badge-animated inline-flex items-center rounded-full font-semibold leading-none ${sizeClasses} ${className}`}
        style={{
          backgroundImage: `linear-gradient(135deg, ${cfg.color}cc, ${cfg.color}, ${cfg.color}aa, ${cfg.color})`,
          border: `1px solid ${cfg.color}40`,
          // Add subtle bg for the border to show
          background: undefined,
        }}
      >
        <span
          className="tier-badge-animated"
          style={{
            backgroundImage: `linear-gradient(90deg, ${cfg.color}88, ${cfg.color}, ${cfg.color}cc, ${cfg.color}88)`,
          }}
        >
          {cfg.label}
        </span>
      </span>
    </>
  );
}

// Simpler inline version (no wrapper span — for nav dropdowns)
export function TierDot({
  tier,
}: {
  tier: "PRO" | "ELITE" | "APEX" | string;
}) {
  const cfg = TIER_CONFIG[tier as string];
  if (!cfg) return null;
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
      style={{ background: cfg.color, boxShadow: `0 0 4px ${cfg.color}` }}
    />
  );
}
