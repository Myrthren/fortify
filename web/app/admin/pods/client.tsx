"use client";

import { useState } from "react";
import { Plus, Trash2, UserMinus, UserPlus, Users } from "lucide-react";

type PodUser = { id: string; email: string | null; username: string | null; tier: string; discordId: string | null };
type ApexUser = { id: string; email: string | null; username: string | null; discordId: string | null };
type Pod = { id: string; name: string; members: { userId: string; user: PodUser }[] };

export function PodsClient({
  initialPods,
  apexUsers,
}: {
  initialPods: Pod[];
  apexUsers: ApexUser[];
}) {
  const [pods, setPods] = useState<Pod[]>(initialPods);
  const [newPodName, setNewPodName] = useState("");
  const [creating, setCreating] = useState(false);

  // For adding member: { podId, userId }
  const [addTarget, setAddTarget] = useState<{ podId: string; userId: string } | null>(null);
  const [addingMember, setAddingMember] = useState(false);

  const [busy, setBusy] = useState<string | null>(null); // podId or memberId for loading states

  async function createPod() {
    if (!newPodName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/pods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name: newPodName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setPods((p) => [{ id: data.pod.id, name: data.pod.name, members: [] }, ...p]);
        setNewPodName("");
      } else {
        alert(data.error ?? "Failed to create pod");
      }
    } finally {
      setCreating(false);
    }
  }

  async function deletePod(podId: string) {
    if (!confirm("Delete this pod and remove all its members?")) return;
    setBusy(podId);
    try {
      const res = await fetch("/api/admin/pods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_pod", podId }),
      });
      if (res.ok) {
        setPods((p) => p.filter((pod) => pod.id !== podId));
      } else {
        const d = await res.json();
        alert(d.error ?? "Failed to delete pod");
      }
    } finally {
      setBusy(null);
    }
  }

  async function addMember() {
    if (!addTarget) return;
    setAddingMember(true);
    try {
      const res = await fetch("/api/admin/pods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_member", ...addTarget }),
      });
      const data = await res.json();
      if (res.ok) {
        const user = apexUsers.find((u) => u.id === addTarget.userId);
        if (user) {
          setPods((p) =>
            p.map((pod) =>
              pod.id === addTarget.podId
                ? {
                    ...pod,
                    members: [
                      ...pod.members.filter((m) => m.userId !== addTarget.userId),
                      { userId: addTarget.userId, user: { ...user, tier: "APEX" } },
                    ],
                  }
                : pod
            )
          );
        }
        setAddTarget(null);
      } else {
        alert(data.error ?? "Failed to add member");
      }
    } finally {
      setAddingMember(false);
    }
  }

  async function removeMember(podId: string, userId: string) {
    setBusy(`${podId}:${userId}`);
    try {
      const res = await fetch("/api/admin/pods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove_member", podId, userId }),
      });
      if (res.ok) {
        setPods((p) =>
          p.map((pod) =>
            pod.id === podId
              ? { ...pod, members: pod.members.filter((m) => m.userId !== userId) }
              : pod
          )
        );
      } else {
        const d = await res.json();
        alert(d.error ?? "Failed to remove member");
      }
    } finally {
      setBusy(null);
    }
  }

  // Users already in a pod (for filtering add dropdown)
  const assignedUserIds = new Set(pods.flatMap((p) => p.members.map((m) => m.userId)));

  return (
    <div className="space-y-8">
      {/* Create pod */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">Create Pod</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={newPodName}
            onChange={(e) => setNewPodName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createPod()}
            placeholder="Pod name (e.g. Titan Group)"
            className="input flex-1"
          />
          <button
            onClick={createPod}
            disabled={creating || !newPodName.trim()}
            className="btn-primary flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            {creating ? "Creating…" : "Create"}
          </button>
        </div>
      </div>

      {/* Apex users not in any pod */}
      {apexUsers.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-text-muted">
            Apex Members ({apexUsers.length})
          </h2>
          <div className="rounded-xl border border-white/[0.07] overflow-hidden" style={{ background: "linear-gradient(145deg,#141414,#0d0d0d)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] text-left text-xs text-text-muted">
                  <th className="px-4 py-2.5">User</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {apexUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{u.username ? `@${u.username}` : u.email ?? u.id}</p>
                      {u.discordId && <p className="text-[11px] text-text-dim">Discord: {u.discordId}</p>}
                    </td>
                    <td className="px-4 py-2.5">
                      {assignedUserIds.has(u.id) ? (
                        <span className="text-xs text-green-400">In a pod</span>
                      ) : (
                        <span className="text-xs text-text-muted">Unassigned</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pod list */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">
          All Pods ({pods.length})
        </h2>

        {pods.length === 0 ? (
          <div className="card p-8 text-center">
            <Users className="mx-auto mb-3 h-7 w-7 text-text-muted opacity-50" />
            <p className="text-sm text-text-muted">No pods yet. Create one above.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pods.map((pod) => {
              const availableToAdd = apexUsers.filter(
                (u) => !pod.members.some((m) => m.userId === u.id)
              );
              return (
                <div
                  key={pod.id}
                  className="rounded-xl border border-white/[0.07] overflow-hidden"
                  style={{ background: "linear-gradient(145deg,#141414,#0d0d0d)" }}
                >
                  <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
                    <div>
                      <p className="font-semibold">{pod.name}</p>
                      <p className="text-xs text-text-muted">{pod.members.length} member{pod.members.length !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Add member */}
                      {availableToAdd.length > 0 && (
                        addTarget?.podId === pod.id ? (
                          <div className="flex items-center gap-2">
                            <select
                              className="input text-sm py-1"
                              value={addTarget.userId}
                              onChange={(e) => setAddTarget({ podId: pod.id, userId: e.target.value })}
                            >
                              <option value="">Select member…</option>
                              {availableToAdd.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.username ? `@${u.username}` : u.email ?? u.id}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={addMember}
                              disabled={!addTarget.userId || addingMember}
                              className="btn-primary text-xs py-1 px-2.5"
                            >
                              {addingMember ? "Adding…" : "Add"}
                            </button>
                            <button
                              onClick={() => setAddTarget(null)}
                              className="text-xs text-text-muted hover:text-text"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAddTarget({ podId: pod.id, userId: "" })}
                            className="flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1 text-xs text-text-muted hover:text-text transition"
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            Add member
                          </button>
                        )
                      )}
                      <button
                        onClick={() => deletePod(pod.id)}
                        disabled={busy === pod.id}
                        className="rounded-md border border-red-500/20 bg-red-500/5 p-1.5 text-red-400 transition hover:bg-red-500/15"
                        title="Delete pod"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {pod.members.length === 0 ? (
                    <p className="px-5 py-3 text-xs text-text-muted">No members yet.</p>
                  ) : (
                    <ul className="divide-y divide-white/[0.05]">
                      {pod.members.map((m) => (
                        <li key={m.userId} className="flex items-center justify-between px-5 py-3">
                          <div>
                            <p className="text-sm font-medium">
                              {m.user.username ? `@${m.user.username}` : m.user.email ?? m.userId}
                            </p>
                            {m.user.discordId && (
                              <p className="text-[11px] text-text-dim">Discord: {m.user.discordId}</p>
                            )}
                          </div>
                          <button
                            onClick={() => removeMember(pod.id, m.userId)}
                            disabled={busy === `${pod.id}:${m.userId}`}
                            className="rounded-md border border-white/10 p-1 text-text-muted transition hover:text-text disabled:opacity-50"
                            title="Remove from pod"
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
