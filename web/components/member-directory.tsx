"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, ExternalLink, Lock } from "lucide-react";

type Member = {
  id: string;
  name: string;
  image: string | null;
  tier: string;
  niche: string | null;
  skills: string[];
  lookingFor: string[];
  canOffer: string[];
  socials: Record<string, string> | null;
};

const SOCIAL_DISPLAY: Record<string, { label: string; url: (v: string) => string }> = {
  twitter: {
    label: "Twitter",
    url: (v) => (v.startsWith("http") ? v : `https://x.com/${v.replace(/^@/, "")}`),
  },
  linkedin: { label: "LinkedIn", url: (v) => (v.startsWith("http") ? v : `https://${v}`) },
  github: { label: "GitHub", url: (v) => (v.startsWith("http") ? v : `https://${v}`) },
  instagram: {
    label: "Instagram",
    url: (v) => (v.startsWith("http") ? v : `https://instagram.com/${v.replace(/^@/, "")}`),
  },
  youtube: { label: "YouTube", url: (v) => (v.startsWith("http") ? v : `https://${v}`) },
  tiktok: {
    label: "TikTok",
    url: (v) => (v.startsWith("http") ? v : `https://tiktok.com/@${v.replace(/^@/, "")}`),
  },
  website: { label: "Website", url: (v) => (v.startsWith("http") ? v : `https://${v}`) },
};

export function MemberDirectory({ members, isPaid }: { members: Member[]; isPaid: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Member | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((m) => {
      const haystack = [
        m.name,
        m.niche ?? "",
        ...m.skills,
        ...m.lookingFor,
        ...m.canOffer,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [q, members]);

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          className="input pl-9"
          placeholder="Search names, niches, skills, what they offer…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-sm text-text-muted">No members match that search.</p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((m) => (
          <button
            key={m.id}
            onClick={() => setOpen(m)}
            className="card p-5 text-left transition hover:border-bg-border/80 hover:bg-bg-panel"
          >
            <div className="flex items-start gap-3">
              <Avatar name={m.name} image={m.image} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`truncate font-medium ${!isPaid ? "blur-sm select-none" : ""}`}>
                    {m.name}
                  </p>
                  <TierBadge tier={m.tier} />
                </div>
                {m.niche && (
                  <p className="mt-0.5 truncate text-xs text-text-muted">{m.niche}</p>
                )}
              </div>
            </div>

            {m.skills.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1">
                {m.skills.slice(0, 4).map((s) => (
                  <span
                    key={s}
                    className="rounded-md border border-bg-border bg-bg-elevated px-1.5 py-0.5 text-[10px] text-text-muted"
                  >
                    {s}
                  </span>
                ))}
                {m.skills.length > 4 && (
                  <span className="text-[10px] text-text-dim">+{m.skills.length - 4}</span>
                )}
              </div>
            )}
          </button>
        ))}
      </div>

      {open && (
        <MemberModal member={open} isPaid={isPaid} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

function MemberModal({
  member,
  isPaid,
  onClose,
}: {
  member: Member;
  isPaid: boolean;
  onClose: () => void;
}) {
  const socials = isPaid ? member.socials ?? {} : {};
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card-elevated relative max-h-[90vh] w-full max-w-lg overflow-y-auto p-6"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-text-muted hover:text-text"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="flex items-start gap-4">
          <Avatar name={member.name} image={member.image} size={56} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className={`text-lg font-semibold ${!isPaid ? "blur-sm select-none" : ""}`}>
                {member.name}
              </p>
              <TierBadge tier={member.tier} />
            </div>
            {member.niche && (
              <p className="mt-1 text-sm text-text-muted">{member.niche}</p>
            )}
          </div>
        </div>

        <ProfileSection title="Skills" items={member.skills} />
        <ProfileSection title="Looking for" items={member.lookingFor} />
        <ProfileSection title="Can offer" items={member.canOffer} />

        <div className="mt-6">
          <h3 className="mb-2 text-xs uppercase tracking-wide text-text-muted">Contact</h3>
          {!isPaid ? (
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <Lock className="h-4 w-4" /> Pro feature
              </div>
              <p className="mt-1 text-text-muted">
                Upgrade to see member contact info + AI-powered matchmaking.
              </p>
              <Link href="/pricing" className="btn-primary mt-3 w-fit">Upgrade</Link>
            </div>
          ) : Object.keys(socials).length === 0 ? (
            <p className="text-sm text-text-muted">No socials shared.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {Object.entries(socials).map(([k, v]) => {
                const def = SOCIAL_DISPLAY[k];
                if (!def) return null;
                return (
                  <li key={k}>
                    <a
                      href={def.url(v)}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-text underline-offset-4 hover:underline"
                    >
                      {def.label}: <span className="text-text-muted">{v}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-6">
      <h3 className="mb-2 text-xs uppercase tracking-wide text-text-muted">{title}</h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map((s) => (
          <span
            key={s}
            className="rounded-md border border-bg-border bg-bg-elevated px-2 py-0.5 text-xs"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function Avatar({ name, image, size = 40 }: { name: string; image: string | null; size?: number }) {
  if (image) {
    return (
      <Image
        src={image}
        alt={name}
        width={size}
        height={size}
        className="rounded-full"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-bg-elevated text-sm font-semibold text-text-muted"
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  if (tier === "FREE") return null;
  const cls = {
    PRO: "border-blue-500/40 bg-blue-500/10 text-blue-200",
    ELITE: "border-purple-500/40 bg-purple-500/10 text-purple-200",
    APEX: "border-yellow-500/40 bg-yellow-500/10 text-yellow-200",
  }[tier] ?? "border-bg-border";
  return (
    <span
      className={`rounded border px-1 py-0 text-[9px] font-semibold uppercase tracking-wider ${cls}`}
    >
      {tier}
    </span>
  );
}
