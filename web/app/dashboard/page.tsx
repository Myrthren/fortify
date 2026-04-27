import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { HookGenerator } from "@/components/hook-generator";
import { TIERS } from "@/lib/tiers";
import { DashboardNav } from "@/components/dashboard-nav";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: (session.user as any).id },
    include: { subscription: true },
  });
  if (!user) redirect("/login");

  const tierMeta = TIERS[user.tier];

  return (
    <div className="min-h-screen bg-bg">
      <DashboardNav user={user} active="dashboard" />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Welcome, {user.name?.split(" ")[0] ?? "operator"}.
          </h1>
          <p className="mt-3 text-text-muted">
            You're on <span className="text-text">{tierMeta.name}</span>.{" "}
            {user.tier === "FREE" && (
              <Link href="/pricing" className="text-text underline-offset-4 hover:underline">
                Upgrade for unlimited →
              </Link>
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card title="Hook Generator" subtitle="Type a topic. Get 5 viral hooks.">
              <HookGenerator />
            </Card>
          </div>

          <div className="space-y-5">
            <Card title="Your stats">
              <dl className="space-y-3 text-sm">
                <Stat label="Tier" value={tierMeta.name} />
                <Stat label="XP" value={user.xp.toString()} />
                <Stat label="Streak" value={`${user.streak} days`} />
                <Stat label="Subscription" value={user.subscription?.status ?? "—"} />
              </dl>
            </Card>

            <Card title="Your tools">
              <ul className="space-y-2 text-sm">
                <ToolLink href="/dashboard/voice" name="Brand Voice Studio" desc="Train Claude on your tone" />
                <ToolLink href="/dashboard/outreach" name="Cold Outreach" desc="Personalised messages that get replies" />
                <ToolLink href="/dashboard/audit" name="Funnel Auditor" desc="Score + fix any landing page" />
                <ToolLink href="/dashboard/members" name="Member Directory" desc="Find founders, operators, creators" />
                <ToolLink href="/dashboard/profile" name="Your profile" desc="Set niche, skills, what you offer" />
              </ul>
            </Card>

            <Card title="Coming soon">
              <ul className="space-y-1.5 text-sm text-text-muted">
                <li>· Trend Radar</li>
                <li>· Competitor Scanner</li>
                <li>· AI Matchmaking</li>
                <li>· Strategy Reports</li>
              </ul>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function ToolLink({ href, name, desc }: { href: string; name: string; desc: string }) {
  return (
    <li>
      <Link
        href={href}
        className="-mx-2 flex items-center justify-between rounded-md px-2 py-1.5 transition hover:bg-white/[0.04]"
      >
        <div>
          <p className="font-medium">{name}</p>
          <p className="text-xs text-text-muted">{desc}</p>
        </div>
        <span className="text-text-muted">→</span>
      </Link>
    </li>
  );
}
