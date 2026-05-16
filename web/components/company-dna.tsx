"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Brain, Loader2, Globe, Instagram, Target, Users, Package, TrendingUp, Lightbulb, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";

type DnaEntry = {
  id: string;
  label: string;
  content: string;
  chars: number;
  createdAt: string;
};

type InputMode =
  | "manual"
  | "website"
  | "social"
  | "goals"
  | "audience"
  | "products"
  | "revenue"
  | "founders";

const MODES: { key: InputMode; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: "manual",   label: "Write",          icon: <Brain className="h-4 w-4" />,      desc: "Free-form context" },
  { key: "website",  label: "Scan website",   icon: <Globe className="h-4 w-4" />,      desc: "Extract info from your site" },
  { key: "social",   label: "Scan social",    icon: <Instagram className="h-4 w-4" />,  desc: "TikTok, YouTube, LinkedIn…" },
  { key: "goals",    label: "Goals",          icon: <Target className="h-4 w-4" />,     desc: "Business objectives" },
  { key: "audience", label: "Audience",       icon: <Users className="h-4 w-4" />,      desc: "Target customer profile" },
  { key: "products", label: "Products",       icon: <Package className="h-4 w-4" />,    desc: "Offerings & pricing" },
  { key: "revenue",  label: "Revenue model",  icon: <TrendingUp className="h-4 w-4" />, desc: "How you make money" },
  { key: "founders", label: "Founders",       icon: <Lightbulb className="h-4 w-4" />,  desc: "Team background & story" },
];

export function CompanyDna({ tier }: { tier: string }) {
  const [entries, setEntries] = useState<DnaEntry[]>([]);
  const [totalChars, setTotalChars] = useState(0);
  const [limit, setLimit] = useState(0);
  const [canUse, setCanUse] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<InputMode>("manual");
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Manual
  const [label, setLabel] = useState("");
  const [content, setContent] = useState("");

  // URL scan
  const [scanUrl, setScanUrl] = useState("");
  const [scannedLabel, setScannedLabel] = useState("");
  const [scannedContent, setScannedContent] = useState("");

  // Goals template
  const [goal3m, setGoal3m] = useState("");
  const [goal12m, setGoal12m] = useState("");
  const [revenueTarget, setRevenueTarget] = useState("");
  const [keyFocus, setKeyFocus] = useState("");

  // Audience template
  const [ageRange, setAgeRange] = useState("");
  const [location, setLocation] = useState("");
  const [demographic, setDemographic] = useState("");
  const [painPoints, setPainPoints] = useState("");
  const [desiredOutcome, setDesiredOutcome] = useState("");

  // Products template
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productUsp, setProductUsp] = useState("");
  const [productAudience, setProductAudience] = useState("");

  // Revenue model template
  const [chargeModel, setChargeModel] = useState("");
  const [avgValue, setAvgValue] = useState("");
  const [revenueStreams, setRevenueStreams] = useState("");

  // Founders template
  const [founderName, setFounderName] = useState("");
  const [founderBackground, setFounderBackground] = useState("");
  const [companyStory, setCompanyStory] = useState("");
  const [teamSize, setTeamSize] = useState("");

  useEffect(() => {
    fetch("/api/company-dna")
      .then((r) => r.json())
      .then((d) => {
        setEntries(d.entries ?? []);
        setTotalChars(d.totalChars ?? 0);
        setLimit(d.limit ?? 0);
        setCanUse(d.canUse ?? false);
        setLoading(false);
      });
  }, []);

  function resetForm() {
    setLabel(""); setContent("");
    setScanUrl(""); setScannedLabel(""); setScannedContent("");
    setGoal3m(""); setGoal12m(""); setRevenueTarget(""); setKeyFocus("");
    setAgeRange(""); setLocation(""); setDemographic(""); setPainPoints(""); setDesiredOutcome("");
    setProductName(""); setProductPrice(""); setProductUsp(""); setProductAudience("");
    setChargeModel(""); setAvgValue(""); setRevenueStreams("");
    setFounderName(""); setFounderBackground(""); setCompanyStory(""); setTeamSize("");
    setError(null);
  }

  async function scanProfile() {
    if (!scanUrl.trim()) { setError("Enter a URL first."); return; }
    setError(null);
    setScanning(true);
    setScannedLabel(""); setScannedContent("");
    try {
      const res = await fetch("/api/company-dna/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: scanUrl.trim(), mode }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Scan failed."); return; }
      setScannedLabel(data.label);
      setScannedContent(data.content);
    } finally {
      setScanning(false);
    }
  }

  function buildTemplateEntry(): { label: string; content: string } | null {
    if (mode === "goals") {
      const parts: string[] = [];
      if (goal3m)        parts.push(`3–6 month goal: ${goal3m}`);
      if (goal12m)       parts.push(`12-month goal: ${goal12m}`);
      if (revenueTarget) parts.push(`Revenue target: ${revenueTarget}`);
      if (keyFocus)      parts.push(`Key focus area: ${keyFocus}`);
      if (!parts.length) return null;
      return { label: "Business Goals", content: parts.join("\n") };
    }
    if (mode === "audience") {
      const parts: string[] = [];
      if (ageRange)       parts.push(`Age range: ${ageRange}`);
      if (location)       parts.push(`Location / market: ${location}`);
      if (demographic)    parts.push(`Demographics: ${demographic}`);
      if (painPoints)     parts.push(`Pain points: ${painPoints}`);
      if (desiredOutcome) parts.push(`What they want to achieve: ${desiredOutcome}`);
      if (!parts.length) return null;
      return { label: "Target Audience", content: parts.join("\n") };
    }
    if (mode === "products") {
      const parts: string[] = [];
      if (productName)     parts.push(`Product / service: ${productName}`);
      if (productPrice)    parts.push(`Price point: ${productPrice}`);
      if (productUsp)      parts.push(`Unique selling point: ${productUsp}`);
      if (productAudience) parts.push(`Who it's for: ${productAudience}`);
      if (!parts.length) return null;
      return { label: productName ? `Product – ${productName}` : "Product / Service", content: parts.join("\n") };
    }
    if (mode === "revenue") {
      const parts: string[] = [];
      if (chargeModel)    parts.push(`How we charge: ${chargeModel}`);
      if (avgValue)       parts.push(`Average transaction value: ${avgValue}`);
      if (revenueStreams)  parts.push(`Revenue streams: ${revenueStreams}`);
      if (!parts.length) return null;
      return { label: "Revenue Model", content: parts.join("\n") };
    }
    if (mode === "founders") {
      const parts: string[] = [];
      if (founderName)       parts.push(`Founder(s): ${founderName}`);
      if (founderBackground) parts.push(`Background: ${founderBackground}`);
      if (companyStory)      parts.push(`Company story: ${companyStory}`);
      if (teamSize)          parts.push(`Team size: ${teamSize}`);
      if (!parts.length) return null;
      return { label: "Founders & Team", content: parts.join("\n") };
    }
    return null;
  }

  async function save() {
    setError(null);

    let entryLabel = "";
    let entryContent = "";

    if (mode === "manual") {
      if (!label.trim() || !content.trim()) { setError("Both label and content are required."); return; }
      entryLabel = label.trim();
      entryContent = content.trim();
    } else if (mode === "website" || mode === "social") {
      if (!scannedContent) { setError("Scan a URL first."); return; }
      entryLabel = scannedLabel;
      entryContent = scannedContent;
    } else {
      const built = buildTemplateEntry();
      if (!built) { setError("Fill in at least one field."); return; }
      entryLabel = built.label;
      entryContent = built.content;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/company-dna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: entryLabel, content: entryContent }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setEntries((prev) => [...prev, data.entry]);
      setTotalChars(data.totalChars);
      resetForm();
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry(id: string) {
    if (!confirm("Remove this from your Company DNA? Fortify AI will forget this context.")) return;
    const res = await fetch("/api/company-dna", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (res.ok) {
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setTotalChars(data.totalChars);
    }
  }

  const pct = limit > 0 && limit < 999999 ? Math.min(100, Math.round((totalChars / limit) * 100)) : 0;
  const isUnlimited = limit >= 999999;

  if (!canUse) {
    return (
      <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-6">
        <div className="flex items-center gap-2 mb-2">
          <Brain className="h-5 w-5 text-yellow-400" />
          <h3 className="font-semibold">Company DNA</h3>
        </div>
        <p className="text-sm text-text-muted mb-4">
          Tell Fortify AI everything about your business. It will remember your context and give personalised advice. Available on Pro+.
        </p>
        <Link href="/pricing" className="btn-primary w-fit">Upgrade to Pro</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Memory bar */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-text-muted" />
            <span className="text-sm font-medium">Memory</span>
          </div>
          <span className="text-xs text-text-muted">
            {totalChars.toLocaleString()} / {isUnlimited ? "∞" : limit.toLocaleString()} chars
          </span>
        </div>
        {!isUnlimited && (
          <div className="h-1.5 overflow-hidden rounded-full bg-bg-elevated">
            <div
              className={`h-full rounded-full transition-all ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-400" : "bg-green-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        <p className="mt-2 text-xs text-text-muted">
          {isUnlimited ? "Unlimited memory (Apex)" : "Remove entries to free up space."}
        </p>
      </div>

      {/* Add entry */}
      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Add context
        </button>
      ) : (
        <div className="card p-5 space-y-5">
          {/* Mode selector */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted mb-3">How do you want to add context?</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  onClick={() => { setMode(m.key); setError(null); }}
                  className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition ${
                    mode === m.key
                      ? "border-white/20 bg-white/[0.06]"
                      : "border-bg-border bg-transparent hover:bg-white/[0.03]"
                  }`}
                >
                  <span className={mode === m.key ? "text-text" : "text-text-muted"}>{m.icon}</span>
                  <span className="text-xs font-medium leading-tight">{m.label}</span>
                  <span className="text-[10px] text-text-dim leading-tight">{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Manual write ── */}
          {mode === "manual" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-text-muted mb-1">Label</label>
                <input className="input w-full" placeholder="e.g. Business model, Target audience, Key products…" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-text-muted mb-1">Content</label>
                <textarea className="input w-full min-h-[100px]" placeholder="Write anything about your business…" value={content} onChange={(e) => setContent(e.target.value)} />
                <p className="mt-1 text-xs text-text-muted">{(label + content).length} chars</p>
              </div>
            </div>
          )}

          {/* ── Website scan ── */}
          {mode === "website" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-text-muted mb-1">Website URL</label>
                <div className="flex gap-2">
                  <input className="input flex-1" placeholder="https://yourwebsite.com" value={scanUrl} onChange={(e) => setScanUrl(e.target.value)} />
                  <button onClick={scanProfile} disabled={scanning} className="btn-secondary shrink-0">
                    {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Scan"}
                  </button>
                </div>
                <p className="mt-1 text-xs text-text-muted">We'll extract your business description, offering, and value props.</p>
              </div>
              {scannedContent && (
                <div className="rounded-lg border border-bg-border bg-bg-elevated p-4 space-y-2">
                  <p className="text-xs font-medium text-text-muted">Preview — will be saved as:</p>
                  <p className="text-sm font-semibold">{scannedLabel}</p>
                  <p className="text-xs text-text-muted whitespace-pre-wrap line-clamp-6">{scannedContent}</p>
                  <button onClick={() => { setScannedLabel(""); setScannedContent(""); }} className="text-xs text-text-muted hover:text-text transition">Clear</button>
                </div>
              )}
            </div>
          )}

          {/* ── Social media scan ── */}
          {mode === "social" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-text-muted mb-1">Social media profile URL</label>
                <div className="flex gap-2">
                  <input className="input flex-1" placeholder="https://tiktok.com/@yourhandle  or  youtube.com/@channel" value={scanUrl} onChange={(e) => setScanUrl(e.target.value)} />
                  <button onClick={scanProfile} disabled={scanning} className="btn-secondary shrink-0">
                    {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Scan"}
                  </button>
                </div>
                <p className="mt-1 text-xs text-text-muted">Works with TikTok, YouTube, LinkedIn, Instagram, X/Twitter, and more.</p>
              </div>
              {scannedContent && (
                <div className="rounded-lg border border-bg-border bg-bg-elevated p-4 space-y-2">
                  <p className="text-xs font-medium text-text-muted">Preview — will be saved as:</p>
                  <p className="text-sm font-semibold">{scannedLabel}</p>
                  <p className="text-xs text-text-muted whitespace-pre-wrap line-clamp-6">{scannedContent}</p>
                  <button onClick={() => { setScannedLabel(""); setScannedContent(""); }} className="text-xs text-text-muted hover:text-text transition">Clear</button>
                </div>
              )}
            </div>
          )}

          {/* ── Goals template ── */}
          {mode === "goals" && (
            <div className="space-y-3">
              <Field label="3–6 month goal" placeholder="e.g. Hit £10k MRR, launch v2, reach 5k followers" value={goal3m} onChange={setGoal3m} />
              <Field label="12-month goal" placeholder="e.g. £100k ARR, team of 5, enter US market" value={goal12m} onChange={setGoal12m} />
              <Field label="Monthly revenue target" placeholder="e.g. £5,000/month by Q3" value={revenueTarget} onChange={setRevenueTarget} />
              <Field label="Key focus area right now" placeholder="e.g. Retention, content, paid ads, partnerships" value={keyFocus} onChange={setKeyFocus} />
            </div>
          )}

          {/* ── Audience template ── */}
          {mode === "audience" && (
            <div className="space-y-3">
              <Field label="Age range" placeholder="e.g. 25–40" value={ageRange} onChange={setAgeRange} />
              <Field label="Location / market" placeholder="e.g. UK, US, English-speaking markets" value={location} onChange={setLocation} />
              <Field label="Job title / demographic" placeholder="e.g. E-commerce founders doing £200k–£2M revenue" value={demographic} onChange={setDemographic} />
              <Field label="Key pain points" placeholder="e.g. No time for marketing, can't scale, no consistent leads" value={painPoints} onChange={setPainPoints} />
              <Field label="What they want to achieve" placeholder="e.g. Consistent revenue, less stress, grow without hiring" value={desiredOutcome} onChange={setDesiredOutcome} />
            </div>
          )}

          {/* ── Products template ── */}
          {mode === "products" && (
            <div className="space-y-3">
              <Field label="Product / service name" placeholder="e.g. Fortify Pro, 1:1 Strategy Call" value={productName} onChange={setProductName} />
              <Field label="Price point" placeholder="e.g. £99/month, £497 one-time" value={productPrice} onChange={setProductPrice} />
              <Field label="Unique selling point" placeholder="e.g. The only tool that combines AI outreach + competitor intel" value={productUsp} onChange={setProductUsp} />
              <Field label="Who it's for" placeholder="e.g. E-commerce founders who want to scale faster" value={productAudience} onChange={setProductAudience} />
            </div>
          )}

          {/* ── Revenue model template ── */}
          {mode === "revenue" && (
            <div className="space-y-3">
              <Field label="How you charge" placeholder="e.g. Monthly SaaS subscription, one-time course, retainer" value={chargeModel} onChange={setChargeModel} />
              <Field label="Average transaction value" placeholder="e.g. £149/month per customer" value={avgValue} onChange={setAvgValue} />
              <Field label="Revenue streams" placeholder="e.g. SaaS subscriptions (70%), consulting (20%), affiliates (10%)" value={revenueStreams} onChange={setRevenueStreams} />
            </div>
          )}

          {/* ── Founders template ── */}
          {mode === "founders" && (
            <div className="space-y-3">
              <Field label="Founder name(s)" placeholder="e.g. John Smith" value={founderName} onChange={setFounderName} />
              <Field label="Background" placeholder="e.g. 5 years in paid media, previously scaled 3 e-com brands" value={founderBackground} onChange={setFounderBackground} />
              <Field label="Company story" placeholder="e.g. Started because I couldn't find a tool that did X…" value={companyStory} onChange={setCompanyStory} textarea />
              <Field label="Team size" placeholder="e.g. Solo founder, team of 4" value={teamSize} onChange={setTeamSize} />
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Save to DNA
            </button>
            <button onClick={() => { setShowForm(false); resetForm(); }} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Entries list */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-text-muted" /></div>
      ) : entries.length === 0 ? (
        <p className="text-center text-sm text-text-muted py-6">No context added yet. Tell Fortify AI about your business.</p>
      ) : (
        <div className="space-y-3">
          {entries.map((e) => {
            const isExpanded = expandedId === e.id;
            return (
              <div key={e.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <button
                    className="flex-1 min-w-0 text-left"
                    onClick={() => setExpandedId(isExpanded ? null : e.id)}
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{e.label}</p>
                      {isExpanded ? <ChevronUp className="h-3 w-3 text-text-muted shrink-0" /> : <ChevronDown className="h-3 w-3 text-text-muted shrink-0" />}
                    </div>
                    <p className={`mt-1 text-xs text-text-muted whitespace-pre-wrap ${isExpanded ? "" : "line-clamp-2"}`}>{e.content}</p>
                    <p className="mt-2 text-[10px] text-text-dim">{e.chars.toLocaleString()} chars · Added {new Date(e.createdAt).toLocaleDateString()}</p>
                  </button>
                  <button
                    onClick={() => removeEntry(e.id)}
                    className="shrink-0 text-text-dim hover:text-red-300 transition"
                    title="Remove from memory"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({
  label, placeholder, value, onChange, textarea,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-muted mb-1">{label}</label>
      {textarea ? (
        <textarea
          className="input w-full min-h-[80px]"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="input w-full"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
