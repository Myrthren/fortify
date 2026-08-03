"use client";

import { useEffect, useState } from "react";
import { DashboardNav } from "@/components/dashboard-nav";
import { MetaConnectSection } from "@/components/meta-connect";
import { GoogleConnectSection } from "@/components/google-connect";
import { ShopifyConnectSection } from "@/components/shopify-connect";
import { StripeConnectSection } from "@/components/stripe-connect";
import { NotionConnectSection } from "@/components/notion-connect";
import type { Tier } from "@prisma/client";
import { Download, Trash2 } from "lucide-react";
import { OwnerLeadExtractorSettings } from "./owner-lead-extractor";

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
  dmAdReport: boolean;
  dmShopifyLowStock: boolean;
  dmShopifyOutOfStock: boolean;
  dmShopifyWeeklyRevenue: boolean;
  dmShopifyMilestone: boolean;
  dmStripeMrrDrop: boolean;
  dmContentBrief: boolean;
};

type UserPrefs = {
  showDiscordUsername: boolean;
  allowMessages: boolean;
  allowConnections: boolean;
};

const OWNER_ID = "731207920007643167";

const MANDATORY = [
  { label: "Subscription activated", desc: "When you successfully subscribe to a plan." },
  { label: "Subscription cancelled", desc: "When your subscription is cancelled, suspended, or expires." },
  { label: "Subscription downgraded", desc: "When you are moved back to the Free tier." },
];

const TOGGLES: { key: keyof Prefs; label: string; desc: string; comingSoon?: boolean }[] = [
  { key: "dmPaymentFailed",    label: "Payment failed",        desc: "When a billing payment fails on your subscription." },
  { key: "dmAdReport",         label: "Meta Ads report",       desc: "Weekly AI analysis of your Meta ad performance." },
  { key: "dmCompetitorDone",   label: "Competitor scan done",  desc: "When a competitor intel report finishes." },
  { key: "dmShopifyLowStock",      label: "Shopify — low stock",        desc: "Daily alert when any product drops to 5 units or fewer." },
  { key: "dmShopifyOutOfStock",    label: "Shopify — out of stock",     desc: "Daily alert when a tracked product hits zero inventory." },
  { key: "dmShopifyWeeklyRevenue", label: "Shopify — weekly revenue",   desc: "Every Monday: last 7 days revenue vs the week before." },
  { key: "dmShopifyMilestone",     label: "Shopify — revenue milestone",desc: "When your store crosses $500, $1k, $5k, $10k… this month." },
  { key: "dmStripeMrrDrop",        label: "Stripe — MRR change",        desc: "Alert when MRR drops >10% or spikes >25% week over week." },
  { key: "dmContentBrief",         label: "Weekly content brief",       desc: "3 content ideas based on trending Reddit posts in your niche." },
  { key: "dmWeeklyReport",    label: "Weekly strategy report",desc: "Your weekly AI digest delivered straight to DMs." },
  { key: "dmRenewalReminder", label: "Renewal reminder",      desc: "3 days before your next billing date.", comingSoon: true },
  { key: "dmLimitWarning",    label: "Usage limit warning",   desc: "When you hit 80% of your monthly quota.", comingSoon: true },
  { key: "dmTrendAlerts",     label: "Trend alerts",          desc: "When a term you're tracking spikes across the web." },
  { key: "dmOnboarding",      label: "Onboarding tips",       desc: "Day 1 / 3 / 7 messages to help you get set up.", comingSoon: true },
  { key: "dmMilestones",      label: "Milestone achievements",desc: "First audit, profile completed, etc." },
  { key: "dmMatchmaking",     label: "New match found",       desc: "When a member matches your niche and skills." },
];

const OWNER_TOGGLES: { key: keyof Prefs; label: string; desc: string }[] = [
  { key: "dmOwnerNewSub", label: "New subscriber alert", desc: "Who joined, what tier, revenue." },
  { key: "dmOwnerChurn",  label: "Churn alert",          desc: "Who cancelled or failed payment and their tier." },
];

const SOCIAL_TOGGLES: { key: keyof UserPrefs; label: string; desc: string }[] = [
  { key: "showDiscordUsername", label: "Show Discord username in search", desc: "When others search for you, your Discord username will be shown." },
  { key: "allowMessages",       label: "Allow message requests",         desc: "Other members can send you direct messages." },
  { key: "allowConnections",    label: "Allow connection requests",      desc: "Other members can send you connection requests." },
];

function Toggle({
  enabled,
  busy,
  onChange,
}: {
  enabled: boolean;
  busy: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      disabled={busy}
      onClick={() => onChange(!enabled)}
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
  );
}

export function SettingsClient({
  user,
  meta,
  google,
  shopify,
  stripe,
  notion,
  username: initialUsername,
  usernameChangesUsed,
  credits,
  leRaiseBatch,
}: {
  user: { email: string | null; tier: Tier; discordId: string | null };
  meta: { connected: boolean; accountName: string | null };
  google: { connected: boolean; gaPropertyName: string | null; scSiteUrl: string | null };
  shopify: { connected: boolean; shop: string | null };
  stripe: { connected: boolean };
  notion: { connected: boolean; workspaceName: string | null; rootPageId: string | null };
  username: string | null;
  usernameChangesUsed: number;
  credits: number;
  leRaiseBatch: boolean;
}) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  // User prefs (social/privacy)
  const [userPrefs, setUserPrefs] = useState<UserPrefs | null>(null);
  const [savingPref, setSavingPref] = useState<string | null>(null);

  // GDPR
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Username state
  const [username, setUsername] = useState(initialUsername ?? "");
  const [usernameInput, setUsernameInput] = useState(initialUsername ?? "");
  const [editingUsername, setEditingUsername] = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSuccess, setUsernameSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/notifications/prefs").then((r) => r.json()).then((d) => setPrefs(d));
    fetch("/api/user/prefs").then((r) => r.json()).then((d) => {
      setUserPrefs({
        showDiscordUsername: d.showDiscordUsername ?? false,
        allowMessages: d.allowMessages ?? true,
        allowConnections: d.allowConnections ?? true,
      });
    });
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
      if (!res.ok) setPrefs(prefs);
    } catch {
      setPrefs(prefs);
    } finally {
      setSaving(null);
    }
  }

  async function toggleUserPref(key: keyof UserPrefs, value: boolean) {
    if (!userPrefs) return;
    setSavingPref(key);
    const optimistic = { ...userPrefs, [key]: value };
    setUserPrefs(optimistic);
    try {
      const res = await fetch("/api/user/prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) setUserPrefs(userPrefs);
    } catch {
      setUserPrefs(userPrefs);
    } finally {
      setSavingPref(null);
    }
  }

  async function saveUsername() {
    setSavingUsername(true);
    setUsernameError(null);
    setUsernameSuccess(false);
    try {
      const res = await fetch("/api/user/username", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUsernameError(data.error ?? "Failed to save username.");
      } else {
        setUsername(data.username);
        setUsernameSuccess(true);
        setEditingUsername(false);
      }
    } finally {
      setSavingUsername(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      const res = await fetch("/api/user/delete", { method: "DELETE" });
      if (res.ok) {
        window.location.href = "/";
      } else {
        const d = await res.json();
        alert(d.error ?? "Deletion failed. Please contact support.");
      }
    } finally {
      setDeleting(false);
    }
  }

  const isOwner = user.discordId === OWNER_ID;
  const isFreeUsername = usernameChangesUsed === 0 || !username;

  return (
    <div className="min-h-screen">
      <DashboardNav user={user} active="settings" />

      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="mt-2 text-sm text-text-muted">
            Manage connected accounts and notification preferences.
          </p>
        </div>

        {/* Google connection */}
        <GoogleConnectSection
          connected={google.connected}
          gaPropertyName={google.gaPropertyName}
          scSiteUrl={google.scSiteUrl}
        />

        {/* Shopify connection */}
        <ShopifyConnectSection connected={shopify.connected} shop={shopify.shop} />

        {/* Stripe connection */}
        <StripeConnectSection connected={stripe.connected} />

        {/* Notion connection */}
        <NotionConnectSection
          connected={notion.connected}
          workspaceName={notion.workspaceName}
          rootPageId={notion.rootPageId}
        />

        {/* Meta Ads connection */}
        <MetaConnectSection connected={meta.connected} accountName={meta.accountName} />

        {/* Username */}
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Username
          </h2>
          <div className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {username ? `@${username}` : <span className="text-text-muted">No username set</span>}
                </p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {isFreeUsername
                    ? "Your first username change is free."
                    : `Each change costs 1,000 credits. You have ${credits.toLocaleString()} credits.`}
                </p>
              </div>
              {!editingUsername && (
                <button
                  onClick={() => { setEditingUsername(true); setUsernameInput(username); setUsernameError(null); setUsernameSuccess(false); }}
                  className="shrink-0 rounded-md border border-bg-border px-3 py-1.5 text-sm text-text-muted transition hover:border-white/20 hover:text-text"
                >
                  {username ? "Change" : "Set username"}
                </button>
              )}
            </div>

            {editingUsername && (
              <div className="mt-4 space-y-3">
                <div>
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="Enter username (3-20 chars, a-z 0-9 _)"
                    className="input w-full"
                    maxLength={20}
                  />
                  {usernameError && <p className="mt-1.5 text-xs text-red-400">{usernameError}</p>}
                  {usernameSuccess && <p className="mt-1.5 text-xs text-green-400">Username saved successfully.</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={saveUsername}
                    disabled={savingUsername || !usernameInput.trim()}
                    className="rounded-md bg-white px-4 py-1.5 text-sm font-medium text-bg transition hover:bg-white/90 disabled:opacity-50"
                  >
                    {savingUsername ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => { setEditingUsername(false); setUsernameError(null); }}
                    className="rounded-md border border-bg-border px-4 py-1.5 text-sm text-text-muted transition hover:border-white/20 hover:text-text"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Privacy & Social */}
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Privacy &amp; Social
          </h2>
          <div className="card divide-y divide-bg-border">
            {SOCIAL_TOGGLES.map((item) => {
              const enabled = userPrefs ? userPrefs[item.key] : true;
              const busy = savingPref === item.key;
              return (
                <div key={item.key} className="flex items-center justify-between px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="mt-0.5 text-xs text-text-muted">{item.desc}</p>
                  </div>
                  <Toggle
                    enabled={enabled}
                    busy={busy || !userPrefs}
                    onChange={(v) => toggleUserPref(item.key, v)}
                  />
                </div>
              );
            })}
          </div>
        </section>

        {/* Mandatory notifications */}
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Notifications — always on
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

        {/* Toggleable notifications */}
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
                  <Toggle enabled={enabled} busy={busy || !prefs} onChange={(v) => toggle(item.key, v)} />
                </div>
              );
            })}
          </div>
        </section>

        {/* Owner-only */}
        {isOwner && (
          <section className="mb-8">
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
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="mt-0.5 text-xs text-text-muted">{item.desc}</p>
                    </div>
                    <Toggle enabled={enabled} busy={busy || !prefs} onChange={(v) => toggle(item.key, v)} />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Owner-only — Lead Extractor controls */}
        {isOwner && <OwnerLeadExtractorSettings initialRaiseBatch={leRaiseBatch} />}

        {/* Data & Privacy (GDPR) */}
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Data &amp; Privacy
          </h2>
          <div className="card divide-y divide-bg-border">
            {/* Data export */}
            <div className="flex items-start justify-between gap-4 px-5 py-4">
              <div>
                <p className="text-sm font-medium">Export your data</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  Download a full copy of your account data — profile, chat history, generations, and more.
                </p>
              </div>
              <a
                href="/api/user/export"
                download
                className="shrink-0 flex items-center gap-1.5 rounded-md border border-bg-border px-3 py-1.5 text-sm text-text-muted transition hover:border-white/20 hover:text-text"
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </a>
            </div>

            {/* Account deletion */}
            <div className="flex items-start justify-between gap-4 px-5 py-4">
              <div>
                <p className="text-sm font-medium text-red-400">Delete account</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  Permanently erase all your data. This cannot be undone.
                </p>
              </div>
              <button
                onClick={() => { setShowDeleteModal(true); setDeleteConfirm(""); }}
                className="shrink-0 flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-1.5 text-sm text-red-400 transition hover:border-red-500/60 hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          </div>
        </section>

        {/* Delete confirmation modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
            <div className="w-full max-w-sm rounded-2xl border border-red-500/20 bg-[#0d0d0d] p-6 shadow-2xl">
              <h3 className="text-base font-semibold text-red-400">Delete your account?</h3>
              <p className="mt-2 text-sm text-text-muted">
                This will permanently erase your profile, chat history, AI sessions, credits, and all generated content. It cannot be undone.
              </p>
              <p className="mt-4 text-sm text-text-muted">
                Type <span className="font-mono text-text">DELETE</span> to confirm:
              </p>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="input mt-2 w-full"
                placeholder="DELETE"
                autoFocus
              />
              <div className="mt-4 flex gap-2">
                <button
                  onClick={deleteAccount}
                  disabled={deleteConfirm !== "DELETE" || deleting}
                  className="flex-1 rounded-md bg-red-600 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-40"
                >
                  {deleting ? "Deleting…" : "Delete my account"}
                </button>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="rounded-md border border-bg-border px-4 py-2 text-sm text-text-muted transition hover:border-white/20 hover:text-text"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
