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
    fetchCount();
    const id = setInterval(fetchCount, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <Link
      href="/dashboard/notifications"
      title="Notifications"
      className={`relative hidden rounded-md p-1.5 transition md:flex ${
        active ? "text-text" : "text-text-muted hover:bg-white/[0.04] hover:text-text"
      }`}
    >
      <Bell className="h-4 w-4" />
      {unread > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
