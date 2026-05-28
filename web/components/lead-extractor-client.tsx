"use client";

import { useState, useRef } from "react";
import {
  Search,
  Loader2,
  ExternalLink,
  Mail,
  Phone,
  Download,
  ClipboardPaste,
  Instagram,
  X,
  CheckCircle2,
  AlertCircle,
  Globe,
  Users,
} from "lucide-react";

type ExtractedLead = {
  handle: string;
  platform: "instagram" | "tiktok";
  profileUrl: string;
  name?: string;
  bio?: string;
  website?: string;
  followers?: number;
  emails: string[];
  phones: string[];
  sources: string[];
};

const CREDITS_PER = 20;

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" />
    </svg>
  );
}

function PlatformIcon({
  platform,
  className,
}: {
  platform: "instagram" | "tiktok";
  className?: string;
}) {
  return platform === "instagram" ? (
    <Instagram className={className} />
  ) : (
    <TikTokIcon className={className} />
  );
}

function parsePreview(raw: string): Array<{
  raw: string;
  platform: "instagram" | "tiktok" | null;
  handle: string | null;
  valid: boolean;
}> {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (/instagram\.com/i.test(line)) {
        const m = line.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
        if (m)
          return { raw: line, platform: "instagram" as const, handle: m[1].toLowerCase(), valid: true };
      }
      if (/tiktok\.com/i.test(line)) {
        const m = line.match(/tiktok\.com\/@?([A-Za-z0-9._]+)/i);
        if (m)
          return { raw: line, platform: "tiktok" as const, handle: m[1].toLowerCase(), valid: true };
      }
      return { raw: line, platform: null, handle: null, valid: false };
    });
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface LeadExtractorClientProps {
  userCredits: number;
  tier: string;
  maxAccounts: number;
  braveSearch: boolean;
  deepSearch: boolean;
}

export function LeadExtractorClient({
  userCredits,
  tier,
  maxAccounts,
  braveSearch,
  deepSearch,
}: LeadExtractorClientProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ExtractedLead[]>([]);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState(userCredits);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const preview = parsePreview(input);
  const validCount = Math.min(preview.filter((p) => p.valid).length, maxAccounts);
  const overLimit = preview.filter((p) => p.valid).length > maxAccounts;
  const cost = validCount * CREDITS_PER;

  async function handleExtract(e: React.FormEvent) {
    e.preventDefault();
    if (validCount === 0 || loading) return;

    setError(null);
    setResults([]);
    setInvalid([]);
    setLoading(true);
    setElapsed(0);

    // Tick timer so user can see progress
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);

    try {
      const accounts = preview.filter((p) => p.valid).map((p) => p.raw);
      const res = await fetch("/api/lead-extractor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accounts }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      setResults(data.results ?? []);
      setInvalid(data.invalid ?? []);
      setCredits((c) => c - (data.creditsUsed ?? cost));
    } catch {
      setError("Request failed. Please try again.");
    } finally {
      setLoading(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }

  function exportCSV() {
    const headers = [
      "Handle", "Platform", "Name", "Followers", "Website",
      "Emails", "Phones", "Bio", "Profile URL", "Sources",
    ];
    const rows = results.map((r) => [
      r.handle,
      r.platform,
      r.name ?? "",
      r.followers != null ? String(r.followers) : "",
      r.website ?? "",
      r.emails.join("; "),
      r.phones.join("; "),
      (r.bio ?? "").replace(/\n/g, " "),
      r.profileUrl,
      r.sources.join(", "),
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lead-extractor-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const withContact = results.filter((r) => r.emails.length > 0 || r.phones.length > 0).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lead Extractor</h1>
          <p className="mt-2 text-text-muted">
            Paste TikTok and Instagram profile URLs — Fortify researches each business and extracts contact details.
          </p>
        </div>
        <span className="w-fit rounded-md border border-bg-border bg-bg-panel px-3 py-1.5 text-sm tabular-nums">
          {credits.toLocaleString()} credits
        </span>
      </div>

      {/* Input form */}
      <form onSubmit={handleExtract} className="card p-5 space-y-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Paste profile URLs — one per line
            </label>
            <span className="text-xs text-text-dim">
              Up to {maxAccounts} accounts ({tier} plan)
            </span>
          </div>
          <textarea
            className="input w-full min-h-[180px] resize-y font-mono text-sm leading-relaxed"
            placeholder={
              "https://www.instagram.com/businessname\nhttps://www.tiktok.com/@businessname\nhttps://www.instagram.com/anotherbrand"
            }
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setResults([]);
              setError(null);
            }}
          />
        </div>

        {/* Live parse preview */}
        {preview.length > 0 && (
          <div className="rounded-lg border border-bg-border bg-bg-panel divide-y divide-bg-border overflow-hidden max-h-52 overflow-y-auto">
            {preview.map((p, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2">
                {p.valid ? (
                  <>
                    <PlatformIcon
                      platform={p.platform!}
                      className={`h-3.5 w-3.5 shrink-0 ${p.platform === "instagram" ? "text-pink-400" : "text-text-muted"}`}
                    />
                    <span className="text-xs font-medium text-text">@{p.handle}</span>
                    <span className="text-[11px] text-text-dim capitalize">{p.platform}</span>
                    <CheckCircle2 className="ml-auto h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                    <span className="text-xs text-text-dim truncate">{p.raw}</span>
                    <span className="ml-auto text-[11px] text-red-400 shrink-0">Unrecognised</span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {overLimit && (
          <div className="rounded-md border border-yellow-900/40 bg-yellow-950/20 px-3 py-2 text-sm text-yellow-300">
            Your {tier} plan allows {maxAccounts} accounts per batch. Only the first {maxAccounts} valid URLs will be processed.{" "}
            <a href="/pricing" className="underline hover:text-yellow-200">Upgrade</a> to process more.
          </div>
        )}

        <div className="flex items-center gap-4 flex-wrap">
          <button
            type="submit"
            disabled={loading || validCount === 0}
            className="btn-primary"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {loading
              ? `Researching… ${elapsed}s`
              : validCount > 0
              ? `Extract ${validCount} account${validCount !== 1 ? "s" : ""} · ${cost} credits`
              : "Extract contacts"}
          </button>
          {validCount > 0 && !loading && (
            <p className="text-xs text-text-dim">
              {preview.filter((p) => p.valid).length} valid · {preview.filter((p) => !p.valid && p.raw).length} unrecognised
            </p>
          )}
          {loading && (
            <p className="text-xs text-text-dim">
              This may take 30–90 seconds — researching websites and contacts for each account.
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
      </form>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="font-medium text-text">{results.length}</span>
              <span className="text-text-muted">accounts researched</span>
              <span className="text-text-dim">·</span>
              <span className="font-medium text-emerald-400">{withContact}</span>
              <span className="text-text-muted">with contact info found</span>
            </div>
            <button
              type="button"
              onClick={exportCSV}
              className="inline-flex items-center gap-1.5 rounded-lg border border-bg-border bg-bg-panel px-3 py-1.5 text-xs font-medium text-text-muted transition hover:border-white/20 hover:text-text"
            >
              <Download className="h-3 w-3" />
              Export CSV
            </button>
          </div>

          {invalid.length > 0 && (
            <div className="rounded-md border border-yellow-900/30 bg-yellow-950/20 px-3 py-2 text-xs text-yellow-300">
              {invalid.length} line{invalid.length !== 1 ? "s" : ""} skipped (not recognised as Instagram or TikTok URLs):{" "}
              {invalid.join(", ")}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {results.map((lead, i) => (
              <div key={i} className="card-elevated p-4 space-y-3">
                {/* Platform + handle header */}
                <div className="flex items-center gap-2.5">
                  <PlatformIcon
                    platform={lead.platform}
                    className={`h-4 w-4 shrink-0 ${lead.platform === "instagram" ? "text-pink-400" : "text-text-muted"}`}
                  />
                  <div className="min-w-0">
                    <a
                      href={lead.profileUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-medium text-text hover:underline text-sm"
                    >
                      {lead.name ?? `@${lead.handle}`}
                    </a>
                    {lead.name && (
                      <p className="text-[11px] text-text-dim">@{lead.handle}</p>
                    )}
                  </div>
                  {lead.followers != null && (
                    <span className="ml-auto shrink-0 flex items-center gap-1 text-[11px] text-text-dim">
                      <Users className="h-3 w-3" />
                      {formatFollowers(lead.followers)}
                    </span>
                  )}
                </div>

                {/* Bio */}
                {lead.bio && (
                  <p className="text-xs text-text-muted leading-relaxed line-clamp-2">
                    {lead.bio}
                  </p>
                )}

                {/* Website */}
                {lead.website && (
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1.5 text-[11px] text-text-dim hover:text-text transition truncate max-w-full"
                  >
                    <Globe className="h-3 w-3 shrink-0" />
                    {lead.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                  </a>
                )}

                {/* Contact info */}
                {(lead.emails.length > 0 || lead.phones.length > 0) ? (
                  <div className="space-y-1.5">
                    {lead.emails.map((email, ei) => (
                      <a
                        key={ei}
                        href={`mailto:${email}`}
                        className="flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/[0.07] px-2.5 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/10 transition"
                      >
                        <Mail className="h-3 w-3 shrink-0" />
                        {email}
                      </a>
                    ))}
                    {lead.phones.map((phone, pi) => (
                      <a
                        key={pi}
                        href={`tel:${phone.replace(/[\s\-]/g, "")}`}
                        className="flex items-center gap-1.5 rounded-md border border-blue-500/20 bg-blue-500/[0.07] px-2.5 py-1.5 text-xs text-blue-300 hover:bg-blue-500/10 transition"
                      >
                        <Phone className="h-3 w-3 shrink-0" />
                        {phone}
                      </a>
                    ))}
                    {lead.sources.length > 0 && (
                      <p className="text-[10px] text-text-dim pt-0.5">
                        Found via: {lead.sources.join(" + ")}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-xs text-text-dim">
                    No contact info found — check their website manually
                    {lead.website && (
                      <>
                        {" "}
                        <a
                          href={lead.website}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-text-muted hover:text-text underline"
                        >
                          here
                        </a>
                      </>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-0.5">
                  <a
                    href={lead.profileUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="btn-secondary inline-flex items-center gap-1.5 text-xs py-1 px-2.5"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Profile
                  </a>
                  {lead.emails.length > 0 && (
                    <a
                      href={`/dashboard/outreach?prospect=${encodeURIComponent(
                        `${lead.name ?? lead.handle} (${lead.emails[0]})`
                      )}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.10] bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-text-muted transition hover:border-white/20 hover:text-text"
                    >
                      Use in Outreach
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      {results.length === 0 && !loading && (
        <div className="card p-5 space-y-4">
          <p className="text-sm font-medium text-text-muted">How it works</p>
          <ol className="space-y-2 text-sm text-text-dim list-decimal list-inside">
            <li>Paste full Instagram and/or TikTok profile URLs — one per line</li>
            <li>Fortify fetches each profile to read the bio and find their linked website</li>
            <li>Scrapes the website for emails and phone numbers</li>
            {braveSearch && <li>Runs a targeted web search for any accounts still missing contact info</li>}
            {deepSearch && <li>Runs a second deeper search pass on all accounts to surface additional contacts</li>}
            <li>Results ready to export as CSV or send straight to Outreach</li>
          </ol>
          <p className="text-xs text-text-dim">
            {CREDITS_PER} credits per account · phones and emails included
          </p>

          {/* Tier comparison */}
          <div className="pt-1 border-t border-bg-border">
            <p className="text-xs font-medium text-text-muted mb-2">Plan limits</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                { name: "Pro", max: 10, brave: false, deep: false },
                { name: "Elite", max: 25, brave: true, deep: false },
                { name: "Apex", max: 50, brave: true, deep: true },
              ].map((t) => {
                const current = t.name.toUpperCase() === tier;
                return (
                  <div
                    key={t.name}
                    className={`rounded-lg border p-2.5 space-y-1 ${
                      current
                        ? "border-white/20 bg-white/[0.05]"
                        : "border-bg-border bg-bg-panel opacity-60"
                    }`}
                  >
                    <p className={`font-medium ${current ? "text-text" : "text-text-muted"}`}>
                      {t.name} {current && <span className="text-[10px] text-text-dim">(you)</span>}
                    </p>
                    <p className="text-text-dim">{t.max} accounts/batch</p>
                    <p className="text-text-dim">Bio + website scrape</p>
                    {t.brave && <p className="text-text-dim">Web search fallback</p>}
                    {t.deep && <p className="text-text-dim">Deep multi-pass search</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
