"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TierBadge } from "@/components/tier-badge";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Pause,
  Play,
  Plus,
  Send,
  Trash2,
  X,
  Zap,
} from "lucide-react";

type Campaign = {
  id: string;
  name: string;
  status: string;
  targetQuery: string | null;
  industry: string | null;
  location: string | null;
  offer: string | null;
  senderName: string | null;
  senderEmail: string | null;
  senderTitle: string | null;
  brandVoiceId: string | null;
  discoveryProvider: string;
  sendProvider: string;
  dailySendCap: number;
  sendWindowStartUtc: number;
  sendWindowEndUtc: number;
  sendOnWeekends: boolean;
  autoSend: boolean;
  maxFollowUps: number;
  minOpportunityScore: number;
  leadTarget: number;
  leadCount: number;
  lastTickAt: string | null;
  lastError: string | null;
};

type Lead = {
  id: string;
  company: string;
  website: string | null;
  email: string | null;
  contactName: string | null;
  industry: string | null;
  location: string | null;
  stage: string;
  opportunityScore: number | null;
  suggestedService: string | null;
  emailsSent: number;
  replySentiment: string | null;
  meetingBooked: boolean;
  lastSentAt: string | null;
  updatedAt: string;
  campaignId: string;
};

type Stats = {
  leads: number;
  emailsGenerated: number;
  emailsSent: number;
  opened: number;
  replies: number;
  positiveReplies: number;
  meetings: number;
  bounced: number;
  stages: Record<string, number>;
};

type ProviderInfo = { key: string; label: string; available: boolean };
type Providers = {
  discovery: ProviderInfo[];
  scrape: ProviderInfo[];
  analysis: ProviderInfo[];
  compose: ProviderInfo[];
  send: ProviderInfo[];
};

export function OutboundClient({
  campaigns: initialCampaigns,
  voices,
  stats,
  leads,
  providers,
  tracking,
}: {
  campaigns: Campaign[];
  voices: { id: string; name: string }[];
  stats: Stats;
  leads: Lead[];
  providers: Providers;
  tracking: { opens: boolean; bounces: boolean };
}) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const visibleLeads = useMemo(
    () => (filter === "all" ? leads : leads.filter((l) => l.stage === filter)),
    [leads, filter]
  );

  async function patchCampaign(id: string, body: Record<string, unknown>) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/outbound/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError((await res.text()) || "Update failed.");
        return;
      }
      const data = await res.json();
      setCampaigns((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...data.campaign, leadCount: c.leadCount } : c))
      );
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  }

  async function runNow(id: string) {
    setBusy(id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/outbound/campaigns/${id}/run`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Run failed.");
        return;
      }
      const r = data.result ?? {};
      const parts = [
        r.discovered ? `${r.discovered} found` : null,
        r.scraped ? `${r.scraped} analysed for signals` : null,
        r.analysed ? `${r.analysed} researched` : null,
        r.drafted ? `${r.drafted} written` : null,
        r.sent ? `${r.sent} sent` : null,
      ].filter(Boolean);
      setNotice(
        parts.length
          ? `Run complete — ${parts.join(", ")}.`
          : r.skippedSend
            ? `Nothing to do right now (${r.skippedSend}).`
            : "Run complete — nothing was due."
      );
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteCampaign(id: string) {
    if (!confirm("Delete this campaign and every lead in it? This cannot be undone.")) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/outbound/campaigns/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setError((await res.text()) || "Delete failed.");
        return;
      }
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  }

  const sendRate = (n: number) =>
    stats.emailsSent > 0 ? `${Math.round((n / stats.emailsSent) * 100)}%` : "—";

  return (
    <div>
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Outbound Engine</h1>
            <TierBadge tier="ELITE" />
          </div>
          <p className="max-w-2xl text-text-muted">
            Finds businesses, reads their websites, works out where you could genuinely help, and
            writes every email from scratch. Runs every 15 minutes on its own.
          </p>
        </div>
        <button
          onClick={() => {
            setShowNew(true);
            setError(null);
          }}
          className="btn-primary flex shrink-0 items-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          New campaign
        </button>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {notice && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-border-strong bg-bg-elevated px-4 py-3 text-sm text-text-muted">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-text" />
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Metrics */}
      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Leads found" value={stats.leads} />
        <Metric label="Emails written" value={stats.emailsGenerated} />
        <Metric label="Emails sent" value={stats.emailsSent} />
        <Metric label="Replies" value={stats.replies} />
        <Metric label="Meetings booked" value={stats.meetings} />
        <Metric
          label="Open rate"
          value={tracking.opens ? sendRate(stats.opened) : "—"}
          hint={
            !tracking.opens
              ? "your sender does not report opens"
              : stats.emailsSent < 20
                ? "too few sends to read into"
                : undefined
          }
        />
        <Metric
          label="Reply rate"
          value={sendRate(stats.replies)}
          hint={stats.emailsSent < 20 ? "too few sends to read into" : undefined}
        />
        <Metric
          label="Bounce rate"
          value={tracking.bounces ? sendRate(stats.bounced) : "—"}
          warn={
            tracking.bounces &&
            stats.emailsSent >= 20 &&
            stats.bounced / Math.max(1, stats.emailsSent) > 0.03
          }
          hint={
            !tracking.bounces
              ? "bounces arrive in your mailbox, not here"
              : stats.emailsSent >= 20 && stats.bounced / Math.max(1, stats.emailsSent) > 0.03
                ? "above 3% — pause and check your list"
                : undefined
          }
        />
      </div>

      {/* Campaigns */}
      <h2 className="eyebrow mb-3">Campaigns</h2>
      {campaigns.length === 0 ? (
        <div className="card mb-10 flex flex-col items-center justify-center py-16 text-center">
          <Send className="mb-4 h-10 w-10 text-text-dim" />
          <h3 className="mb-1 text-lg font-semibold">No campaigns yet</h3>
          <p className="mb-6 max-w-sm text-sm text-text-muted">
            A campaign is a target, an offer, and a sending inbox. The engine handles everything
            after that.
          </p>
          <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-1.5">
            <Plus className="h-4 w-4" />
            Create your first campaign
          </button>
        </div>
      ) : (
        <div className="mb-10 space-y-3">
          {campaigns.map((c) => (
            <div key={c.id} className="card p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold leading-tight">{c.name}</h3>
                    <StatusPill status={c.status} />
                    {c.autoSend ? (
                      <span className="rounded-full border border-border-strong bg-bg-elevated px-2 py-0.5 text-xs text-text-muted">
                        Sends automatically
                      </span>
                    ) : (
                      <span className="rounded-full border border-border-strong bg-bg-elevated px-2 py-0.5 text-xs text-text-muted">
                        Drafts wait for you
                      </span>
                    )}
                  </div>

                  <p className="mb-3 text-sm text-text-muted">
                    {[c.targetQuery, c.location].filter(Boolean).join(" · ") ||
                      "No target set"}
                  </p>

                  <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-text-dim">
                    <Fact label="Leads" value={`${c.leadCount} / ${c.leadTarget}`} />
                    <Fact label="Daily cap" value={String(c.dailySendCap)} />
                    <Fact
                      label="Window"
                      value={`${pad(c.sendWindowStartUtc)}:00–${pad(c.sendWindowEndUtc)}:00 UTC`}
                    />
                    <Fact label="Follow-ups" value={String(c.maxFollowUps)} />
                    <Fact label="From" value={c.senderEmail ?? "not set"} />
                    {c.lastTickAt && (
                      <Fact label="Last run" value={timeAgo(c.lastTickAt)} />
                    )}
                  </dl>

                  {c.lastError && (
                    <p className="mt-3 flex items-start gap-1.5 text-xs text-red-400">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {c.lastError}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => runNow(c.id)}
                    disabled={busy === c.id || c.status === "ARCHIVED"}
                    className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-40"
                    title="Advance this campaign one step now"
                  >
                    {busy === c.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Zap className="h-3.5 w-3.5" />
                    )}
                    Run now
                  </button>
                  <button
                    onClick={() =>
                      patchCampaign(c.id, {
                        status: c.status === "ACTIVE" ? "PAUSED" : "ACTIVE",
                      })
                    }
                    disabled={busy === c.id}
                    className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-40"
                  >
                    {c.status === "ACTIVE" ? (
                      <>
                        <Pause className="h-3.5 w-3.5" /> Pause
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" /> Activate
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => deleteCampaign(c.id)}
                    disabled={busy === c.id}
                    className="rounded-lg border border-border-strong p-2 text-text-dim transition hover:text-red-400 disabled:opacity-40"
                    title="Delete campaign"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Leads */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="eyebrow">Leads</h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-border-strong bg-bg-elevated px-2 py-1 text-xs text-text-muted"
        >
          <option value="all">All stages</option>
          {STAGE_ORDER.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]} ({stats.stages[s] ?? 0})
            </option>
          ))}
        </select>
      </div>

      {visibleLeads.length === 0 ? (
        <div className="card py-12 text-center text-sm text-text-muted">
          {leads.length === 0
            ? "No leads yet. Activate a campaign and the engine will start sourcing."
            : "No leads at this stage."}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-dim">
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">Best fit</th>
                <th className="px-4 py-3 font-medium">Sent</th>
                <th className="px-4 py-3 font-medium">Reply</th>
              </tr>
            </thead>
            <tbody>
              {visibleLeads.map((l) => (
                <tr
                  key={l.id}
                  className="border-b border-border/60 transition last:border-0 hover:bg-bg-elevated/50"
                >
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/outbound/${l.id}`} className="block">
                      <span className="font-medium text-text">{l.company}</span>
                      <span className="block text-xs text-text-dim">
                        {l.email ?? l.website ?? "no contact yet"}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StagePill stage={l.stage} />
                  </td>
                  <td className="px-4 py-3 tabular-nums text-text-muted">
                    {l.opportunityScore ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-text-muted">{l.suggestedService ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-text-muted">{l.emailsSent}</td>
                  <td className="px-4 py-3">
                    {l.meetingBooked ? (
                      <span className="text-text">Meeting booked</span>
                    ) : l.replySentiment ? (
                      <span className="text-text-muted">{titleCase(l.replySentiment)}</span>
                    ) : (
                      <span className="text-text-dim">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNew && (
        <NewCampaignModal
          voices={voices}
          providers={providers}
          onClose={() => setShowNew(false)}
          onCreated={(c) => {
            setCampaigns((prev) => [{ ...c, leadCount: 0 }, ...prev]);
            setShowNew(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ─── Pieces ───────────────────────────────────────────────

function Metric({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: number | string;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <div className="card p-4">
      <div className="eyebrow mb-1 text-text-dim">{label}</div>
      <div
        className={`text-2xl font-bold tabular-nums tracking-tight ${warn ? "text-red-400" : ""}`}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      {hint && <div className="mt-1 text-xs text-text-dim">{hint}</div>}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="inline text-text-dim">{label}: </dt>
      <dd className="inline text-text-muted">{value}</dd>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const live = status === "ACTIVE";
  return (
    <span
      className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${
        live
          ? "border-border-strong bg-bg-elevated text-text"
          : "border-border bg-bg-subtle text-text-dim"
      }`}
    >
      {live && <span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" />}
      {titleCase(status)}
    </span>
  );
}

const STAGE_ORDER = [
  "DISCOVERED",
  "SCRAPED",
  "ANALYSED",
  "DRAFTED",
  "QUEUED",
  "SENT",
  "REPLIED",
  "BOUNCED",
  "UNSUBSCRIBED",
  "DISQUALIFIED",
];

const STAGE_LABELS: Record<string, string> = {
  DISCOVERED: "Found",
  SCRAPED: "Site read",
  ANALYSED: "Researched",
  DRAFTED: "Draft ready",
  QUEUED: "Queued",
  SENT: "Sent",
  REPLIED: "Replied",
  BOUNCED: "Bounced",
  UNSUBSCRIBED: "Opted out",
  DISQUALIFIED: "Ruled out",
};

export function StagePill({ stage }: { stage: string }) {
  const muted = ["DISQUALIFIED", "BOUNCED", "UNSUBSCRIBED"].includes(stage);
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs ${
        muted
          ? "border-border bg-bg-subtle text-text-dim"
          : "border-border-strong bg-bg-elevated text-text-muted"
      }`}
    >
      {STAGE_LABELS[stage] ?? titleCase(stage)}
    </span>
  );
}

function NewCampaignModal({
  voices,
  providers,
  onClose,
  onCreated,
}: {
  voices: { id: string; name: string }[];
  providers: Providers;
  onClose: () => void;
  onCreated: (c: Campaign) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    targetQuery: "",
    location: "",
    industry: "",
    offer: "",
    senderName: "",
    senderEmail: "",
    senderTitle: "",
    brandVoiceId: "",
    discoveryProvider: providers.discovery.find((p) => p.available)?.key ?? "google-maps",
    sendProvider: providers.send.find((p) => p.available)?.key ?? "resend",
    dailySendCap: 30,
    leadTarget: 100,
    maxFollowUps: 3,
    minOpportunityScore: 40,
    autoSend: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form, v: string | number | boolean) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/outbound/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, brandVoiceId: form.brandVoiceId || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? (await Promise.resolve("Could not create the campaign.")));
        return;
      }
      onCreated(data.campaign);
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 py-10 backdrop-blur-sm">
      <div className="card w-full max-w-2xl p-6">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold tracking-tight">New campaign</h3>
            <p className="mt-1 text-sm text-text-muted">
              It starts paused. Nothing is sent until you activate it.
            </p>
          </div>
          <button onClick={onClose} className="text-text-dim hover:text-text">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <Field label="Campaign name" hint="Just for you.">
            <input
              className="input"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Manchester dentists — Q3"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Who to target" hint="Described the way you would say it out loud.">
              <input
                className="input"
                value={form.targetQuery}
                onChange={(e) => set("targetQuery", e.target.value)}
                placeholder="dental practices"
              />
            </Field>
            <Field label="Where">
              <input
                className="input"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="Manchester, UK"
              />
            </Field>
          </div>

          <Field
            label="What you are offering"
            hint="The engine judges every opportunity it finds against this, so be specific."
          >
            <textarea
              className="input min-h-[80px] resize-y"
              value={form.offer}
              onChange={(e) => set("offer", e.target.value)}
              placeholder="We build automations that remove manual admin — booking confirmations, enquiry routing, follow-up sequences. Typically saves a small team 5-10 hours a week."
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Your name">
              <input
                className="input"
                value={form.senderName}
                onChange={(e) => set("senderName", e.target.value)}
                placeholder="Kene"
              />
            </Field>
            <Field label="Your role">
              <input
                className="input"
                value={form.senderTitle}
                onChange={(e) => set("senderTitle", e.target.value)}
                placeholder="Founder, Fortify"
              />
            </Field>
            <Field label="Send from">
              <input
                className="input"
                value={form.senderEmail}
                onChange={(e) => set("senderEmail", e.target.value)}
                placeholder="kene@fortify-io.com"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Find leads with">
              <select
                className="input"
                value={form.discoveryProvider}
                onChange={(e) => set("discoveryProvider", e.target.value)}
              >
                {providers.discovery.map((p) => (
                  <option key={p.key} value={p.key} disabled={!p.available}>
                    {p.label}
                    {p.available ? "" : " — not configured"}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Send with"
              hint={
                form.sendProvider === "smtp"
                  ? "Sends from your own mailbox, so outreach complaints cannot hurt the sender that carries Fortify's account emails. No open tracking, and bounces land in that mailbox rather than here."
                  : "Reports opens, bounces and replies automatically. Shares sender reputation with Fortify's own account emails."
              }
            >
              <select
                className="input"
                value={form.sendProvider}
                onChange={(e) => set("sendProvider", e.target.value)}
              >
                {providers.send.map((p) => (
                  <option key={p.key} value={p.key} disabled={!p.available}>
                    {p.label}
                    {p.available ? "" : " — not configured"}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {voices.length > 0 && (
            <Field label="Write in a brand voice" hint="Optional. Uses your trained voice profile.">
              <select
                className="input"
                value={form.brandVoiceId}
                onChange={(e) => set("brandVoiceId", e.target.value)}
              >
                <option value="">Default voice</option>
                {voices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Emails / day">
              <input
                type="number"
                className="input"
                value={form.dailySendCap}
                onChange={(e) => set("dailySendCap", Number(e.target.value))}
                min={1}
                max={500}
              />
            </Field>
            <Field label="Lead target">
              <input
                type="number"
                className="input"
                value={form.leadTarget}
                onChange={(e) => set("leadTarget", Number(e.target.value))}
                min={1}
                max={2000}
              />
            </Field>
            <Field label="Follow-ups">
              <input
                type="number"
                className="input"
                value={form.maxFollowUps}
                onChange={(e) => set("maxFollowUps", Number(e.target.value))}
                min={0}
                max={6}
              />
            </Field>
            <Field label="Min. score">
              <input
                type="number"
                className="input"
                value={form.minOpportunityScore}
                onChange={(e) => set("minOpportunityScore", Number(e.target.value))}
                min={0}
                max={100}
              />
            </Field>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-strong bg-bg-elevated p-3">
            <input
              type="checkbox"
              checked={form.autoSend}
              onChange={(e) => set("autoSend", e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-sm">
              <span className="font-medium">Send without asking me</span>
              <span className="mt-0.5 block text-xs text-text-muted">
                Leave this off to review every email first. Drafts that fail the quality checks
                always wait for you either way.
              </span>
            </span>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || !form.name.trim() || !form.senderEmail.trim()}
            className="btn-primary flex items-center gap-1.5 disabled:opacity-40"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Create campaign
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-text-dim">{hint}</span>}
    </label>
  );
}

// ─── helpers ──────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
