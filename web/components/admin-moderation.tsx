"use client";
import { useState } from "react";
import Link from "next/link";
import { CheckCircle, Trash2, Loader2, AlertTriangle } from "lucide-react";

type FlaggedPost = {
  id: string;
  title: string;
  body: string;
  createdAt: string | Date;
  user: { name: string | null; username: string | null };
  forum: { title: string };
};

type FlaggedComment = {
  id: string;
  body: string;
  createdAt: string | Date;
  user: { name: string | null; username: string | null };
  post: { title: string };
};

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function displayName(user: { name: string | null; username: string | null }) {
  if (user.username) return `@${user.username}`;
  return user.name ?? "Unknown";
}

function ActionButtons({
  id,
  type,
  onApproved,
  onDeleted,
}: {
  id: string;
  type: "post" | "comment";
  onApproved: () => void;
  onDeleted: () => void;
}) {
  const [approving, setApproving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "delete") {
    const setter = action === "approve" ? setApproving : setDeleting;
    setter(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/forums/${type}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        setError("Action failed");
        return;
      }
      if (action === "approve") onApproved();
      else onDeleted();
    } finally {
      setter(false);
    }
  }

  return (
    <div className="flex items-center gap-2 mt-3">
      <button
        onClick={() => act("approve")}
        disabled={approving || deleting}
        className="flex items-center gap-1.5 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-300 transition hover:bg-green-500/20 disabled:opacity-50"
      >
        {approving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <CheckCircle className="h-3.5 w-3.5" />
        )}
        Approve
      </button>
      <button
        onClick={() => act("delete")}
        disabled={approving || deleting}
        className="flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
      >
        {deleting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
        Delete
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}

export function ModerationClient({
  flaggedPosts: initialPosts,
  flaggedComments: initialComments,
}: {
  flaggedPosts: FlaggedPost[];
  flaggedComments: FlaggedComment[];
}) {
  const [tab, setTab] = useState<"posts" | "comments">("posts");
  const [posts, setPosts] = useState<FlaggedPost[]>(initialPosts);
  const [comments, setComments] = useState<FlaggedComment[]>(initialComments);

  function removePost(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  function removeComment(id: string) {
    setComments((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-bg-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <span className="font-semibold">Moderation</span>
            <span className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-200">
              Admin
            </span>
          </div>
          <Link href="/admin" className="text-sm text-text-muted hover:text-text">
            ← Admin
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Forum Moderation</h1>
          <p className="mt-1 text-sm text-text-muted">
            Review AI-flagged content for policy violations.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 border-b border-bg-border">
          <button
            onClick={() => setTab("posts")}
            className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
              tab === "posts"
                ? "border-text text-text"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            Posts
            {posts.length > 0 && (
              <span className="ml-2 rounded-full bg-red-500/20 px-1.5 py-0.5 text-xs text-red-300">
                {posts.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("comments")}
            className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
              tab === "comments"
                ? "border-text text-text"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            Comments
            {comments.length > 0 && (
              <span className="ml-2 rounded-full bg-red-500/20 px-1.5 py-0.5 text-xs text-red-300">
                {comments.length}
              </span>
            )}
          </button>
        </div>

        {/* Posts tab */}
        {tab === "posts" && (
          <div className="space-y-4">
            {posts.length === 0 && (
              <div className="card p-8 text-center">
                <p className="text-text-muted text-sm">No flagged posts.</p>
              </div>
            )}
            {posts.map((post) => (
              <div key={post.id} className="card p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <p className="font-semibold text-sm">{post.title}</p>
                        <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5 flex-wrap">
                          <span>by {displayName(post.user)}</span>
                          <span>·</span>
                          <span>in {post.forum.title}</span>
                          <span>·</span>
                          <span>{formatDate(post.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-text-muted leading-relaxed line-clamp-4 whitespace-pre-wrap">
                      {post.body}
                    </p>
                    <ActionButtons
                      id={post.id}
                      type="post"
                      onApproved={() => removePost(post.id)}
                      onDeleted={() => removePost(post.id)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Comments tab */}
        {tab === "comments" && (
          <div className="space-y-4">
            {comments.length === 0 && (
              <div className="card p-8 text-center">
                <p className="text-text-muted text-sm">No flagged comments.</p>
              </div>
            )}
            {comments.map((comment) => (
              <div key={comment.id} className="card p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-text-muted flex-wrap">
                      <span>by {displayName(comment.user)}</span>
                      <span>·</span>
                      <span>on &ldquo;{comment.post.title}&rdquo;</span>
                      <span>·</span>
                      <span>{formatDate(comment.createdAt)}</span>
                    </div>
                    <p className="mt-2 text-sm text-text-muted leading-relaxed line-clamp-4 whitespace-pre-wrap">
                      {comment.body}
                    </p>
                    <ActionButtons
                      id={comment.id}
                      type="comment"
                      onApproved={() => removeComment(comment.id)}
                      onDeleted={() => removeComment(comment.id)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
