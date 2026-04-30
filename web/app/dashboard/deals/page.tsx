import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { DealForm } from "@/components/deal-form";
import { DealDelete } from "@/components/deal-delete";
import Link from "next/link";

export default async function DealsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [user, posts] = await Promise.all([
    db.user.findUnique({ where: { id: (session.user as any).id } }),
    db.dealPost.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { name: true } } },
    }),
  ]);
  if (!user) redirect("/login");

  const typeLabel: Record<string, string> = {
    HIRING: "Hiring",
    COLLAB: "Collab",
    OPPORTUNITY: "Opportunity",
  };
  const typeBadge: Record<string, string> = {
    HIRING: "bg-blue-500/10 text-blue-300 border-blue-500/20",
    COLLAB: "bg-green-500/10 text-green-300 border-green-500/20",
    OPPORTUNITY: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  };

  return (
    <div className="min-h-screen bg-bg">
      <DashboardNav user={user} active="deals" />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Deal Board</h1>
            <p className="mt-2 text-text-muted">Hiring, collabs, and opportunities from the community.</p>
          </div>
          {user.tier !== "FREE" && <DealForm />}
        </div>

        {posts.length === 0 && (
          <p className="text-text-muted">No deals posted yet. Be the first.</p>
        )}

        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${typeBadge[post.type]}`}>
                      {typeLabel[post.type]}
                    </span>
                    <span className="text-xs text-text-muted">{post.user.name ?? "Anonymous"}</span>
                    <span className="text-xs text-text-muted">·</span>
                    <span className="text-xs text-text-muted">{post.createdAt.toLocaleDateString()}</span>
                  </div>
                  <h3 className="font-semibold">{post.title}</h3>
                  <p className="mt-1 text-sm text-text-muted">{post.description.slice(0, 300)}{post.description.length > 300 ? "…" : ""}</p>
                  <div className="mt-2 flex gap-4 text-xs text-text-muted">
                    {post.budget && <span>Budget: {post.budget}</span>}
                    {post.link && <Link href={post.link} className="underline underline-offset-2" target="_blank">View link →</Link>}
                  </div>
                </div>
                {(post.userId === user.id || user.discordId === "731207920007643167") && (
                  <DealDelete id={post.id} />
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
