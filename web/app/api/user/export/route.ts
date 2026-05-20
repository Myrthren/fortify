import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * GET /api/user/export
 * Returns a full JSON export of the authenticated user's data for GDPR compliance.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const [
    user,
    profile,
    chatSessions,
    aiSessions,
    subscriptions,
    creditTransactions,
    generations,
    watchTerms,
  ] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, name: true, username: true,
        tier: true, credits: true, freeAiUsed: true, createdAt: true,
        discordId: true,
      },
    }),
    db.profile.findUnique({ where: { userId } }),
    db.chatSession.findMany({
      where: { userId },
      select: { id: true, title: true, messages: true, createdAt: true, updatedAt: true },
    }),
    db.aiSession.findMany({
      where: { userId },
      select: { id: true, startedAt: true, expiresAt: true, budgetGbp: true, usedCostGbp: true },
    }),
    db.subscription.findMany({
      where: { userId },
      select: { id: true, tier: true, status: true, startedAt: true, cancelledAt: true },
    }),
    db.creditTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { id: true, amount: true, source: true, createdAt: true },
    }),
    db.generation.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, type: true, input: true, output: true, createdAt: true },
    }),
    db.watchTerm.findMany({
      where: { userId },
      select: { id: true, term: true, createdAt: true },
    }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    account: user,
    profile,
    chatSessions,
    aiSessions,
    subscriptions,
    creditTransactions,
    generations,
    watchTerms,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="fortify-data-export-${userId}.json"`,
    },
  });
}
