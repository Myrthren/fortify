"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const TIERS = ["FREE", "PRO", "ELITE", "APEX"] as const;
type Tier = (typeof TIERS)[number];

export function TierSwitcher({ current }: { current: Tier }) {
  const [active, setActive] = useState<Tier>(current);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function setTier(tier: Tier) {
    setError(null);
    setActive(tier);
    startTransition(async () => {
      const res = await fetch("/api/admin/set-tier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      if (!res.ok) {
        setError(await res.text());
        setActive(current);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {TIERS.map((t) => (
          <button
            key={t}
            disabled={pending}
            onClick={() => setTier(t)}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
              active === t
                ? "border-white/40 bg-white/10 text-white"
                : "border-bg-border bg-bg-panel text-text-muted hover:text-text"
            } ${pending ? "opacity-50" : ""}`}
          >
            {t}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
