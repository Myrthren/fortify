import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isOwner } from "@/lib/owner";
import Link from "next/link";

export default async function AdminUserLogPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const me = await db.user.findUnique({ where: { id: (session.user as any).id } });
  if (!me) redirect("/login");
  if (!isOwner(me.discordId)) redirect("/dashboard");

  const { userId } = await params;

  const [targetUser, chatSessions, aiSessions, abuseAlerts] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, username: true, tier: true, discordId: true, credits: true, createdAt: true, freeAiUsed: true },
    }),
    db.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: { id: true, title: true, messages: true, createdAt: true, updatedAt: true },
    }),
    db.aiSession.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      take: 10,
      select: { id: true, startedAt: true, expiresAt: true, budgetGbp: true, usedCostGbp: true },
    }),
    db.abuseAlert.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  if (!targetUser) redirect("/admin/usage");

  const identity = targetUser.username ?? targetUser.email ?? userId;

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-bg-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <h1 className="font-semibold">User Logs: {identity}</h1>
          <Link href="/admin/usage" className="text-sm text-text-muted hover:text-text">
            ← Usage
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-10 px-6 py-12">
        {/* User info */}
        <section className="rounded-xl border border-white/[0.07] p-5" style={{ background: "linear-gradient(145deg,#141414,#0d0d0d)" }}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
            <div>
              <p className="text-xs text-text-muted">Email</p>
              <p className="font-medium">{targetUser.email ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Tier</p>
              <p className="font-medium">{targetUser.tier}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Credits</p>
              <p className="font-medium tabular-nums">{targetUser.credits.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Free AI used</p>
              <p className="font-medium">{targetUser.freeAiUsed ? "Yes" : "No"}</p>
            </div>
          </div>
        </section>

        {/* Abuse alerts */}
        {abuseAlerts.length > 0 && (
          <section>
            <h2 className="mb-3 text-base font-semibold text-red-300">Abuse Alerts</h2>
            <div className="space-y-2">
              {abuseAlerts.map((a) => (
                <div key={a.id} className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs bg-white/[0.07] px-1.5 py-0.5 rounded">{a.feature}</span>
                    <span className="text-xs text-text-dim">
                      ×{a.alertCount} · {new Date(a.updatedAt).toLocaleDateString("en-GB")}
                    </span>
                  </div>
                  <p className="mt-1 text-text-muted">{a.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* AI sessions */}
        <section>
          <h2 className="mb-3 text-base font-semibold">AI Sessions</h2>
          {aiSessions.length === 0 ? (
            <p className="text-sm text-text-muted">No AI sessions.</p>
          ) : (
            <div className="space-y-2">
              {aiSessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-bg-border bg-bg-panel px-4 py-3 text-sm">
                  <span className="text-text-muted">
                    {new Date(s.startedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  <span className="tabular-nums">
                    £{s.usedCostGbp.toFixed(3)} / £{s.budgetGbp.toFixed(2)}
                  </span>
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-bg-elevated">
                    <div
                      className="h-full rounded-full bg-white/40"
                      style={{ width: `${Math.min(100, (s.usedCostGbp / s.budgetGbp) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Chat sessions */}
        <section>
          <h2 className="mb-3 text-base font-semibold">Chat History ({chatSessions.length})</h2>
          {chatSessions.length === 0 ? (
            <p className="text-sm text-text-muted">No chat sessions.</p>
          ) : (
            <div className="space-y-3">
              {chatSessions.map((cs) => {
                const msgs = cs.messages as any[];
                const msgCount = msgs.length;
                const preview = msgs.find((m: any) => m.role === "user")?.content ?? "";
                return (
                  <div
                    key={cs.id}
                    className="rounded-xl border border-white/[0.07] p-4"
                    style={{ background: "linear-gradient(145deg,#141414,#0d0d0d)" }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="font-medium text-sm">{cs.title}</p>
                      <span className="shrink-0 text-xs text-text-dim">
                        {new Date(cs.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        {" · "}{msgCount} msg{msgCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {preview && (
                      <p className="text-xs text-text-muted line-clamp-2">
                        {typeof preview === "string" ? preview : JSON.stringify(preview)}
                      </p>
                    )}
                    {/* Message thread */}
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-text-dim hover:text-text-muted select-none">
                        View full thread
                      </summary>
                      <div className="mt-3 space-y-2 max-h-96 overflow-y-auto">
                        {msgs.map((m: any, i: number) => (
                          <div
                            key={i}
                            className={`rounded-lg px-3 py-2 text-xs ${
                              m.role === "user"
                                ? "bg-white/[0.06] text-text ml-4"
                                : "bg-bg-elevated text-text-muted mr-4"
                            }`}
                          >
                            <p className="font-semibold mb-0.5 text-[10px] uppercase tracking-wide opacity-60">
                              {m.role}
                            </p>
                            <p className="whitespace-pre-wrap line-clamp-10">
                              {typeof m.content === "string"
                                ? m.content
                                : JSON.stringify(m.content).slice(0, 300)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
