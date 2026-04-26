import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TIER_LIMITS } from "@/lib/tiers";
import { checkMonthly, logGeneration } from "@/lib/usage";
import { auditUrl } from "@/lib/audit";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return new NextResponse("Not found", { status: 404 });

  const limit = TIER_LIMITS[user.tier].monthlyAudits;
  const { ok, used } = await checkMonthly(userId, "audit", limit);
  if (!ok) {
    return NextResponse.json(
      {
        error:
          limit === 0
            ? "Funnel Auditor is a paid feature. Upgrade to Pro."
            : `You've used ${used}/${limit} audits this month. Upgrade for more.`,
        upgrade: true,
      },
      { status: limit === 0 ? 403 : 429 }
    );
  }

  const { url } = (await req.json()) as { url?: string };
  if (!url || url.length < 5) {
    return new NextResponse("URL required", { status: 400 });
  }

  let result;
  try {
    result = await auditUrl(url);
  } catch (e: any) {
    return new NextResponse(e.message, { status: 400 });
  }

  await logGeneration({
    userId,
    type: "audit",
    input: url,
    output: JSON.stringify(result),
  });

  return NextResponse.json({ audit: result });
}
