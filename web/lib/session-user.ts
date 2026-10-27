import "server-only";
import { cache } from "react";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// Request-local deduplication only. Never put account/session data in the
// cross-request Data Cache used for public appearance and announcements.
export const dashboardSession = cache(() => auth());

/**
 * Fetch the signed-in user including their profile/subscription, deduped
 * within a single request via React `cache`. Multiple page+layout calls
 * in the same render tree share one query.
 *
 * Throws (returns null) if not signed in. Callers redirect.
 */
export const currentUser = cache(async () => {
  const session = await dashboardSession();
  if (!session?.user) return null;
  const id = (session.user as any).id as string;

  return db.user.findUnique({
    where: { id },
    include: { profile: true, subscription: true },
  });
});
