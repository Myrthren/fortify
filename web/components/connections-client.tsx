"use client";

import { useState } from "react";
import Link from "next/link";

type ConnUser = {
  id: string;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  image: string | null;
  tier?: string;
  profile?: { niche: string | null } | null;
};

type Connection = {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  from: ConnUser;
  to: ConnUser;
};

type PendingConnection = {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  from: ConnUser;
};

function Avatar({ user }: { user: ConnUser }) {
  const src = user.avatarUrl ?? user.image;
  const initials = (user.name ?? user.username ?? "?")[0].toUpperCase();
  if (src) {
    return <img src={src} alt={user.name ?? ""} className="h-10 w-10 rounded-full object-cover" />;
  }
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-medium">
      {initials}
    </div>
  );
}

function displayName(u: ConnUser) {
  return u.username ? `@${u.username}` : (u.name ?? "Unknown");
}

export function ConnectionsClient({
  currentUserId,
  initialConnections,
  initialPending,
}: {
  currentUserId: string;
  initialConnections: Connection[];
  initialPending: PendingConnection[];
}) {
  const [connections, setConnections] = useState<Connection[]>(initialConnections);
  const [pending, setPending] = useState<PendingConnection[]>(initialPending);
  const [acting, setActing] = useState<string | null>(null);

  async function handleAccept(connId: string) {
    setActing(connId);
    try {
      const res = await fetch(`/api/connections/${connId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACCEPTED" }),
      });
      if (res.ok) {
        const accepted = pending.find((p) => p.id === connId);
        if (accepted) {
          setConnections((prev) => [
            {
              id: accepted.id,
              fromUserId: accepted.fromUserId,
              toUserId: accepted.toUserId,
              status: "ACCEPTED",
              createdAt: accepted.createdAt,
              updatedAt: new Date().toISOString(),
              from: accepted.from,
              to: { id: currentUserId, name: null, username: null, avatarUrl: null, image: null },
            },
            ...prev,
          ]);
        }
        setPending((prev) => prev.filter((p) => p.id !== connId));
      }
    } finally {
      setActing(null);
    }
  }

  async function handleDecline(connId: string) {
    setActing(connId);
    try {
      const res = await fetch(`/api/connections/${connId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DECLINED" }),
      });
      if (res.ok) {
        setPending((prev) => prev.filter((p) => p.id !== connId));
      }
    } finally {
      setActing(null);
    }
  }

  async function handleRemove(connId: string) {
    setActing(connId);
    try {
      const res = await fetch(`/api/connections/${connId}`, { method: "DELETE" });
      if (res.ok) {
        setConnections((prev) => prev.filter((c) => c.id !== connId));
      }
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Pending requests */}
      {pending.length > 0 && (
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Pending requests ({pending.length})
          </h2>
          <div className="card divide-y divide-bg-border">
            {pending.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <Avatar user={p.from} />
                  <div>
                    <p className="font-medium">{displayName(p.from)}</p>
                    <p className="text-xs text-text-muted">Wants to connect</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={acting === p.id}
                    onClick={() => handleAccept(p.id)}
                    className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-bg transition hover:bg-white/90 disabled:opacity-50"
                  >
                    {acting === p.id ? "..." : "Accept"}
                  </button>
                  <button
                    disabled={acting === p.id}
                    onClick={() => handleDecline(p.id)}
                    className="rounded-md border border-bg-border px-3 py-1.5 text-sm text-text-muted transition hover:border-white/20 hover:text-text disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Accepted connections */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
          Your connections ({connections.length})
        </h2>
        {connections.length === 0 ? (
          <div className="card px-5 py-10 text-center text-sm text-text-muted">
            <p>No connections yet.</p>
            <p className="mt-1">
              Find members in the{" "}
              <Link href="/dashboard/members" className="underline underline-offset-4 hover:text-text">
                Member Directory
              </Link>{" "}
              to connect with.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {connections.map((c) => {
              const partner = c.fromUserId === currentUserId ? c.to : c.from;
              return (
                <div key={c.id} className="card flex items-start justify-between p-4">
                  <div className="flex items-start gap-3">
                    <Avatar user={partner} />
                    <div>
                      <p className="font-medium">{displayName(partner)}</p>
                      {partner.name && partner.username && (
                        <p className="text-xs text-text-muted">{partner.name}</p>
                      )}
                      {partner.profile?.niche && (
                        <p className="mt-0.5 text-xs text-text-muted">{partner.profile.niche}</p>
                      )}
                      {partner.tier && (
                        <span className="mt-1 inline-block rounded border border-bg-border bg-black/20 px-1.5 py-0.5 text-[10px]">
                          {partner.tier}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/dashboard/messages?with=${partner.id}`}
                      className="rounded-md border border-bg-border px-3 py-1.5 text-xs text-text-muted transition hover:border-white/20 hover:text-text"
                    >
                      Message
                    </Link>
                    <button
                      disabled={acting === c.id}
                      onClick={() => handleRemove(c.id)}
                      className="rounded-md px-2 py-1.5 text-xs text-text-muted transition hover:text-red-400 disabled:opacity-50"
                      title="Remove connection"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
