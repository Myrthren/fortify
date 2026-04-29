"use client";

import { useEffect, useState } from "react";
import { DashboardNav } from "@/components/dashboard-nav";

type Prefs = {
  dmPaymentFailed: boolean;
  dmWeeklyReport: boolean;
  dmTrendAlerts: boolean;
  dmCompetitorDone: boolean;
  dmLimitWarning: boolean;
  dmRenewalReminder: boolean;
  dmOnboarding: boolean;
  dmMilestones: boolean;
  dmMatchmaking: boolean;
  dmOwnerNewSub: boolean;
  dmOwnerChurn: boolean;
};

type UserInfo = {
  email: string | null;
  tier: "FREE" | "PRO" | "ELITE" | "APEX";
  discordId: string | null;
};

const OWNER_ID = "731207920007643167";

const MANDATORY = [
  { label: "Subscription activated", desc: "When you successfully subscribe to a plan." },
  { label: "Subscription cancelled", desc: "When your subscription is cancelled, suspended, or expires." },
  { label: "Subscription downgraded", desc: "When you are moved back to the Free tier." },
];

const TOGGLES: { key: keyof Prefs; label: string; desc: string; comingSoon?: boolean }[] = [
  { key: "dmPaymentFailed", label: "Payment failed", desc: "When a billing payment fails on your subscription." },
  { key: "dmRenewalReminder", label: "Renewal reminder", desc: "3 days before your next billing date.", comingSoon: true },
  { key: "dmLimitWarning", label: "Usage limit warning", desc: "When you hit 80% of your monthly quota.", comingSoon: true },
  { key: "dmWeeklyReport", label: "Weekly strategy report", desc: "Your weekly AI digest delivered straight to DMs.", comingSoon: true },
  { key: "dmTrendAlerts", label: "Trend alerts", desc: "When a term you're tracking spikes across the web.", comingSoon: true },
  { key: "dmCompetitorDone", label: "Competitor scan complete", desc: "When a competitor intel report finishes.", comingSoon: true },
  { key: "dmOnboarding", label: "Onboarding tips", desc: "Day 1 / 3 / 7 messages to help you get set up.", comingSoon: true },
  { key: "dmMilestones", label: "Milestone achievements", desc: "First audit, profile completed, etc.", comingSoon: true },
  { key: "dmMatchmaking", label: "New match found", desc: "When a member matches your niche and skills.", comingSoon: true },
];

const OWNER_TOGGLES: { key: keyof Prefs; label: string; desc: string; comingSoon?: boolean }[] = [
  { key: "dmOwnerNewSub", label: "New subscriber alert", desc: "Who joined, what tier, revenue." },
  { key: "dmOwnerChurn", label: "Churn alert", desc: "Who cancelled or failed payment and their tier." },
];

export default function SettingsPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile").then((r) => r.json()).then((d) => setUser(d));
    fetch("/api/notifications/prefs").then((r) => r.json()).then((d) => setPrefs(d));
  }, []);

  async function toggle(key: keyof Prefs, value: boolean) {
    if (!prefs) return;
    setSaving(key);
    const optimistic = { ...prefs, [key]: value };
    setPrefs(optimistic);
    try {
      const res = await fetch("/api/notifications/prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) setPrefs(prefs); // revert on error
    } catch {
      setPrefs(prefs);
    } finally {
      setSaving(null);
    }
  }

  const isOwner = user?.discordId === OWNER_ID;

  return (
    <div className="min-h-screen bg-bg">
      {user && <DashboardNav user={user} active="settings" />}

      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Notification settings</h1>
          <p className="mt-2 text-sm text-text-muted">
            All notifications are delivered via Discord DM from the Fortify bot.
          </p>
        </div>

        {/* Mandatory */}
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Always on
          </h2>
          <div className="card divide-y divide-bg-border">
            {MANDATORY.map((item) => (
              <div key={item.label} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="mt-0.5 text-xs text-text-muted">{item.desc}</p>
                </div>
                <div className="ml-4 shrink-0">
                  <span className="rounded-md bg-white/[0.06] px-2 py-1 text-xs text-text-muted">
                    Required
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Toggleable */}
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Your preferences
          </h2>
          <div className="card divide-y divide-bg-border">
            {TOGGLES.map((item) => {
              const enabled = prefs ? prefs[item.key] : true;
              const busy = saving === item.key;
              return (
                <div key={item.key} className="flex items-center justify-between px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{item.label}</p>
                      {item.comingSoon && (
                        <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
                          Soon
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-text-muted">{item.desc}</p>
                  </div>
                  <button
                    disabled={busy || !prefs}
                    onClick={() => toggle(item.key, !enabled)}
                    className={`ml-4 shrink-0 relative inline-flex h-5 w-9 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
                      enabled ? "bg-white" : "bg-white/20"
                    }`}
                    role="switch"
                    aria-checked={enabled}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-bg shadow-sm transition-transform ${
                        enabled ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Owner-only */}
        {isOwner && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Owner alerts
            </h2>
            <div className="card divide-y divide-bg-border">
              {OWNER_TOGGLES.map((item) => {
                const enabled = prefs ? prefs[item.key] : true;
                const busy = saving === item.key;
                return (
                  <div key={item.key} className="flex items-center justify-between px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{item.label}</p>
                        {item.comingSoon && (
                          <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
                            Soon
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-text-muted">{item.desc}</p>
                    </div>
                    <button
                      disabled={busy || !prefs}
                      onClick={() => toggle(item.key, !enabled)}
                      className={`ml-4 shrink-0 relative inline-flex h-5 w-9 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
                        enabled ? "bg-white" : "bg-white/20"
                      }`}
                      role="switch"
                      aria-checked={enabled}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-bg shadow-sm transition-transform ${
                          enabled ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
