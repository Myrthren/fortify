"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { TagInput } from "./tag-input";

const SKILLS_SUGGESTIONS = [
  "Cold email", "SEO", "Paid ads", "Content marketing", "Copywriting",
  "No-code", "Product design", "UX/UI", "Web development", "Mobile development",
  "Python", "JavaScript", "TypeScript", "React", "Next.js", "Node.js",
  "Data analysis", "Machine learning", "AI/LLM integration", "Prompt engineering",
  "Sales", "Business development", "B2B sales", "Account management",
  "Growth hacking", "Community building", "Brand strategy", "PR",
  "Financial modelling", "Fundraising", "Pitch decks", "VC networks",
  "Operations", "Project management", "Recruiting", "HR",
  "Video editing", "Graphic design", "3D modelling", "Motion graphics",
  "Podcast production", "YouTube", "TikTok content", "Instagram growth",
  "Shopify", "E-commerce", "Dropshipping", "Amazon FBA",
  "Real estate", "Trading", "Crypto", "DeFi",
  "Public speaking", "Coaching", "Consulting",
];

const LOOKING_FOR_SUGGESTIONS = [
  "Co-founder", "Technical co-founder", "Business co-founder",
  "CTO", "Fractional CTO", "Lead developer", "Designer",
  "Marketing partner", "Sales partner", "Growth consultant",
  "Investors", "Angel investors", "VCs", "Pre-seed funding",
  "Advisors", "Mentors", "Industry experts",
  "Distribution partners", "Affiliate partners", "Integration partners",
  "Early customers", "Beta testers", "Product feedback",
  "Content creators", "Influencers", "Brand ambassadors",
  "Accountant", "Lawyer", "CFO", "Operations manager",
  "Community managers", "Customer support",
  "Design feedback", "Code review", "Copy review",
  "Social media help", "SEO help", "Paid ads help",
];

const CAN_OFFER_SUGGESTIONS = [
  "SEO audits", "Landing page reviews", "Funnel analysis",
  "Copywriting feedback", "Pitch deck review", "Business strategy calls",
  "Introductions to VCs", "Introductions to founders", "Warm intros",
  "Code review", "Technical advice", "Architecture review",
  "Design critique", "Brand feedback", "UX review",
  "Content strategy", "Social media advice", "Paid ads audits",
  "Cold email templates", "Sales process review", "CRM setup help",
  "Financial modelling", "Pricing strategy", "Go-to-market advice",
  "Community building advice", "Discord setup", "Notion templates",
  "Shopify setup", "E-commerce advice", "Amazon FBA guidance",
  "Recruiting advice", "Hiring frameworks", "Interview help",
  "Accountability partnership", "Weekly check-ins", "Mastermind group",
  "Product roadmap review", "Market research", "Competitor analysis",
];

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
          suggestions={SKILLS_SUGGESTIONS}
        />
      </div>

      <div>
        <Label>Looking for</Label>
        <p className="mb-2 text-xs text-text-muted">Who or what you'd love to find right now.</p>
        <TagInput
          value={lookingFor}
          onChange={setLookingFor}
          placeholder="e.g. fractional CTO, design feedback, distribution partners"
          suggestions={LOOKING_FOR_SUGGESTIONS}
        />
      </div>

      <div>
        <Label>Can offer</Label>
        <p className="mb-2 text-xs text-text-muted">Help, expertise, intros you can give.</p>
        <TagInput
          value={canOffer}
          onChange={setCanOffer}
          placeholder="e.g. SEO audits, intros to VCs, copywriting reviews"
          suggestions={CAN_OFFER_SUGGESTIONS}
        />
      </div>

      <div>
        <Label>Socials</Label>
        <p className="mb-2 text-xs text-text-muted">
          Visible to all members with an account.
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
