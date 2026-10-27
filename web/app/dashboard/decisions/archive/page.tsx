import { redirect } from "next/navigation";
import Link from "next/link";
import { dashboardSession as auth } from "@/lib/session-user";
import { db } from "@/lib/db";
import { advisorSessionView } from "@/lib/advisor-run";
import { WorkspaceMemberSync } from "@/components/workspace-member-sync";
export const dynamic = "force-dynamic";
export default async function StrategyArchive({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const session = await auth(),
    userId = (session?.user as { id?: unknown } | undefined)?.id;
  if (typeof userId !== "string" || !userId) redirect("/login");
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/login");
  const { id } = await searchParams;
  const sessions = await db.chatSession.findMany({
    where: {
      userId,
      title: { startsWith: "Strategy:" },
      ...(id ? { id } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, title: true, messages: true, createdAt: true },
  });
  return (
    <div className="min-h-screen">
      <WorkspaceMemberSync user={user} active="advisor" />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <span className="eyebrow">Your saved strategy archive</span>
        <h1 className="mt-3 text-3xl">Earlier sessions & Growth Briefs</h1>
        <p className="my-4 text-sm text-text-muted">
          Your existing records are preserved here. Use Decision Room for new
          decisions and linked plans.
        </p>
        <Link
          href="/dashboard/decisions"
          className="btn-secondary mb-6 inline-flex"
        >
          Open Decision Room
        </Link>
        {id && (
          <Link
            href="/dashboard/decisions/archive"
            className="ml-4 text-sm underline"
          >
            All saved sessions
          </Link>
        )}
        <div className="space-y-4">
          {sessions.length ? (
            sessions.map((s) => {
              const item = advisorSessionView(s);
              return (
                <details
                  key={item.id}
                  open={!!id}
                  className="rounded-lg border border-bg-border bg-bg-panel p-5"
                >
                  <summary className="cursor-pointer font-medium">
                    {item.title}
                    <span className="ml-3 text-xs text-text-muted">
                      {item.createdAt.slice(0, 10)}
                    </span>
                  </summary>
                  {item.messages.map((m, i) => (
                    <section className="mt-5" key={i}>
                      <h2 className="text-xs uppercase tracking-wide text-text-muted">
                        {m.role === "user" ? "Your question" : "Saved response"}
                      </h2>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">
                        {m.content}
                      </p>
                    </section>
                  ))}
                </details>
              );
            })
          ) : (
            <p className="text-text-muted">
              No earlier strategy sessions found.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
