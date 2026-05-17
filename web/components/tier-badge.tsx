// Animated gradient tier badges
// Pro: #d69130 · Elite: #35d9e2 · Apex: #e74c3c

import type { Tier } from "@prisma/client";

const TIER_CONFIG: Record<string, { label: string; color: string }> = {
  PRO:   { label: "Pro",   color: "#d69130" },
  ELITE: { label: "Elite", color: "#35d9e2" },
  APEX:  { label: "Apex",  color: "#e74c3c" },
};

// Global keyframe injected once via a style tag — avoids duplication
const KEYFRAME_STYLE = `
  @keyframes tierBadgeGlow {
    0%,100% { opacity: 0.85; }
    50%      { opacity: 1; filter: brightness(1.25); }
  }
`;

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
      <style>{KEYFRAME_STYLE}</style>
      <span
        className={`inline-flex items-center rounded-full font-semibold leading-none select-none ${sizeClasses} ${className}`}
        style={{
          border: `1px solid ${cfg.color}55`,
          background: `${cfg.color}18`,
          color: cfg.color,
          animation: "tierBadgeGlow 2.4s ease-in-out infinite",
          textShadow: `0 0 8px ${cfg.color}66`,
        }}
      >
        {cfg.label}+
      </span>
    </>
  );
}
