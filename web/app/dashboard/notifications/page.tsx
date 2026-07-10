import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { Bell, Check, MessageSquare, UserPlus } from "lucide-react";
import Link from "next/link";

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id as string;

  const [user, notifications] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  if (!user) redirect("/login");

  // Mark all as read
  await db.notification.updateMany({ where: { userId, read: false }, data: { read: true } });

  const typeIcon = (type: string) => {
    if (type === "connection_request") return <UserPlus className="h-4 w-4 text-green-400" />;
    if (type === "connection_accepted") return <Check className="h-4 w-4 text-blue-400" />;
    if (type === "new_message") return <MessageSquare className="h-4 w-4 text-text-muted" />;
    return <Bell className="h-4 w-4 text-text-muted" />;
  };

  return (
    <div className="min-h-screen">
      <DashboardNav user={user} active="notifications" />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-12">
        <h1 className="mb-6 text-2xl font-bold tracking-tight">Notifications</h1>

        {notifications.length === 0 ? (
          <div className="card p-10 text-center text-text-muted">
            <Bell className="mx-auto mb-3 h-6 w-6 opacity-40" />
            <p className="text-sm">No notifications yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`card p-4 flex items-start gap-3 ${!n.read ? "border-white/10 bg-white/[0.03]" : ""}`}
              >
                <div className="mt-0.5 shrink-0">{typeIcon(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && <p className="text-xs text-text-muted mt-0.5">{n.body}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-text-dim">{timeAgo(n.createdAt)}</span>
                  {n.link && (
                    <Link href={n.link} className="text-xs text-text-muted hover:text-text transition underline">
                      View
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
