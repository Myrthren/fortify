"use client";

import { useState } from "react";

type BanUser = {
  id: string;
  username: string | null;
  name: string | null;
  discordId: string | null;
};

type Ban = {
  id: string;
  userId: string;
  type: string;
  reason: string | null;
  permanent: boolean;
  expiresAt: string | null;
  createdAt: string;
  unbannedAt: null;
  user: BanUser;
};

type AllUser = {
  id: string;
  username: string | null;
  name: string | null;
  discordId: string | null;
  email: string | null;
};

function timeUntil(expiresAt: string | null, permanent: boolean): string {
  if (permanent) return "∞";
  if (!expiresAt) return "∞";
  const now = Date.now();
  const end = new Date(expiresAt).getTime();
  const diff = end - now;
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins}m`;
}

export function BanManagerClient({
  initialBans,
  allUsers,
}: {
  initialBans: Ban[];
  allUsers: AllUser[];
}) {
  const [bans, setBans] = useState<Ban[]>(initialBans);
  const [unbanning, setUnbanning] = useState<string | null>(null);

  // Ban form state
  const [selectedUserId, setSelectedUserId] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [banType, setBanType] = useState<"PLATFORM" | "SOFTWARE">("PLATFORM");
  const [reason, setReason] = useState("");
  const [permanent, setPermanent] = useState(false);
  const [durationDays, setDurationDays] = useState("7");
  const [banning, setBanning] = useState(false);
  const [banError, setBanError] = useState<string | null>(null);
  const [banSuccess, setBanSuccess] = useState(false);

  const filteredUsers = allUsers.filter((u) => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.discordId?.includes(q)
    );
  });

  async function handleUnban(banId: string) {
    setUnbanning(banId);
    try {
      const res = await fetch(`/api/admin/bans/${banId}/unban`, { method: "POST" });
      if (res.ok) {
        setBans((prev) => prev.filter((b) => b.id !== banId));
      }
    } finally {
      setUnbanning(null);
    }
  }

  async function handleBan(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId) {
      setBanError("Select a user.");
      return;
    }
    setBanning(true);
    setBanError(null);
    setBanSuccess(false);
    try {
      const res = await fetch("/api/admin/bans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          type: banType,
          reason: reason.trim() || null,
          permanent,
          durationDays: permanent ? undefined : parseInt(durationDays, 10) || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanError(data.error ?? "Failed to ban user.");
      } else {
        setBanSuccess(true);
        // Add to list
        const bannedUser = allUsers.find((u) => u.id === selectedUserId);
        setBans((prev) => [
          {
            id: data.ban.id,
            userId: selectedUserId,
            type: banType,
            reason: reason.trim() || null,
            permanent,
            expiresAt: data.ban.expiresAt ?? null,
            createdAt: data.ban.createdAt,
            unbannedAt: null,
            user: bannedUser ?? { id: selectedUserId, username: null, name: null, discordId: null },
          },
          ...prev,
        ]);
        setReason("");
        setSelectedUserId("");
        setUserSearch("");
      }
    } finally {
      setBanning(false);
    }
  }

  const totalBans = bans.length;
  const platformBans = bans.filter((b) => b.type === "PLATFORM").length;
  const softwareBans = bans.filter((b) => b.type === "SOFTWARE").length;

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-bg-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <span className="text-lg font-semibold tracking-tight">Ban Manager</span>
            <span className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-300">
              Admin
            </span>
          </div>
          <a href="/admin" className="text-sm text-text-muted hover:text-text">
            ← Admin
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-6 py-12">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-5 text-center">
            <p className="text-3xl font-bold tabular-nums">{totalBans}</p>
            <p className="mt-1 text-sm text-text-muted">Active bans</p>
          </div>
          <div className="card p-5 text-center">
            <p className="text-3xl font-bold tabular-nums">{platformBans}</p>
            <p className="mt-1 text-sm text-text-muted">Platform bans</p>
          </div>
          <div className="card p-5 text-center">
            <p className="text-3xl font-bold tabular-nums">{softwareBans}</p>
            <p className="mt-1 text-sm text-text-muted">Software bans</p>
          </div>
        </div>

        {/* Ban a user */}
        <section>
          <h2 className="text-lg font-semibold tracking-tight mb-1">Ban a user</h2>
          <p className="text-sm text-text-muted mb-4">Platform ban blocks dashboard access. Software ban also blocks the desktop app.</p>
          <div className="card p-5">
            <form onSubmit={handleBan} className="space-y-4">
              {/* User search */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">User</label>
                <input
                  type="text"
                  placeholder="Search by name, username, email, or Discord ID..."
                  value={userSearch}
                  onChange={(e) => { setUserSearch(e.target.value); setSelectedUserId(""); }}
                  className="input w-full"
                />
                {userSearch && (
                  <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-bg-border bg-bg-panel shadow-xl">
                    {filteredUsers.slice(0, 20).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => { setSelectedUserId(u.id); setUserSearch(`${u.name ?? u.username ?? u.email ?? u.id}`); }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-white/[0.04]"
                      >
                        <div>
                          <p className="font-medium">{u.name ?? "—"}</p>
                          <p className="text-xs text-text-muted">
                            @{u.username ?? "no username"} · {u.email ?? "—"} · Discord: {u.discordId ?? "—"}
                          </p>
                        </div>
                      </button>
                    ))}
                    {filteredUsers.length === 0 && (
                      <p className="px-4 py-3 text-sm text-text-muted">No users found.</p>
                    )}
                  </div>
                )}
                {selectedUserId && (
                  <p className="mt-1.5 text-xs text-green-400">Selected: {selectedUserId}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Ban type */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Ban type</label>
                  <select
                    value={banType}
                    onChange={(e) => setBanType(e.target.value as "PLATFORM" | "SOFTWARE")}
                    className="input w-full"
                  >
                    <option value="PLATFORM">Platform ban</option>
                    <option value="SOFTWARE">Software ban (includes platform)</option>
                  </select>
                </div>

                {/* Duration */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Duration</label>
                  <div className="flex items-center gap-3">
                    {!permanent && (
                      <input
                        type="number"
                        min={1}
                        value={durationDays}
                        onChange={(e) => setDurationDays(e.target.value)}
                        placeholder="Days"
                        className="input flex-1"
                      />
                    )}
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={permanent}
                        onChange={(e) => setPermanent(e.target.checked)}
                        className="rounded"
                      />
                      Permanent
                    </label>
                  </div>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">Reason (optional)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="Why is this user being banned?"
                  className="input w-full resize-none"
                />
              </div>

              {banError && <p className="text-sm text-red-400">{banError}</p>}
              {banSuccess && <p className="text-sm text-green-400">User banned successfully.</p>}

              <button
                type="submit"
                disabled={banning || !selectedUserId}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {banning ? "Banning..." : "Issue ban"}
              </button>
            </form>
          </div>
        </section>

        {/* Active bans table */}
        <section>
          <h2 className="text-lg font-semibold tracking-tight mb-1">Active bans</h2>
          <p className="text-sm text-text-muted mb-4">{totalBans} ban{totalBans !== 1 ? "s" : ""} currently active.</p>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-bg-border bg-black/20">
                  <tr>
                    <th className="px-4 py-2.5 font-medium text-text-muted">User</th>
                    <th className="px-4 py-2.5 font-medium text-text-muted">Discord ID</th>
                    <th className="px-4 py-2.5 font-medium text-text-muted">Type</th>
                    <th className="px-4 py-2.5 font-medium text-text-muted">Reason</th>
                    <th className="px-4 py-2.5 font-medium text-text-muted">Banned at</th>
                    <th className="px-4 py-2.5 font-medium text-text-muted">Permanent</th>
                    <th className="px-4 py-2.5 font-medium text-text-muted">Time left</th>
                    <th className="px-4 py-2.5 font-medium text-text-muted">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bans.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-text-muted">
                        No active bans.
                      </td>
                    </tr>
                  )}
                  {bans.map((ban) => (
                    <tr key={ban.id} className="border-b border-bg-border/50 last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium">{ban.user.name ?? "—"}</p>
                        <p className="text-xs text-text-muted">@{ban.user.username ?? "no username"}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-text-muted">
                        {ban.user.discordId ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                            ban.type === "SOFTWARE"
                              ? "bg-red-500/15 text-red-300"
                              : "bg-orange-500/15 text-orange-300"
                          }`}
                        >
                          {ban.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-muted max-w-[200px] truncate">
                        {ban.reason ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-text-muted tabular-nums text-xs">
                        {new Date(ban.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {ban.permanent ? (
                          <span className="text-red-400 font-semibold">Yes</span>
                        ) : (
                          <span className="text-text-muted">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums font-mono text-sm">
                        {timeUntil(ban.expiresAt, ban.permanent)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          disabled={unbanning === ban.id}
                          onClick={() => handleUnban(ban.id)}
                          className="rounded-md border border-bg-border px-3 py-1 text-xs text-text-muted transition hover:border-white/20 hover:text-text disabled:opacity-40"
                        >
                          {unbanning === ban.id ? "..." : "Unban"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
