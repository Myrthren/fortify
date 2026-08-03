"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2, UserMinus, UserPlus } from "lucide-react";

type PodUser = {
  id: string;
  email: string | null;
  username: string | null;
  tier: string;
  discordId: string | null;
};

type Pod = {
  id: string;
  name: string;
  members: { user: PodUser }[];
};

export function AdminPodManager({
  initial,
  apexUsers,
}: {
  initial: Pod[];
  apexUsers: { id: string; name: string | null; email: string | null }[];
}) {
  const [pods, setPods] = useState<Pod[]>(initial);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addTarget, setAddTarget] = useState<Record<string, string>>({});

  async function post(body: Record<string, unknown>) {
    const res = await fetch("/api/admin/pods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Request failed");
    return data;
  }

  async function refresh() {
    const res = await fetch("/api/admin/pods");
    if (res.ok) {
      const data = await res.json();
      setPods(data.pods ?? []);
    }
  }

  async function createPod() {
    if (!name.trim()) {
      setError("Name required");
      return;
    }
    setError(null);
    setAdding(true);
    try {
      await post({ action: "create", name: name.trim() });
      setName("");
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  }

  async function addMember(podId: string) {
    const userId = addTarget[podId];
    if (!userId) return;
    setError(null);
    setBusy(`add-${podId}`);
    try {
      await post({ action: "add_member", podId, userId });
      setAddTarget((p) => ({ ...p, [podId]: "" }));
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function removeMember(podId: string, userId: string) {
    setError(null);
    setBusy(`rm-${podId}-${userId}`);
    try {
      await post({ action: "remove_member", podId, userId });
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function deletePod(podId: string, podName: string) {
    if (!confirm(`Delete pod "${podName}"? Members will be unassigned.`)) return;
    setError(null);
    setBusy(`del-${podId}`);
    try {
      await post({ action: "delete_pod", podId });
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  // Users already in a pod shouldn't show as candidates — the API moves them anyway.
  const assigned = new Set(pods.flatMap((p) => p.members.map((m) => m.user.id)));

  return (
    <div className="space-y-5">
      {/* Create pod */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="input flex-1"
          placeholder="Pod name — e.g. Apex Pod 1"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createPod()}
        />
        <button onClick={createPod} disabled={adding} className="btn-primary">
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Create pod
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {pods.length === 0 ? (
        <p className="text-sm text-text-dim">No pods yet.</p>
      ) : (
        <div className="space-y-3">
          {pods.map((pod) => (
            <div key={pod.id} className="rounded-lg border border-bg-border bg-bg-panel p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-text">{pod.name}</p>
                  <p className="text-xs text-text-dim">
                    {pod.members.length} member{pod.members.length === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  onClick={() => deletePod(pod.id, pod.name)}
                  disabled={busy === `del-${pod.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-900/40 px-2.5 py-1 text-xs font-medium text-red-400 transition hover:bg-red-950/30 disabled:opacity-50"
                >
                  {busy === `del-${pod.id}` ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                  Delete
                </button>
              </div>

              {pod.members.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {pod.members.map(({ user }) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between rounded-md bg-white/[0.03] px-2.5 py-1.5"
                    >
                      <span className="min-w-0 truncate text-sm text-text-muted">
                        {user.username ?? user.email ?? user.id}
                        <span className="ml-2 text-[11px] text-text-dim">{user.tier}</span>
                      </span>
                      <button
                        onClick={() => removeMember(pod.id, user.id)}
                        disabled={busy === `rm-${pod.id}-${user.id}`}
                        className="shrink-0 inline-flex items-center gap-1 text-[11px] text-text-dim transition hover:text-red-400 disabled:opacity-50"
                      >
                        {busy === `rm-${pod.id}-${user.id}` ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <UserMinus className="h-3 w-3" />
                        )}
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add member */}
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <select
                  className="input flex-1 text-sm"
                  value={addTarget[pod.id] ?? ""}
                  onChange={(e) => setAddTarget((p) => ({ ...p, [pod.id]: e.target.value }))}
                >
                  <option value="">Add an Apex member…</option>
                  {apexUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name ?? u.email ?? u.id}
                      {assigned.has(u.id) ? " (in a pod — will move)" : ""}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => addMember(pod.id)}
                  disabled={!addTarget[pod.id] || busy === `add-${pod.id}`}
                  className="btn-secondary inline-flex items-center gap-1.5 text-sm"
                >
                  {busy === `add-${pod.id}` ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="h-3.5 w-3.5" />
                  )}
                  Add
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
