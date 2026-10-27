import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/lib/db";

const TAG = "announcements";
const readAnnouncements = unstable_cache(
  async () => (await db.announcement.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, message: true, expiresAt: true },
  })).map(({ id, message, expiresAt }) => ({ id, message, expiresAt: expiresAt?.toISOString() ?? null })),
  [TAG],
  { revalidate: 30, tags: [TAG] },
);

export async function getAnnouncements() {
  const now = Date.now();
  return (await readAnnouncements()).filter(item => !item.expiresAt || Date.parse(item.expiresAt) > now);
}

export function invalidateAnnouncements() { revalidateTag(TAG); }
