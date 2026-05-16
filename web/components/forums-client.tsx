"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, MessageSquare, Loader2, Pin } from "lucide-react";

type Forum = {
  id: string;
  title: string;
  description: string | null;
  pinned: boolean;
  createdAt: string | Date;
  postCount: number;
};

export function ForumsClient({
  initialForums,
  isBanned,
}: {
  initialForums: Forum[];
  isBanned: boolean;
}) {
  const [forums, setForums] = useState<Forum[]>(initialForums);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function create() {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/forums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: desc }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      setForums([{ ...data.forum, postCount: 0 }, ...forums]);
      setTitle("");
      setDesc("");
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      {!isBanned && (
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> New forum
        </button>
      )}
      {isBanned && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          You are currently banned from community features.
        </div>
      )}

      {showCreate && (
        <div className="card p-5 space-y-3">
          <input
            className="input w-full"
            placeholder="Forum title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <textarea
            className="input w-full min-h-[60px]"
            placeholder="Description (optional)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={create}
              disabled={creating || !title.trim()}
              className="btn-primary flex items-center gap-2"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Create"
              )}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {forums.length === 0 && (
        <p className="text-center text-sm text-text-muted py-8">
          No forums yet. Create the first one!
        </p>
      )}

      <div className="space-y-2">
        {forums.map((f) => (
          <button
            key={f.id}
            onClick={() => router.push(`/dashboard/forums/${f.id}`)}
            className="card w-full p-4 text-left hover:border-bg-border/80 hover:bg-bg-panel transition"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {f.pinned && (
                    <Pin className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  )}
                  <p className="font-medium text-sm">{f.title}</p>
                </div>
                {f.description && (
                  <p className="mt-0.5 text-xs text-text-muted truncate">
                    {f.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-text-muted shrink-0">
                <MessageSquare className="h-3.5 w-3.5" />
                {f.postCount}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
