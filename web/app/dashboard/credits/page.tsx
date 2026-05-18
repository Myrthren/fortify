import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { CreditsBuyButton } from "@/components/credits-buy-button";
import { CREDIT_PACKS, pencePerCredit } from "@/lib/credit-packs";

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; cancelled?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: (session.user as any).id },
    select: {
      email: true,
      tier: true,
      discordId: true,
      credits: true,
      creditTransactions: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { amount: true, source: true, createdAt: true },
      },
    },
  });
  if (!user) redirect("/login");

  const params = await searchParams;

  return (
    <div className="min-h-screen bg-bg">
      <DashboardNav user={user} active="credits" />

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-widest text-text-muted">Account</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Credits</h1>
          <p className="mt-2 text-text-muted">
            Buy credits to use on AI features. Credits never expire.
          </p>
        </div>

        {/* Status banners */}
        {params.success && (
          <div className="mb-6 rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
            Payment complete — your credits have been added. Check your Discord DM for a receipt.
          </div>
        )}
        {params.cancelled && (
          <div className="mb-6 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            Payment cancelled. No charge was made.
          </div>
        )}

        {/* Balance */}
        <section
          className="mb-8 rounded-xl border border-white/[0.07] p-6"
          style={{ background: "linear-gradient(145deg,#111827,#0d0d0d)" }}
        >
          <p className="text-xs font-medium uppercase tracking-widest text-text-muted">Current balance</p>
          <p className="mt-2 text-5xl font-bold tracking-tight tabular-nums">
            {user.credits.toLocaleString()}
          </p>
          <p className="mt-1 text-sm text-text-muted">credits</p>
        </section>

        {/* Packs */}
        <section className="mb-8">
          <h2 className="mb-4 text-base font-semibold">Top up</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CREDIT_PACKS.map((pack) => (
              <div
                key={pack.id}
                className="relative flex flex-col rounded-xl border p-5"
                style={
                  pack.highlight
                    ? {
                        background: "linear-gradient(160deg,#1a1a2e,#0f0f1a)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        boxShadow: "0 0 0 1px rgba(255,255,255,0.06) inset",
                      }
                    : {
                        background: "linear-gradient(145deg,#131313,#0a0a0a)",
                        border: "1px solid rgba(255,255,255,0.07)",
                      }
                }
              >
                {pack.highlight && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-white px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-bg">
                    Popular
                  </span>
                )}

                <p className="text-xs font-medium text-text-muted">{pack.label}</p>

                <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums">
                  {pack.credits.toLocaleString()}
                </p>
                <p className="text-xs text-text-muted">credits</p>

                <p className="mt-3 text-xl font-semibold">£{pack.price}</p>
                <p className="mb-4 text-xs text-text-muted">
                  {pencePerCredit(pack)}p / credit
                </p>

                <CreditsBuyButton
                  packId={pack.id}
                  price={pack.price}
                  credits={pack.credits}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Recent transactions */}
        {user.creditTransactions.length > 0 && (
          <section
            className="rounded-xl border border-white/[0.07] p-6"
            style={{ background: "linear-gradient(145deg,#111827,#0d0d0d)" }}
          >
            <h2 className="mb-4 text-base font-semibold">Recent transactions</h2>
            <div className="flex flex-col divide-y divide-white/[0.06]">
              {user.creditTransactions.map((tx, i) => (
                <div key={i} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium">
                      {tx.amount > 0 ? "Top-up" : "Spent"}
                    </p>
                    <p className="text-xs text-text-muted">
                      {new Date(tx.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      tx.amount > 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {tx.amount > 0 ? "+" : ""}
                    {tx.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
