import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { HookGenerator } from "@/components/hook-generator";
import { TIERS } from "@/lib/tiers";
import { DashboardNav } from "@/components/dashboard-nav";
import {
  ArrowRight, Sparkles, Send, ClipboardCheck, Radar, TrendingUp, Search,
  Lightbulb, BarChart3, ShoppingBag, LineChart, Clapperboard, Dna, MapPin,
  Eye, Workflow, Zap, Activity, MessagesSquare, Users, Handshake, UserCircle,
  Briefcase, UsersRound, MessageSquare, Network, Gem, Flame, Trophy, CreditCard,
} from "lucide-react";
import Link from "next/link";

const TOOLS = [
  { href: "/dashboard/voice", name: "Brand Voice Studio", desc: "Train Claude on your tone", icon: Sparkles },
  { href: "/dashboard/outreach", name: "Cold Outreach", desc: "Messages that get replies", icon: Send },
  { href: "/dashboard/audit", name: "Funnel Auditor", desc: "Score + fix any landing page", icon: ClipboardCheck },
  { href: "/dashboard/competitors", name: "Competitor Scanner", desc: "Intel reports on rivals", icon: Radar },
  { href: "/dashboard/trends", name: "Trend Radar", desc: "Track topics across the web", icon: TrendingUp },
  { href: "/dashboard/leads", name: "Lead Sourcing", desc: "Score prospects against your ICP", icon: Search },
  { href: "/dashboard/inspiration", name: "Content Inspiration", desc: "Mine Reddit + YouTube angles", icon: Lightbulb },
  { href: "/dashboard/ads", name: "Meta Ads", desc: "Campaign performance + ad intel", icon: BarChart3 },
  { href: "/dashboard/shopify", name: "Shopify", desc: "Revenue, orders, products", icon: ShoppingBag },
  { href: "/dashboard/revenue", name: "Revenue", desc: "MRR, subs, and charges", icon: LineChart },
  { href: "/dashboard/virality", name: "Virality Engine", desc: "AI video scoring + publishing", icon: Clapperboard },
  { href: "/dashboard/company-dna", name: "Company DNA", desc: "Give AI context about you", icon: Dna },
  { href: "/dashboard/recon", name: "Fortify Recon", desc: "Find local businesses", icon: MapPin },
  { href: "/dashboard/competitor-tracking", name: "Competitor Watch", desc: "Monitor pages for changes", icon: Eye },
  { href: "/dashboard/workflows", name: "Workflows", desc: "Multi-step AI automations", icon: Workflow },
  { href: "/dashboard/advisor", name: "AI Advisor", desc: "Claude Opus strategy briefings", icon: Zap },
  { href: "/dashboard/analytics", name: "Analytics", desc: "GA4 + Search Console", icon: Activity },
  { href: "/dashboard/forums", name: "Forums", desc: "Community discussion boards", icon: MessagesSquare },
  { href: "/dashboard/members", name: "Member Directory", desc: "Founders, operators, creators", icon: Users },
  { href: "/dashboard/matchmaking", name: "AI Matchmaking", desc: "Members worth talking to", icon: Handshake },
  { href: "/dashboard/profile", name: "Your Profile", desc: "Niche, skills, what you offer", icon: UserCircle },
  { href: "/dashboard/deals", name: "Deal Board", desc: "Post and browse deals", icon: Briefcase },
  { href: "/dashboard/pods", name: "Mastermind Pods", desc: "Apex accountability circles", icon: UsersRound },
  { href: "/dashboard/messages", name: "Messages", desc: "Chat with members", icon: MessageSquare },
  { href: "/dashboard/connections", name: "Connections", desc: "Your Fortify network", icon: Network },
];

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: (session.user as any).id },
    include: { subscription: true, profile: true },
  });
  if (!user) redirect("/login");

  const tierMeta = TIERS[user.tier];
  const profileIncomplete = !user.profile || (!user.profile.niche && user.profile.skills.length === 0 && user.profile.canOffer.length === 0);
  const firstName = user.name?.split(" ")[0] ?? "operator";

  return (
    <div className="relative min-h-screen">
      <DashboardNav user={user} active="dashboard" />

      <main className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        {profileIncomplete && (
          <div className="anim-fade-up mb-6 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            Your profile is incomplete —{" "}
            <Link href="/dashboard/profile" className="underline underline-offset-2">fill it in</Link>{" "}
            to get the most out of AI Matchmaking and Member Directory.
          </div>
        )}

        {/* Header */}
        <div className="anim-fade-up mb-8">
          <span className="eyebrow"><Sparkles className="h-3.5 w-3.5" /> Dashboard</span>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Welcome back, {firstName}.
          </h1>
          <p className="mt-2 text-text-muted">
            You're on <span className="font-medium text-text">{tierMeta.name}</span>.{" "}
            {user.tier === "FREE" && (
              <Link href="/pricing" className="text-[var(--accent)] underline-offset-4 hover:underline">
                Upgrade for unlimited →
              </Link>
            )}
          </p>
        </div>

        {/* Stat tiles */}
        <div className="anim-fade-up anim-d1 mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile icon={<Gem className="h-4 w-4" />} label="Tier" value={tierMeta.name} accent="#ffffff" />
          <StatTile icon={<Trophy className="h-4 w-4" />} label="XP" value={user.xp.toLocaleString()} accent="#ffffff" />
          <StatTile icon={<Flame className="h-4 w-4" />} label="Streak" value={`${user.streak} days`} accent="#ffffff" />
          <StatTile icon={<CreditCard className="h-4 w-4" />} label="Subscription" value={user.subscription?.status ?? "Free"} accent="#ffffff" />
        </div>

        {/* Hook generator — featured */}
        <div className="anim-fade-up anim-d2 mb-10">
          <div className="bento p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="icon-tile h-10 w-10 text-[var(--accent)]"><Sparkles className="h-5 w-5" /></span>
              <div>
                <h2 className="text-base font-semibold tracking-tight">Hook Generator</h2>
                <p className="text-sm text-text-muted">Type a topic. Get 5 viral hooks.</p>
              </div>
            </div>
            <HookGenerator />
          </div>
        </div>

        {/* Tools grid */}
        <div className="anim-fade-up anim-d3 mb-4 flex items-end justify-between">
          <div>
            <span className="eyebrow"><Workflow className="h-3.5 w-3.5" /> Your arsenal</span>
            <h2 className="mt-1 text-xl font-bold tracking-tight">Every tool, one click away</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="bento group flex items-start gap-3 p-4"
            >
              <span className="icon-tile h-10 w-10 shrink-0 text-text-muted">
                <t.icon className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium leading-tight">{t.name}</p>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-text-dim transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
                </div>
                <p className="mt-0.5 text-xs leading-snug text-text-muted">{t.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

function StatTile({
  icon, label, value, accent,
}: {
  icon: React.ReactNode; label: string; value: string; accent: string;
}) {
  return (
    <div className="card-elevated relative overflow-hidden p-4">
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full opacity-40 blur-2xl"
        style={{ background: accent }}
      />
      <div className="relative flex items-center gap-2 text-text-muted">
        <span style={{ color: accent }}>{icon}</span>
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className="relative mt-2 text-xl font-bold tracking-tight tabular-nums">{value}</p>
    </div>
  );
}
