"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StagePill, timeAgo } from "@/components/outbound-client";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Globe,
  Loader2,
  Mail,
  MapPin,
  RefreshCw,
  RotateCcw,
  Send,
  X,
} from "lucide-react";

type Opportunity = {
  title: string;
  evidence: string;
  impact: string;
  fortifyService: string;
  score: number;
};

type Email = {
  id: string;
  step: number;
  status: string;
  subject: string;
  body: string;
  wordCount: number | null;
  variation: Record<string, string | number> | null;
  scheduledAt: string | null;
  sentAt: string | null;
  openedAt: string | null;
  repliedAt: string | null;
  failReason: string | null;
};

type Lead = {
  id: string;
  company: string;
  website: string | null;
  domain: string | null;
  email: string | null;
  phone: string | null;
  contactName: string | null;
  industry: string | null;
  location: string | null;
  source: string | null;
  stage: string;
  analysis: Record<string, unknown> | null;
  opportunities: Opportunity[];
  opportunityScore: number | null;
  summary: string | null;
  suggestedService: string | null;
  scrapedPages: { url: string; title: string | null; chars: number }[];
  notes: string | null;
  disqualifiedReason: string | null;
  lastError: string | null;
  emailsSent: number;
  followUpStep: number;
  meetingBooked: boolean;
  replySentiment: string | null;
  repliedAt: string | null;
  nextActionAt: string | null;
  analysedAt: string | null;
  scrapedAt: string | null;
};

const DIMENSION_LABELS: Record<string, string> = {
  websiteQuality: "Website quality",
  leadCapture: "Lead capture",
  bookingSystem: "Booking system",
  contactForms: "Contact forms",
  crm: "CRM",
  chatbot: "Chatbot",
  automation: "Automation",
  manualWorkflows: "Manual workflows",
  marketing: "Marketing",
  seo: "SEO",
  customerExperience: "Customer experience",
};

export function OutboundLeadDetail({
  lead: initialLead,
  campaign,
  emails: initialEmails,
  events,
}: {
  lead: Lead;
  campaign: { id: string; name: string; maxFollowUps: number; autoSend: boolean };
  emails: Email[];
  events: { id: string; type: string; detail: string | null; createdAt: string }[];
}) {
  const router = useRouter();
  const [lead, setLead] = useState(initialLead);
  const [emails, setEmails] = useState(initialEmails);
  const [notes, setNotes] = useState(initialLead.notes ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replyBox, setReplyBox] = useState(false);
  const [replyText, setReplyText] = useState("");

  async function patchLead(body: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(`/api/outbound/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Update failed.");
        return null;
      }
      if (data.lead) setLead((prev) => ({ ...prev, ...data.lead }));
      router.refresh();
      return data;
    } catch {
      setError("Network error.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function emailAction(
    id: string,
    action: string,
    extra: Record<string, unknown> = {}
  ) {
    setBusy(id + action);
    setError(null);
    try {
      const res = await fetch(`/api/outbound/emails/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Action failed.");
        return;
      }
      if (data.email) {
        setEmails((prev) => {
          const exists = prev.some((e) => e.id === data.email.id);
          return exists
            ? prev.map((e) => (e.id === data.email.id ? { ...e, ...data.email } : e))
            : [...prev, data.email];
        });
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  }

  const analysis = lead.analysis ?? {};

  return (
    <div>
      <Link
        href="/dashboard/outbound"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-text-muted transition hover:text-text"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Outbound
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{lead.company}</h1>
          <StagePill stage={lead.stage} />
          {lead.meetingBooked && (
            <span className="rounded-full border border-border-strong bg-bg-elevated px-2 py-0.5 text-xs text-text">
              Meeting booked
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted">
          {lead.website && (
            <a
              href={lead.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 transition hover:text-text"
            >
              <Globe className="h-3.5 w-3.5" />
              {lead.domain ?? lead.website}
            </a>
          )}
          {lead.email && (
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              {lead.email}
            </span>
          )}
          {lead.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {lead.location}
            </span>
          )}
          <span className="text-text-dim">
            {campaign.name}
            {lead.source ? ` · via ${lead.source}` : ""}
          </span>
        </div>
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

      {lead.disqualifiedReason && (
        <div className="card mb-6 border-border-strong p-4">
          <div className="mb-1 flex items-center gap-2 text-sm font-medium">
            <Ban className="h-4 w-4 text-text-dim" />
            Ruled out
          </div>
          <p className="text-sm text-text-muted">{lead.disqualifiedReason}</p>
          <button
            onClick={() => patchLead({ action: "requeue" }, "requeue")}
            disabled={busy === "requeue"}
            className="btn-secondary mt-3 flex items-center gap-1.5 text-sm"
          >
            {busy === "requeue" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            Put back in the pipeline
          </button>
        </div>
      )}

      {/* Why this lead */}
      {lead.summary && (
        <section className="card mb-6 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="eyebrow">Why we could help</h2>
            {lead.opportunityScore != null && (
              <span className="text-sm tabular-nums text-text-muted">
                Score {lead.opportunityScore}/100
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed text-text-muted">{lead.summary}</p>
          {lead.suggestedService && (
            <p className="mt-3 text-sm">
              <span className="text-text-dim">Best fit: </span>
              <span className="font-medium">{lead.suggestedService}</span>
            </p>
          )}
        </section>
      )}

      {/* Opportunities */}
      {lead.opportunities.length > 0 && (
        <section className="mb-6">
          <h2 className="eyebrow mb-3">Problems found</h2>
          <div className="space-y-3">
            {lead.opportunities.map((o, i) => (
              <div key={i} className="card p-4">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{o.title}</h3>
                  <span className="rounded-full border border-border bg-bg-subtle px-2 py-0.5 text-xs text-text-dim">
                    {o.impact} impact
                  </span>
                  <span className="ml-auto text-xs tabular-nums text-text-dim">{o.score}</span>
                </div>
                <p className="mb-2 text-sm text-text-muted">{o.evidence}</p>
                <p className="text-xs text-text-dim">Fortify service: {o.fortifyService}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Website analysis */}
      {lead.analysedAt && (
        <section className="card mb-6 p-5">
          <h2 className="eyebrow mb-4">Website analysis</h2>
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {Object.entries(DIMENSION_LABELS).map(([key, label]) => {
              const a = analysis[key] as { rating?: number; note?: string } | undefined;
              if (!a || typeof a.rating !== "number") return null;
              return (
                <div key={key}>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{label}</span>
                    <Rating value={a.rating} />
                  </div>
                  {a.note && <p className="text-xs leading-relaxed text-text-dim">{a.note}</p>}
                </div>
              );
            })}
          </div>

          {lead.scrapedPages.length > 0 && (
            <div className="mt-5 border-t border-border pt-4">
              <p className="mb-2 text-xs text-text-dim">
                Read {lead.scrapedPages.length} page
                {lead.scrapedPages.length === 1 ? "" : "s"}
                {lead.scrapedAt ? ` ${timeAgo(lead.scrapedAt)}` : ""}
              </p>
              <ul className="space-y-1">
                {lead.scrapedPages.map((p) => (
                  <li key={p.url} className="truncate text-xs text-text-muted">
                    {p.title || p.url}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Emails */}
      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="eyebrow">Email history</h2>
          <span className="text-xs text-text-dim">
            {lead.emailsSent} sent
            {lead.nextActionAt && !lead.repliedAt
              ? ` · next action ${new Date(lead.nextActionAt).toLocaleDateString()}`
              : ""}
          </span>
        </div>

        {emails.length === 0 ? (
          <div className="card py-10 text-center text-sm text-text-muted">
            Nothing written yet.
          </div>
        ) : (
          <div className="space-y-3">
            {emails.map((e) => (
              <EmailCard
                key={e.id}
                email={e}
                busyKey={busy}
                onAction={(action, extra) => emailAction(e.id, action, extra)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Manual reply logging */}
      <section className="card mb-6 p-5">
        <h2 className="eyebrow mb-3">Log a reply</h2>
        {lead.repliedAt ? (
          <p className="text-sm text-text-muted">
            Replied {timeAgo(lead.repliedAt)}
            {lead.replySentiment ? ` — ${lead.replySentiment.toLowerCase()}` : ""}. The follow-up
            sequence has stopped.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-text-muted">
              Replies to the sending mailbox are picked up automatically. Paste one here only if it
              reached you some other way — forwarded, or sent to a different address. Either route
              classifies the reply and stops all further follow-ups to this lead.
            </p>
            {replyBox ? (
              <>
                <textarea
                  className="input min-h-[100px] resize-y"
                  value={replyText}
                  onChange={(ev) => setReplyText(ev.target.value)}
                  placeholder="Paste their reply..."
                />
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={async () => {
                      const ok = await patchLead(
                        { action: "log_reply", replyBody: replyText },
                        "reply"
                      );
                      if (ok) {
                        setReplyBox(false);
                        setReplyText("");
                      }
                    }}
                    disabled={busy === "reply" || !replyText.trim()}
                    className="btn-primary flex items-center gap-1.5 text-sm disabled:opacity-40"
                  >
                    {busy === "reply" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Log reply
                  </button>
                  <button onClick={() => setReplyBox(false)} className="btn-secondary text-sm">
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <button onClick={() => setReplyBox(true)} className="btn-secondary text-sm">
                Paste a reply
              </button>
            )}
          </>
        )}
      </section>

      {/* Notes */}
      <section className="card mb-6 p-5">
        <h2 className="eyebrow mb-3">Notes</h2>
        <textarea
          className="input min-h-[90px] resize-y"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything worth remembering about this lead."
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => patchLead({ notes }, "notes")}
            disabled={busy === "notes" || notes === (lead.notes ?? "")}
            className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-40"
          >
            {busy === "notes" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save notes
          </button>
          <button
            onClick={() => patchLead({ meetingBooked: !lead.meetingBooked }, "meeting")}
            disabled={busy === "meeting"}
            className="btn-secondary text-sm"
          >
            {lead.meetingBooked ? "Unmark meeting" : "Mark meeting booked"}
          </button>
          <button
            onClick={() => patchLead({ action: "unsubscribe" }, "unsub")}
            disabled={busy === "unsub"}
            className="ml-auto text-sm text-text-dim transition hover:text-red-400"
          >
            Add to do-not-contact
          </button>
        </div>
      </section>

      {/* Timeline */}
      <section>
        <h2 className="eyebrow mb-3">Timeline</h2>
        <div className="card divide-y divide-border">
          {events.length === 0 ? (
            <p className="p-4 text-sm text-text-muted">Nothing has happened yet.</p>
          ) : (
            events.map((ev) => (
              <div key={ev.id} className="flex items-start gap-3 px-4 py-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-border-strong" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm text-text-muted">{ev.detail ?? ev.type}</span>
                </div>
                <span className="shrink-0 text-xs text-text-dim">{timeAgo(ev.createdAt)}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function EmailCard({
  email,
  busyKey,
  onAction,
}: {
  email: Email;
  busyKey: string | null;
  onAction: (action: string, extra?: Record<string, unknown>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(email.subject);
  const [body, setBody] = useState(email.body);

  const pending = email.status === "DRAFT" || email.status === "QUEUED";
  const label = email.step === 0 ? "First email" : `Follow-up ${email.step}`;

  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="rounded-full border border-border bg-bg-subtle px-2 py-0.5 text-xs text-text-dim">
          {email.status.toLowerCase()}
        </span>
        {email.wordCount && (
          <span className="text-xs text-text-dim">{email.wordCount} words</span>
        )}
        <span className="ml-auto text-xs text-text-dim">
          {email.sentAt
            ? `sent ${timeAgo(email.sentAt)}`
            : email.scheduledAt
              ? `scheduled ${new Date(email.scheduledAt).toLocaleString()}`
              : "not sent"}
          {email.openedAt ? " · opened" : ""}
          {email.repliedAt ? " · replied" : ""}
        </span>
      </div>

      {editing ? (
        <>
          <input
            className="input mb-2"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <textarea
            className="input min-h-[180px] resize-y font-mono text-xs"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => {
                onAction("edit", { subject, body });
                setEditing(false);
              }}
              className="btn-primary text-sm"
            >
              Save
            </button>
            <button onClick={() => setEditing(false)} className="btn-secondary text-sm">
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-2 text-sm font-medium">{email.subject}</p>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-text-muted">
            {email.body}
          </pre>
        </>
      )}

      {email.failReason && (
        <p className="mt-3 text-xs text-red-400">{email.failReason}</p>
      )}

      {/* The variation dice for this email — makes it visible why no two match. */}
      {email.variation && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-text-dim hover:text-text-muted">
            How this one was shaped
          </summary>
          <dl className="mt-2 space-y-1 text-xs text-text-dim">
            {Object.entries(email.variation).map(([k, v]) => (
              <div key={k}>
                <dt className="inline capitalize">{k.replace(/([A-Z])/g, " $1")}: </dt>
                <dd className="inline text-text-muted">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}

      {pending && !editing && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
          <button
            onClick={() => onAction("approve")}
            disabled={busyKey === email.id + "approve"}
            className="btn-primary flex items-center gap-1.5 text-sm disabled:opacity-40"
          >
            {busyKey === email.id + "approve" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Approve and send
          </button>
          <button onClick={() => setEditing(true)} className="btn-secondary text-sm">
            Edit
          </button>
          <button
            onClick={() => onAction("regenerate")}
            disabled={busyKey === email.id + "regenerate"}
            className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-40"
          >
            {busyKey === email.id + "regenerate" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Rewrite
          </button>
          <button
            onClick={() => onAction("reject")}
            disabled={busyKey === email.id + "reject"}
            className="ml-auto text-sm text-text-dim transition hover:text-red-400"
          >
            Discard
          </button>
        </div>
      )}
    </div>
  );
}

/** Five dots, filled to the rating. Monochrome — no red/green scale. */
function Rating({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-1" title={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`h-1.5 w-1.5 rounded-full ${n <= value ? "bg-text" : "bg-border-strong"}`}
        />
      ))}
    </span>
  );
}
