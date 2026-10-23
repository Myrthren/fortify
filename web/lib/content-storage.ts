import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  workspaceUserId,
  mutationOrigin,
  workspaceError,
} from "@/lib/workspace-request";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import {
  contentAccess,
  type ContentKind,
  type ContentDocument,
  type DecisionDocument,
  type StoryDocument,
  type TestDocument,
} from "./content-workspace";

export class ContentError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function contentError(error: unknown) {
  return workspaceError(
    error instanceof SyntaxError
      ? "This request could not be read."
      : error instanceof ContentError
        ? error.message
        : "Your work could not be saved or loaded. Please try again.",
    error instanceof ContentError
      ? error.status
      : error instanceof SyntaxError
        ? 400
        : 503,
  );
}
export async function contentActor(req: Request, mutate = true) {
  const userId = await workspaceUserId();
  if (!userId) return workspaceError("Sign in to open your workspace.", 401);
  if (mutate && !mutationOrigin(req))
    return workspaceError("Request origin was rejected.", 403);
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, tier: true },
  });
  if (!user) return workspaceError("Sign in again.", 401);
  const limit = rateLimit(
    `content:${mutate ? "write" : "read"}:${userId}`,
    mutate ? 40 : 150,
    60000,
  );
  if (!limit.ok) return rateLimitResponse(limit.resetMs);
  return user;
}
export function requireContentAccess(kind: ContentKind, tier: string) {
  if (!contentAccess(kind, tier))
    throw new ContentError(
      "Your plan does not include this workspace. Open Pricing to compare access.",
      403,
    );
}
export async function contentBody(req: Request) {
  if (Number(req.headers.get("content-length") || 0) > 192000)
    throw new ContentError("Keep each document below 192 KB.");
  const raw = await req.text();
  if (raw.length > 192000)
    throw new ContentError("Keep each document below 192 KB.");
  const b = JSON.parse(raw);
  if (!b || typeof b !== "object" || Array.isArray(b))
    throw new ContentError("Invalid workspace request.");
  return b as Record<string, unknown>;
}
export function validated<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    throw new ContentError(
      e instanceof Error ? e.message : "Invalid document.",
    );
  }
}
export function contentVersion(v: unknown) {
  if (!Number.isInteger(v) || Number(v) < 1)
    throw new ContentError("Reload this saved record before making changes.");
  return Number(v);
}
export async function validateContentLinks(
  userId: string,
  kind: ContentKind,
  document: ContentDocument,
) {
  const reference =
    kind === "story"
      ? (document as StoryDocument).researchId
      : kind === "test"
        ? (document as TestDocument).storyId
        : "";
  if (
    reference &&
    !(await db.contentRecord.findFirst({
      where: {
        id: reference,
        userId,
        kind: kind === "story" ? "research" : "story",
      },
      select: { id: true },
    }))
  )
    throw new ContentError(
      "The linked source record is not available in your account.",
    );
  if (kind === "test") {
    const ids = [
      ...new Set(
        (document as TestDocument).versions
          .map((v) => v.mediaId)
          .filter(Boolean),
      ),
    ];
    if (
      ids.length &&
      (await db.mediaItem.count({ where: { userId, id: { in: ids } } })) !==
        ids.length
    )
      throw new ContentError("Choose media from your own library.");
  }
}
export function contentHistory(
  existing: unknown,
  version: number,
  kind: ContentKind,
  document: ContentDocument,
) {
  const history = Array.isArray(existing) ? existing.slice(-19) : [];
  let detail = "Research updated";
  if (kind === "story")
    detail = (document as StoryDocument).approved
      ? "Story approved"
      : "Story draft updated";
  if (kind === "test")
    detail = (document as TestDocument).conclusion
      ? "Test outcome recorded"
      : "Test and observations updated";
  if (kind === "decision") {
    const d = document as DecisionDocument;
    detail = `${d.options.find((o) => o.id === d.selected)?.title || "No option selected"} · ${d.currency} ${d.budget} available${d.outcome ? " · Outcome recorded" : ""}`;
  }
  return [...history, { version, at: new Date().toISOString(), detail }];
}
export const contentJson = (record: unknown, status = 200) =>
  NextResponse.json({ record }, { status });
