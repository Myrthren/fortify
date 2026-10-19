"use client";

import { useState } from "react";
import { ChevronDown, Download, Globe, Loader2, Mail, MapPin, PackageOpen, Phone, Star } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { CopyButton } from "@/components/copy-button";
import type { PackLead } from "@/lib/lead-pack-core";

type Setting = {
  category: string;
  location: string;
  offer: string | null;
  enabled: boolean;
  pending: boolean;
  lastRunAt: string | null;
  lastError: string | null;
};

export type PackView = { id: string; category: string; location: string; createdAt: string; leads: PackLead[] };

const dateFmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

export function LeadPackClient({
  packSize,
  nextPackAt,
  initialSetting,
  packs,
}: {
  packSize: number;
  nextPackAt: string;
  initialSetting: Setting | null;
  packs: PackView[];
}) {
  const [setting, setSetting] = useState<Setting | null>(initialSetting);
  const [category, setCategory] = useState(initialSetting?.category ?? "");
  const [location, setLocation] = useState(initialSetting?.location ?? "");
  const [offer, setOffer] = useState(initialSetting?.offer ?? "");
  const [enabled, setEnabled] = useState(initialSetting?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(packs[0]?.id ?? null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/lead-pack", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, location, offer, enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not save your settings.");
      setSetting(data.setting);
      setMessage(
        !enabled ? "Saved. Weekly packs are paused."
          : data.queued ? "Saved. Your first pack is being put together and should arrive within about 30 minutes."
          : "Saved. Your next pack arrives on Monday.",
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const status = !setting ? null
    : !setting.enabled ? "Paused. Turn it back on to get a pack every Monday."
    : setting.pending ? "Your next pack is being put together now."
    : setting.lastRunAt ? `Last pack: ${dateFmt(setting.lastRunAt)}. Next pack: ${dateFmt(nextPackAt)}.`
    : "Your first pack is queued and should arrive within about 30 minutes.";

  return (
    <div>
      <PageHeader
        eyebrow="Leads & Outreach"
        icon={PackageOpen}
        title="Weekly Lead Pack"
        subtitle={`Every Monday, ${packSize} new local businesses that fit who you sell to, with published emails and a cold email drafted for each. Included in your plan, no credits used.`}
      />

      <form onSubmit={save} className="card mb-8 space-y-4 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-text-muted">Businesses to find</span>
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. dental clinics" className="input mt-1.5 w-full" maxLength={80} required />
          </label>
          <label className="block text-sm">
            <span className="text-text-muted">Where</span>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Manchester, UK" className="input mt-1.5 w-full" maxLength={80} required />
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-text-muted">What you offer them <span className="text-text-dim">(optional, otherwise taken from your Company DNA)</span></span>
          <textarea value={offer} onChange={(e) => setOffer(e.target.value)} rows={3} maxLength={1500} placeholder="e.g. I build booking websites for clinics: £400, live in a week." className="input mt-1.5 w-full resize-y" />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-text-muted">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Send me a pack every Monday
          </label>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} {setting ? "Save" : "Start my weekly pack"}
          </button>
        </div>
        {message && <p className="text-sm text-text">{message}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {!message && status && <p className="text-sm text-text-muted">{status}</p>}
        {setting?.lastError && <p className="text-sm text-text-muted">Note: {setting.lastError}</p>}
      </form>

      {packs.length === 0 ? (
        <div className="card p-8 text-center text-sm text-text-muted">
          {setting ? "Your packs will appear here." : "Set who to find and where, and your first pack arrives within about 30 minutes."}
        </div>
      ) : (
        <div className="space-y-3">
          {packs.map((pack) => (
            <PackCard key={pack.id} pack={pack} open={open === pack.id} onToggle={() => setOpen(open === pack.id ? null : pack.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function PackCard({ pack, open, onToggle }: { pack: PackView; open: boolean; onToggle: () => void }) {
  const drafted = pack.leads.filter((l) => l.draft).length;
  const withEmail = pack.leads.filter((l) => l.emails?.length).length;

  function exportCSV() {
    const headers = ["Name", "Category", "Address", "Phone", "Website", "Emails", "Rating", "Reviews", "Draft"];
    const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = pack.leads.map((l) => [l.title, l.category, l.address, l.phone, l.url, l.emails?.join("; "), l.rating, l.reviewsCount, l.draft].map(cell).join(","));
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `lead-pack-${pack.createdAt.slice(0, 10)}-${pack.category.replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div id={pack.id} className="card overflow-hidden">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
        <div>
          <p className="font-medium">{dateFmt(pack.createdAt)}</p>
          <p className="mt-0.5 text-xs text-text-muted">
            {pack.leads.length} {pack.category} in {pack.location} · {withEmail} with email · {drafted} drafted
          </p>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-bg-border">
          <div className="flex justify-end px-5 pt-3">
            <button type="button" onClick={exportCSV} className="btn-secondary text-xs">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
          <ul className="divide-y divide-bg-border/60">
            {pack.leads.map((lead, i) => (
              <li key={`${lead.title}-${i}`} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{lead.title}</p>
                  {lead.rating ? (
                    <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                      <Star className="h-3 w-3" /> {lead.rating}{lead.reviewsCount ? ` (${lead.reviewsCount})` : ""}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                  {lead.address && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {lead.address}</span>}
                  {lead.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {lead.phone}</span>}
                  {lead.url && (
                    <a href={lead.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:text-text hover:underline">
                      <Globe className="h-3 w-3" /> Website
                    </a>
                  )}
                  {lead.emails?.map((email) => (
                    <a key={email} href={`mailto:${email}`} className="inline-flex items-center gap-1 underline-offset-2 hover:text-text hover:underline">
                      <Mail className="h-3 w-3" /> {email}
                    </a>
                  ))}
                </div>
                {lead.draft && (
                  <div className="mt-3 rounded-lg border border-bg-border bg-bg-subtle p-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-text-dim">Draft email</span>
                      <CopyButton text={lead.draft} />
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-text-muted">{lead.draft}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
