import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { db } from "@/lib/db";
import { Logo } from "@/components/logo";
import { HookGenerator } from "@/components/hook-generator";
import { TIERS } from "@/lib/tiers";
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
      {/* Top bar */}
      <header className="border-b border-bg-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Logo withWord />
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-text-muted sm:inline">{user.email}</span>
            <span className="rounded-md border border-bg-border bg-bg-panel px-2.5 py-1 text-xs font-medium">
              {tierMeta.name}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button className="btn-ghost text-xs">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight">
            Welcome, {user.name?.split(" ")[0] ?? "operator"}.
          </h1>
          <p className="mt-2 text-text-muted">
            You're on <span className="text-text">{tierMeta.name}</span>. {user.tier === "FREE" && (
              <Link href="/pricing" className="underline hover:text-white">
                Upgrade for unlimited.
              </Link>
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card title="Hook Generator" subtitle="Type a topic. Get 5 viral hooks.">
              <HookGenerator />
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Your stats">
              <dl className="space-y-3 text-sm">
                <Stat label="Tier" value={tierMeta.name} />
                <Stat label="XP" value={user.xp.toString()} />
                <Stat label="Streak" value={`${user.streak} days`} />
                <Stat
                  label="Subscription"
                  value={user.subscription?.status ?? "—"}
                />
              </dl>
            </Card>

            <Card title="Coming soon">
              <ul className="space-y-2 text-sm text-text-muted">
                <li>· Brand Voice Studio</li>
                <li>· Funnel Auditor</li>
                <li>· Trend Radar</li>
                <li>· Member Matchmaking</li>
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
    <div className="rounded-lg border border-bg-border bg-bg-panel p-6">
      <div className="mb-4">
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
