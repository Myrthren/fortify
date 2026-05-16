"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  MessageSquare,
  Pin,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
  Send,
} from "lucide-react";
import type { Tier } from "@prisma/client";

type PostUser = {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
  avatarUrl: string | null;
  tier: Tier;
};

type Post = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  flagged: boolean;
  createdAt: string;
  commentCount: number;
  user: PostUser;
};

type Comment = {
  id: string;
  body: string;
  flagged: boolean;
  createdAt: string;
  user: PostUser;
};

type Forum = {
  id: string;
  title: string;
  description: string | null;
};

const TIER_COLORS: Record<Tier, string> = {
  FREE: "text-text-muted border-bg-border",
  PRO: "text-blue-300 border-blue-500/30",
  ELITE: "text-purple-300 border-purple-500/30",
  APEX: "text-amber-300 border-amber-500/30",
};

function UserAvatar({ user, size = 32 }: { user: PostUser; size?: number }) {
  const src = user.avatarUrl || user.image;
  const initials = (user.username || user.name || "?")[0].toUpperCase();
  if (src) {
    return (
      <Image
        src={src}
        alt={user.name ?? user.username ?? "user"}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-bg-panel border border-bg-border flex items-center justify-center text-xs font-medium text-text-muted shrink-0"
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  );
}

function TierBadge({ tier }: { tier: Tier }) {
  if (tier === "FREE") return null;
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${TIER_COLORS[tier]}`}
    >
      {tier}
    </span>
  );
}

function DisplayName({ user }: { user: PostUser }) {
  return (
    <span className="text-sm font-medium">
      {user.username ? `@${user.username}` : (user.name ?? "Unknown")}
    </span>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function CommentItem({ comment }: { comment: Comment }) {
  if (comment.flagged) {
    return (
      <div className="flex gap-3 opacity-50">
        <UserAvatar user={comment.user} size={28} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <DisplayName user={comment.user} />
            <TierBadge tier={comment.user.tier} />
            <span className="text-xs text-text-muted">
              {formatDate(comment.createdAt)}
            </span>
          </div>
          <p className="text-sm text-text-muted italic">
            This comment is under review.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <UserAvatar user={comment.user} size={28} />
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <DisplayName user={comment.user} />
          <TierBadge tier={comment.user.tier} />
          <span className="text-xs text-text-muted">
            {formatDate(comment.createdAt)}
          </span>
        </div>
        <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">
          {comment.body}
        </p>
      </div>
    </div>
  );
}

function PostExpanded({
  post,
  forumId,
  isBanned,
  currentUserId,
}: {
  post: Post;
  forumId: string;
  isBanned: boolean;
  currentUserId: string;
}) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [flaggedWarning, setFlaggedWarning] = useState(false);

  async function loadComments() {
    if (comments !== null) return;
    setLoadingComments(true);
    try {
      const res = await fetch(
        `/api/forums/${forumId}/posts/${post.id}/comments`
      );
      const data = await res.json();
      setComments(data.comments ?? []);
    } finally {
      setLoadingComments(false);
    }
  }

  // Load comments on mount of expanded state
  useEffect(() => {
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitComment() {
    if (!commentBody.trim()) return;
    setSubmitting(true);
    setCommentError(null);
    setFlaggedWarning(false);
    try {
      const res = await fetch(
        `/api/forums/${forumId}/posts/${post.id}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: commentBody }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setCommentError(data.error ?? "Failed to post comment");
        return;
      }
      if (data.flagged) {
        setFlaggedWarning(true);
      }
      setComments((prev) => [...(prev ?? []), data.comment]);
      setCommentBody("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-3 border-t border-bg-border pt-4 space-y-4">
      {/* Post body */}
      <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">
        {post.body}
      </p>

      {/* Comments section */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Comments
        </h4>

        {loadingComments && (
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading comments…
          </div>
        )}

        {comments !== null && comments.length === 0 && !loadingComments && (
          <p className="text-sm text-text-muted">
            No comments yet. Be the first!
          </p>
        )}

        {comments !== null && comments.length > 0 && (
          <div className="space-y-4">
            {comments.map((c) => (
              <CommentItem key={c.id} comment={c} />
            ))}
          </div>
        )}

        {/* Comment form */}
        {!isBanned && (
          <div className="space-y-2 pt-2">
            {flaggedWarning && (
              <div className="flex items-center gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Your comment has been submitted for review.
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                className="input flex-1 min-h-[60px] text-sm"
                placeholder="Write a comment…"
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
              />
              <button
                onClick={submitComment}
                disabled={submitting || !commentBody.trim()}
                className="btn-primary self-end flex items-center gap-2"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            {commentError && (
              <p className="text-sm text-red-400">{commentError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PostCard({
  post,
  forumId,
  isBanned,
  currentUserId,
}: {
  post: Post;
  forumId: string;
  isBanned: boolean;
  currentUserId: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`card p-4 transition ${post.flagged ? "opacity-60" : ""}`}
    >
      <div
        className="cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3 flex-1 min-w-0">
            <UserAvatar user={post.user} size={32} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                {post.pinned && (
                  <Pin className="h-3 w-3 text-amber-400 shrink-0" />
                )}
                {post.flagged && (
                  <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                )}
                <p className="font-semibold text-sm">
                  {post.flagged ? (
                    <span className="italic text-text-muted">
                      This post is under review
                    </span>
                  ) : (
                    post.title
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-muted flex-wrap">
                <DisplayName user={post.user} />
                <TierBadge tier={post.user.tier} />
                <span>·</span>
                <span>{formatDate(post.createdAt)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1 text-xs text-text-muted">
              <MessageSquare className="h-3.5 w-3.5" />
              {post.commentCount}
            </div>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-text-muted" />
            ) : (
              <ChevronDown className="h-4 w-4 text-text-muted" />
            )}
          </div>
        </div>
      </div>

      {expanded && !post.flagged && (
        <PostExpanded
          post={post}
          forumId={forumId}
          isBanned={isBanned}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}

export function ForumDetailClient({
  forum,
  initialPosts,
  isBanned,
  currentUserId,
}: {
  forum: Forum;
  initialPosts: Post[];
  isBanned: boolean;
  currentUserId: string;
}) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [flaggedWarning, setFlaggedWarning] = useState(false);

  async function createPost() {
    if (!newTitle.trim() || !newBody.trim()) return;
    setCreating(true);
    setCreateError(null);
    setFlaggedWarning(false);
    try {
      const res = await fetch(`/api/forums/${forum.id}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, body: newBody }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error ?? "Failed to create post");
        return;
      }
      if (data.flagged) {
        setFlaggedWarning(true);
      }
      const newPost: Post = {
        ...data.post,
        commentCount: 0,
        createdAt:
          typeof data.post.createdAt === "string"
            ? data.post.createdAt
            : new Date(data.post.createdAt).toISOString(),
      };
      setPosts([newPost, ...posts]);
      setNewTitle("");
      setNewBody("");
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/forums"
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text transition mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Forums
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{forum.title}</h1>
        {forum.description && (
          <p className="mt-1 text-sm text-text-muted">{forum.description}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        {!isBanned ? (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="btn-primary flex items-center gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            New post
          </button>
        ) : (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            You are currently banned from community features.
          </div>
        )}
      </div>

      {/* New post form */}
      {showCreate && (
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-sm">Create a new post</h3>
          <input
            className="input w-full"
            placeholder="Post title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <textarea
            className="input w-full min-h-[120px]"
            placeholder="Write your post…"
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
          />
          {flaggedWarning && (
            <div className="flex items-center gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Your post has been submitted for review before it becomes visible.
            </div>
          )}
          {createError && <p className="text-sm text-red-400">{createError}</p>}
          <div className="flex gap-2">
            <button
              onClick={createPost}
              disabled={creating || !newTitle.trim() || !newBody.trim()}
              className="btn-primary flex items-center gap-2"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Post"
              )}
            </button>
            <button
              onClick={() => {
                setShowCreate(false);
                setCreateError(null);
                setFlaggedWarning(false);
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Posts list */}
      {posts.length === 0 && (
        <p className="text-center text-sm text-text-muted py-8">
          No posts yet. Start the conversation!
        </p>
      )}

      <div className="space-y-3">
        {posts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            forumId={forum.id}
            isBanned={isBanned}
            currentUserId={currentUserId}
          />
        ))}
      </div>
    </div>
  );
}
