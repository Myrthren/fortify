"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { TagInput } from "./tag-input";

const SOCIAL_FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: "twitter", label: "Twitter / X", placeholder: "@yourhandle" },
  { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/you" },
  { key: "github", label: "GitHub", placeholder: "github.com/you" },
  { key: "instagram", label: "Instagram", placeholder: "@yourhandle" },
  { key: "youtube", label: "YouTube", placeholder: "youtube.com/@you" },
  { key: "tiktok", label: "TikTok", placeholder: "@yourhandle" },
  { key: "website", label: "Website", placeholder: "https://yoursite.com" },
];

type Profile = {
  niche: string | null;
  skills: string[];
  lookingFor: string[];
  canOffer: string[];
  socials: Record<string, string> | null;
};

export function ProfileEditor({ initial }: { initial: Profile | null }) {
  const router = useRouter();
  const [niche, setNiche] = useState(initial?.niche ?? "");
  const [skills, setSkills] = useState<string[]>(initial?.skills ?? []);
  const [lookingFor, setLookingFor] = useState<string[]>(initial?.lookingFor ?? []);
  const [canOffer, setCanOffer] = useState<string[]>(initial?.canOffer ?? []);
  const [socials, setSocials] = useState<Record<string, string>>(
    (initial?.socials as Record<string, string>) ?? {}
  );
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, skills, lookingFor, canOffer, socials }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <Label>Niche</Label>
        <p className="mb-2 text-xs text-text-muted">
          Your one-sentence positioning. e.g. "B2B SaaS founder · DevTools".
        </p>
        <input
          className="input"
          maxLength={80}
          placeholder="What do you do?"
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          disabled={pending}
        />
      </div>

      <div>
        <Label>Skills</Label>
        <p className="mb-2 text-xs text-text-muted">What you're good at.</p>
        <TagInput
          value={skills}
          onChange={setSkills}
          placeholder="e.g. cold email, no-code, growth loops"
        />
      </div>

      <div>
        <Label>Looking for</Label>
        <p className="mb-2 text-xs text-text-muted">Who or what you'd love to find right now.</p>
        <TagInput
          value={lookingFor}
          onChange={setLookingFor}
          placeholder="e.g. fractional CTO, design feedback, distribution partners"
        />
      </div>

      <div>
        <Label>Can offer</Label>
        <p className="mb-2 text-xs text-text-muted">Help, expertise, intros you can give.</p>
        <TagInput
          value={canOffer}
          onChange={setCanOffer}
          placeholder="e.g. SEO audits, intros to VCs, copywriting reviews"
        />
      </div>

      <div>
        <Label>Socials</Label>
        <p className="mb-2 text-xs text-text-muted">
          Visible to Pro+ members in the directory.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SOCIAL_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="block text-xs text-text-muted">{f.label}</label>
              <input
                className="input mt-1"
                placeholder={f.placeholder}
                value={socials[f.key] ?? ""}
                onChange={(e) =>
                  setSocials({ ...socials, [f.key]: e.target.value })
                }
                disabled={pending}
              />
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 border-t border-bg-border pt-5">
        <button onClick={save} disabled={pending} className="btn-primary">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Save profile
        </button>
        {saved && <span className="text-sm text-green-400">Saved</span>}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-text">{children}</label>
  );
}
