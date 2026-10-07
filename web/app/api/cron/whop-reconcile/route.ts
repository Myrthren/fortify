import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncWhopTier } from "@/lib/whop";

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) return new NextResponse("Unauthorized", { status: 401 });
  let cursor: string | undefined;
  let checked = 0;
  let failed = 0;
  do {
    const users = await db.user.findMany({
      where: { whopUserId: { not: null } },
      select: { id: true, whopUserId: true },
      orderBy: { id: "asc" },
      take: 50,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!users.length) break;
    // Bound concurrency to avoid overloading Whop and Discord.
    for (let i = 0; i < users.length; i += 5) {
      await Promise.all(users.slice(i, i + 5).map(async (user) => {
        try { await syncWhopTier(user.id, user.whopUserId!); checked++; }
        catch (error) { failed++; console.error("[whop/reconcile]", user.id, error); }
      }));
    }
    cursor = users[users.length - 1].id;
  } while (true);
  return NextResponse.json({ ok: failed === 0, checked, failed }, { status: failed ? 503 : 200 });
}
