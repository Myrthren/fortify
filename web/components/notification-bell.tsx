"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

export function NotificationBell({ active }: { active: boolean }) {
  const [unread, setUnread] = useState(0);

  async function fetchCount() {
    try {
      const r = await fetch("/api/notifications/unread-count");
      if (r.ok) setUnread((await r.json()).count ?? 0);
    } catch {}
  }

  useEffect(() => {
    const refresh = () => { if (!document.hidden) void fetchCount(); };
    refresh();
    const id = setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", refresh); };
  }, []);

  return (
    <Link
      href="/dashboard/notifications"
      title="Notifications"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      aria-current={active ? "page" : undefined}
      className={`workspace-notification relative flex rounded-md p-1.5 transition ${
        active ? "text-text" : "text-text-muted hover:bg-white/[0.04] hover:text-text"
      }`}
    >
      <Bell className="h-4 w-4" />
      {unread > 0 && (
        <span aria-hidden="true" className="workspace-notification-count">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
