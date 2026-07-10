import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight, Sparkles, Zap, Bot, Network, Radar, ShieldCheck,
  Workflow, Users, LineChart, Search,
} from "lucide-react";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";

export default function HomePage() {
  return (
    <>
      <Nav />

      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative overflow-hidden border-b border-bg-border">
        {/* Ambient background */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="aurora aurora-violet left-1/2 top-[-10%] h-[520px] w-[520px] -translate-x-1/2" />
          <div className="aurora aurora-indigo left-[15%] top-[20%] h-[360px] w-[360px]" />
          <div className="aurora aurora-white right-[12%] top-[8%] h-[300px] w-[300px]" />
        </div>
        <div className="bg-grid-fade absolute inset-0" />

        <div className="relative mx-auto max-w-4xl px-4 pt-14 pb-20 text-center sm:px-6 sm:pt-20 sm:pb-28">
          {/* Energy core centerpiece */}
          <div className="anim-fade-up mb-10 flex justify-center">
            <div className="core">
              <div className="core-ring" />
              <div className="core-ring-2" />
              <div className="core-bloom" />
              <div className="core-sonar" />
              <div className="core-sonar s2" />
              <div className="core-sonar s3" />
              <div className="orbit"><span className="orbit-dot" /></div>
              <div className="orbit orbit-rev"><span className="orbit-dot" style={{ background: "var(--accent)" }} /></div>
              <div className="core-disc">
                <Image src="/fortify-mark.png" alt="Fortify" width={62} height={62} priority />
              </div>
            </div>
          </div>

          <div className="anim-fade-up anim-d1 mb-6 inline-flex items-center gap-2 rounded-full border border-bg-border bg-bg-panel/70 px-3 py-1 text-xs text-text-muted backdrop-blur">
            <span className="dot-live h-1.5 w-1.5 rounded-full bg-green-400" />
            Built for the Fortune Fortress
          </div>

          <h1 className="anim-fade-up anim-d2 text-balance text-4xl font-bold tracking-tight sm:text-6xl">
            The AI co-pilot for<br className="hidden sm:inline" />{" "}
            <span className="text-shine">online business.</span>
          </h1>

          <p className="anim-fade-up anim-d3 mx-auto mt-6 max-w-xl text-balance text-base text-text-muted sm:text-lg">
            Generate content in your voice, audit your funnels, find collaborators, and grow daily —
            all from one tool. Site + Discord bot, one account.
          </p>

          <div className="anim-fade-up anim-d4 mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login" className="btn-primary group w-full sm:w-auto">
              Start free <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link href="/pricing" className="btn-secondary w-full sm:w-auto">View pricing</Link>
          </div>

          {/* Mini stat row */}
          <div className="anim-fade-up anim-d5 mx-auto mt-14 grid max-w-lg grid-cols-3 gap-4 border-t border-bg-border pt-8">
            <Stat value="20+" label="AI tools" />
            <Stat value="2" label="Surfaces · site + Discord" />
            <Stat value="1" label="Account, everything synced" />
          </div>
        </div>
      </section>

      {/* ═══════════════ TRUST STRIP ═══════════════ */}
      <section className="border-b border-bg-border py-10">
        <p className="mb-6 text-center text-xs uppercase tracking-widest text-text-dim">
          One toolkit for the whole operation
        </p>
        <div className="marquee-mask mx-auto max-w-6xl overflow-hidden px-4">
          <div className="marquee-track gap-3">
            {[...CAPS, ...CAPS].map((c, i) => (
              <span
                key={i}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-bg-border bg-bg-panel/60 px-4 py-2 text-sm text-text-muted"
              >
                <c.icon className="h-4 w-4 text-[var(--accent)]" />
                {c.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ FEATURES (BENTO) ═══════════════ */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="mb-12 text-center sm:mb-16">
          <span className="eyebrow">
            <Sparkles className="h-3.5 w-3.5" /> The arsenal
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Everything in one fortress.</h2>
          <p className="mx-auto mt-3 max-w-xl text-text-muted">
            Tools that compound. Each feature feeds the next.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Large feature */}
          <BentoCard
            className="md:col-span-2 md:row-span-2"
            icon={<Sparkles className="h-5 w-5" />}
            title="Brand Voice Studio"
            body="Train Claude on your tone of voice, then generate hooks, posts, cold outreach, and long-form — every output sounds unmistakably like you. Your voice becomes the engine behind every other tool."
            featured
          />
          <BentoCard
            icon={<Radar className="h-5 w-5" />}
            title="Trend Radar"
            body="Daily personalised trends from across your niche, scored and ready to act on."
          />
          <BentoCard
            icon={<Bot className="h-5 w-5" />}
            title="Discord Native"
            body="Run every command in your server. One account, two surfaces."
          />
          <BentoCard
            icon={<Workflow className="h-5 w-5" />}
            title="Workflows"
            body="Chain triggers, AI steps, and actions into automations that run themselves."
          />
          <BentoCard
            icon={<Search className="h-5 w-5" />}
            title="Lead Extractor"
            body="Paste profiles, get verified emails and phone numbers back."
          />
          <BentoCard
            icon={<Network className="h-5 w-5" />}
            title="Networking"
            body="AI matchmaking, a live deal board, and mastermind pods."
          />
        </div>
      </section>

      {/* ═══════════════ CTA BAND ═══════════════ */}
      <section className="relative overflow-hidden border-t border-bg-border">
        <div className="pointer-events-none absolute inset-0">
          <div className="aurora aurora-violet left-1/2 top-1/2 h-[420px] w-[620px] -translate-x-1/2 -translate-y-1/2" />
        </div>
        <div className="bg-grid-fade absolute inset-0" />
        <div className="relative mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-5xl">
            Build your fortress today.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-text-muted">
            Start free. Upgrade when you're ready to scale. Cancel anytime.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login" className="btn-primary group">
              Start free <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link href="/pricing" className="btn-secondary">View pricing</Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}

const CAPS = [
  { icon: Sparkles, label: "Brand Voice" },
  { icon: Radar, label: "Trend Radar" },
  { icon: Search, label: "Lead Extractor" },
  { icon: Workflow, label: "Workflows" },
  { icon: LineChart, label: "Analytics" },
  { icon: Users, label: "Matchmaking" },
  { icon: ShieldCheck, label: "Competitor Watch" },
  { icon: Zap, label: "AI Advisor" },
];

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold tracking-tight sm:text-3xl">{value}</p>
      <p className="mt-1 text-[11px] leading-tight text-text-muted">{label}</p>
    </div>
  );
}

function BentoCard({
  icon,
  title,
  body,
  className = "",
  featured = false,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  className?: string;
  featured?: boolean;
}) {
  return (
    <div className={`bento group flex flex-col p-6 ${className}`}>
      <div className={`icon-tile mb-4 text-text ${featured ? "h-12 w-12" : "h-10 w-10"}`}>
        {icon}
      </div>
      <h3 className={`font-semibold tracking-tight ${featured ? "text-xl" : "text-base"}`}>{title}</h3>
      <p className={`mt-2 leading-relaxed text-text-muted ${featured ? "text-sm sm:text-base" : "text-sm"}`}>
        {body}
      </p>
      {featured && (
        <div className="mt-auto pt-6">
          <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)]">
            Explore the studio <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      )}
    </div>
  );
}
