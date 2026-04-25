import Link from "next/link";
import { ArrowRight, Bot, Network, Sparkles, Zap } from "lucide-react";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";

export default function HomePage() {
  return (
    <>
      <Nav />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-bg-border">
        <div className="absolute inset-0 bg-grid opacity-60" />
        <div className="absolute inset-x-0 top-0 mx-auto h-[400px] max-w-3xl bg-white/[0.04] blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-6 pt-28 pb-32 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-bg-border bg-bg-panel px-3 py-1 text-xs text-text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            Built for the Fortune Fortress
          </div>
          <h1 className="text-balance text-5xl font-semibold tracking-tight sm:text-6xl">
            The AI co-pilot for<br />online business.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-balance text-lg text-text-muted">
            Generate content in your voice, audit your funnels, find collaborators, and grow daily —
            all from one tool. Site + Discord bot, one account.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Link href="/login" className="btn-primary">
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/pricing" className="btn-secondary">View pricing</Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-semibold tracking-tight">Everything in one fortress.</h2>
          <p className="mx-auto mt-3 max-w-xl text-text-muted">
            Tools that compound. Each feature feeds the next.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-bg-border bg-bg-border sm:grid-cols-2 lg:grid-cols-4">
          <Feature
            icon={<Sparkles className="h-5 w-5" />}
            title="Brand Voice"
            body="Train Claude on your tone. Every output sounds like you."
          />
          <Feature
            icon={<Zap className="h-5 w-5" />}
            title="Trend Radar"
            body="Daily personalised trends from across your niche."
          />
          <Feature
            icon={<Bot className="h-5 w-5" />}
            title="Discord Native"
            body="Run every command in your server. One account, two surfaces."
          />
          <Feature
            icon={<Network className="h-5 w-5" />}
            title="Networking"
            body="AI matchmaking, deal board, mastermind pods."
          />
        </div>
      </section>

      <Footer />
    </>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="bg-bg p-6">
      <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-md border border-bg-border bg-bg-panel text-text">
        {icon}
      </div>
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm text-text-muted">{body}</p>
    </div>
  );
}
