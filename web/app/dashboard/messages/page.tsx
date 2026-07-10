import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { MessagesClient } from "@/components/messages-client";

export default async function MessagesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id as string;

  const [user, messages] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.userMessage.findMany({
      where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
      orderBy: { createdAt: "desc" },
      include: {
        from: { select: { id: true, name: true, username: true, avatarUrl: true, image: true } },
        to: { select: { id: true, name: true, username: true, avatarUrl: true, image: true } },
      },
    }),
  ]);

  if (!user) redirect("/login");
  if (user.softwareBanned) redirect("/banned");
  if (user.platformBanned) redirect("/dashboard?banned=platform");

  return (
    <div className="min-h-screen">
      <DashboardNav user={user} active="messages" />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
        <h1 className="text-2xl font-bold tracking-tight mb-8">Messages</h1>
        <MessagesClient
          currentUserId={userId}
          initialMessages={messages.map((m) => ({
            ...m,
            createdAt: m.createdAt.toISOString(),
          }))}
        />
      </main>
    </div>
  );
}
