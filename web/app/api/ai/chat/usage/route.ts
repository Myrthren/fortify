import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getOrCreateSession } from "@/lib/ai-usage";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ tier: "FREE", canUse: false });

  const { session: aiSession, remainingGbp, packRemainingGbp, overLimit, freeTrialExhausted } =
    await getOrCreateSession(userId, user.tier);

  if (!aiSession) {
    return NextResponse.json({
      tier: user.tier,
      canUse: false,
      freeTrialExhausted: freeTrialExhausted ?? false,
    });
  }

  const budgetGbp = aiSession.budgetGbp;
  const usedGbp = aiSession.usedCostGbp;
  const pct = budgetGbp >= 999999 ? 0 : Math.min(100, Math.round((usedGbp / budgetGbp) * 100));
  const isApex = user.tier === "APEX";
  const isFree = user.tier === "FREE";
  const sessionExhausted = !isApex && remainingGbp <= 0;

  return NextResponse.json({
    tier: user.tier,
    canUse: !overLimit,
    isApex,
    isFree,
    pct,
    sessionExhausted,
    freeTrialExhausted: freeTrialExhausted ?? false,
    expiresAt: aiSession.expiresAt.toISOString(),
    packRemainingGbp: Math.round(packRemainingGbp * 100) / 100,
    hasPackCredits: packRemainingGbp > 0,
    remainingGbp: Math.round(remainingGbp * 100) / 100,
  });
}
