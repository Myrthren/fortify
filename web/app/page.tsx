import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Bot, Network, Sparkles, Zap } from "lucide-react";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";

export default function HomePage() {
  return (
    <>
      <Nav />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-bg-border">
        <div className="bg-spotlight-accent absolute inset-0" />
        <div className="absolute inset-0 bg-grid opacity-50 [mask-image:radial-gradient(ellipse_75%_60%_at_50%_35%,black,transparent)]" />
        <div className="relative mx-auto max-w-4xl px-4 pt-16 pb-24 text-center sm:px-6 sm:pt-20 sm:pb-32">

          {/* Floating brand mark */}
          <div className="anim-fade-up mb-8 flex justify-center">
            <div className="hero-mark relative">
              <Image
                src="/fortify-mark.png"
                alt=""
                width={88}
                height={88}
                priority
              />
            </div>
          </div>

          <div className="anim-fade-up anim-d1 mb-6 inline-flex items-center gap-2 rounded-full border border-bg-border bg-bg-panel/80 px-3 py-1 text-xs text-text-muted backdrop-blur">
            <span className="dot-live h-1.5 w-1.5 rounded-full bg-green-400" />
            Built for the Fortune Fortress
          </div>

          <h1 className="anim-fade-up anim-d2 text-balance text-4xl font-bold tracking-tight sm:text-6xl">
            The AI co-pilot for<br className="hidden sm:inline" />{" "}
            <span className="bg-gradient-to-br from-white via-white to-[var(--accent)] bg-clip-text text-transparent">
              online business.
            </span>
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
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="mb-12 text-center sm:mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Everything in one fortress.</h2>
          <p className="mx-auto mt-3 max-w-xl text-text-muted">
            Tools that compound. Each feature feeds the next.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Feature
            delay="anim-d1"
            icon={<Sparkles className="h-5 w-5" />}
            title="Brand Voice"
            body="Train Claude on your tone. Every output sounds like you."
          />
          <Feature
            delay="anim-d2"
            icon={<Zap className="h-5 w-5" />}
            title="Trend Radar"
            body="Daily personalised trends from across your niche."
          />
          <Feature
            delay="anim-d3"
            icon={<Bot className="h-5 w-5" />}
            title="Discord Native"
            body="Run every command in your server. One account, two surfaces."
          />
          <Feature
            delay="anim-d4"
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

function Feature({
  icon,
  title,
  body,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  delay?: string;
}) {
  return (
    <div className={`card card-interactive group anim-fade-up ${delay ?? ""} p-6`}>
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-bg-border bg-bg-elevated text-text transition-all duration-300 group-hover:border-[rgba(167,139,250,0.35)] group-hover:text-[var(--accent)] group-hover:shadow-[0_0_18px_-4px_var(--accent-glow)]">
        {icon}
      </div>
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">{body}</p>
    </div>
  );
}
