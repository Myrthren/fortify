import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight, Sparkles, Zap, Bot, Network, Radar, ShieldCheck, Workflow, Search,
  MapPin, Send, Eye, TrendingUp, Plus, Check,
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
            Built for the Fortify community
          </div>

          <h1 className="anim-fade-up anim-d2 text-balance text-4xl font-bold tracking-tight sm:text-6xl">
            The AI co-pilot for<br className="hidden sm:inline" />{" "}
            <span className="text-shine">online business.</span>
          </h1>

          <p className="anim-fade-up anim-d3 mx-auto mt-6 max-w-xl text-balance text-base text-text-muted sm:text-lg">
            Fortify finds leads, writes the outreach in your voice, watches your competitors and automates
            the work you keep putting off — on the web and inside your Discord.
          </p>

          <div className="anim-fade-up anim-d4 mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login" className="btn-primary group w-full sm:w-auto">
              Start free <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link href="/pricing" className="btn-secondary w-full sm:w-auto">View pricing</Link>
          </div>
          <p className="anim-fade-up anim-d5 mt-4 text-xs text-text-dim">Free plan, no card needed. Sign in with Discord.</p>
        </div>
      </section>

      {/* ═══════════════ TOOLS YOU CAN CANCEL ═══════════════ */}
      <section className="border-b border-bg-border py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="mb-2 text-center text-xs uppercase tracking-widest text-text-dim">One co-pilot</p>
          <h2 className="mb-10 text-center text-2xl font-bold tracking-tight sm:text-3xl">Five tools you can cancel.</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {REPLACES.map((r) => (
              <div key={r.from} className="card-elevated flex flex-col gap-3 p-4">
                <span className="text-xs text-text-dim line-through decoration-text-dim/60">{r.from}</span>
                <span className="flex items-center gap-2 text-sm font-medium text-text">
                  <r.icon className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                  {r.to}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ HOW IT WORKS ═══════════════ */}
      <section className="border-b border-bg-border">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="mb-12 text-center sm:mb-16">
            <span className="eyebrow"><Zap className="h-3.5 w-3.5" /> How it works</span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">From cold list to booked call.</h2>
            <p className="mx-auto mt-3 max-w-xl text-text-muted">
              Each step feeds the next, and every one of them knows your business.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Step n="01" title="Find the right people" body="Pull businesses from Google Maps or contacts from social profiles, then score them against your ideal customer.">
              <MockLeads />
            </Step>
            <Step n="02" title="Write like you, at scale" body="Outreach drafted from Company DNA and your trained brand voice — specific to each lead, never a template.">
              <MockDraft />
            </Step>
            <Step n="03" title="Put it on autopilot" body="Chain triggers, AI steps and actions into workflows that run on a schedule and report back in Discord.">
              <MockWorkflow />
            </Step>
          </div>
        </div>
      </section>

      {/* ═══════════════ FEATURES (BENTO) ═══════════════ */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
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
            body="Train it on your own writing, then generate hooks, posts, cold outreach and long-form that sound unmistakably like you. Your voice becomes the engine behind every other tool."
            featured
          >
            <MockVoice />
          </BentoCard>
          <BentoCard
            icon={<Radar className="h-5 w-5" />}
            title="Competitor Watch"
            body="Track rivals' sites and socials, and get told the moment something changes."
          />
          <BentoCard
            icon={<Bot className="h-5 w-5" />}
            title="Discord native"
            body="Run commands in your server and get alerts by DM. One account, two surfaces."
          />
          <BentoCard
            icon={<Workflow className="h-5 w-5" />}
            title="Workflows"
            body="Chain triggers, AI steps, and actions into automations that run themselves."
          />
          <BentoCard
            icon={<TrendingUp className="h-5 w-5" />}
            title="Trend Radar"
            body="Daily trends from across your niche, scored and ready to act on."
          />
          <BentoCard
            icon={<Network className="h-5 w-5" />}
            title="Networking"
            body="AI matchmaking, a live deal board, and mastermind pods."
          />
        </div>
      </section>

      {/* ═══════════════ FAQ ═══════════════ */}
      <section id="faq" className="scroll-mt-20 border-t border-bg-border">
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-24">
          <h2 className="mb-8 text-center text-3xl font-bold tracking-tight sm:text-4xl">Questions</h2>
          <div className="space-y-2">
            {FAQ.map((f) => (
              <details key={f.q} className="faq card group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {f.q}
                  <Plus className="h-4 w-4 shrink-0 text-text-muted transition-transform duration-200 group-open:rotate-45" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-text-muted">{f.a}</p>
              </details>
            ))}
          </div>
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

const REPLACES = [
  { from: "Lead scraper", to: "Lead Extractor + Recon", icon: Search },
  { from: "AI copywriter", to: "Brand Voice + Outreach", icon: Send },
  { from: "Competitor monitor", to: "Competitor Watch", icon: Eye },
  { from: "Automation tool", to: "Workflows", icon: Workflow },
  { from: "Trend tracker", to: "Trend Radar", icon: TrendingUp },
];

const FAQ = [
  {
    q: "What do I get on the free plan?",
    a: "100 starter credits, 10 outreach messages a month, 5 Trend Radar topics, the Hook Generator and the community — forums, member directory and deal board. No card needed.",
  },
  {
    q: "How do I pay, and can I cancel?",
    a: "Plans are monthly in GBP, paid through Whop or PayPal — both unlock the same tier and Discord roles. Cancel any time with the provider you paid through. Payments are non-refundable.",
  },
  {
    q: "What are credits for?",
    a: "Heavier jobs such as scraping leads draw from your monthly credits; everyday writing tools have their own monthly allowances. Paid plans refill credits every month, and you can top up from the Credits page.",
  },
  {
    q: "How does the Discord side work?",
    a: "Sign in with Discord and your tier's role is granted automatically. The Fortify bot runs commands in the server, answers questions when you mention it, and sends your alerts and reports by DM.",
  },
  {
    q: "Does it actually write in my voice?",
    a: "Yes. Brand Voice Studio learns from samples of your own writing, and Company DNA gives every tool the context about your business, offer and audience — so outputs are specific, not generic.",
  },
  {
    q: "Who is Fortify for?",
    a: "Solo founders, agencies, freelancers and community owners who do their own outreach, content and research — and would rather run one subscription than five.",
  },
];

function Step({ n, title, body, children }: { n: string; title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="bento flex flex-col p-6">
      <span className="text-xs font-semibold tracking-widest text-text-dim">{n}</span>
      <h3 className="mt-2 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">{body}</p>
      <div className="mt-6 flex-1" aria-hidden>{children}</div>
    </div>
  );
}

// ── Illustrative product previews (static markup, example data) ──

function MockFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="h-full rounded-xl border border-bg-border bg-bg/60 p-3 text-left">
      <div className="mb-3 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
        <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
        <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
        <span className="ml-2 text-[10px] uppercase tracking-wider text-text-dim">{label}</span>
      </div>
      {children}
    </div>
  );
}

function MockLeads() {
  const rows = [
    { name: "Northside Barbers", place: "Leeds", score: 92 },
    { name: "Peak Form PT Studio", place: "Manchester", score: 87 },
    { name: "Harbour Dog Grooming", place: "Bristol", score: 74 },
  ];
  return (
    <MockFrame label="Recon · barbers, gyms, groomers">
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center justify-between gap-2 rounded-lg border border-bg-border bg-bg-panel px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-text">{r.name}</p>
              <p className="flex items-center gap-1 text-[10px] text-text-dim"><MapPin className="h-2.5 w-2.5" /> {r.place}</p>
            </div>
            <span className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] tabular-nums text-text-muted">{r.score}</span>
          </div>
        ))}
      </div>
    </MockFrame>
  );
}

function MockDraft() {
  return (
    <MockFrame label="Outreach · your voice">
      <div className="rounded-lg border border-bg-border bg-bg-panel p-3 text-[11px] leading-relaxed text-text-muted">
        <p className="mb-1.5 text-text">Subject: your Maps listing</p>
        <p>Hi Sam — saw Northside is the top-rated barber in Leeds on Maps, but the listing links to Instagram rather than a booking page…</p>
        <div className="mt-3 flex items-center gap-1.5">
          <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px]">Personalised</span>
          <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px]">84 words</span>
        </div>
      </div>
    </MockFrame>
  );
}

function MockWorkflow() {
  const nodes = [
    { icon: MapPin, label: "New leads found" },
    { icon: Sparkles, label: "Draft outreach" },
    { icon: Bot, label: "Report in Discord" },
  ];
  return (
    <MockFrame label="Workflow · daily 08:00">
      <div className="flex flex-col items-stretch">
        {nodes.map((n, i) => (
          <div key={n.label} className="flex flex-col items-center">
            <div className="flex w-full items-center gap-2 rounded-lg border border-bg-border bg-bg-panel px-3 py-2">
              <n.icon className="h-3.5 w-3.5 text-text-muted" />
              <span className="text-xs text-text">{n.label}</span>
              <Check className="ml-auto h-3 w-3 text-text-dim" />
            </div>
            {i < nodes.length - 1 && <span className="h-3 w-px bg-white/15" />}
          </div>
        ))}
      </div>
    </MockFrame>
  );
}

function MockVoice() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-hidden>
      <MockFrame label="Trained on">
        <div className="space-y-1.5">
          {["Newsletter #14", "Launch thread", "Sales page"].map((s) => (
            <div key={s} className="flex items-center gap-2 rounded-md border border-bg-border bg-bg-panel px-2.5 py-1.5 text-[11px] text-text-muted">
              <ShieldCheck className="h-3 w-3 text-text-dim" /> {s}
            </div>
          ))}
        </div>
      </MockFrame>
      <MockFrame label="Hook · generated">
        <p className="rounded-md border border-bg-border bg-bg-panel p-2.5 text-[11px] leading-relaxed text-text">
          &ldquo;I cancelled four tools last month. Here&apos;s the one thing that replaced them.&rdquo;
        </p>
      </MockFrame>
    </div>
  );
}

function BentoCard({
  icon,
  title,
  body,
  className = "",
  featured = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  className?: string;
  featured?: boolean;
  children?: React.ReactNode;
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
      {children && <div className="mt-6 flex-1">{children}</div>}
      {featured && (
        <div className="mt-6">
          <Link href="/pricing#compare" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)]">
            See what each plan includes <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
