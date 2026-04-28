import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { NotificationPrefs } from "@prisma/client";

type PrefKey = keyof Omit<NotificationPrefs, "userId">;

const TOGGLEABLE_KEYS: PrefKey[] = [
  "dmPaymentFailed",
  "dmWeeklyReport",
  "dmTrendAlerts",
  "dmCompetitorDone",
  "dmLimitWarning",
  "dmRenewalReminder",
  "dmOnboarding",
  "dmMilestones",
  "dmMatchmaking",
  "dmOwnerNewSub",
  "dmOwnerChurn",
];

export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  const prefs = await db.notificationPrefs.findUnique({ where: { userId } });

  // Return defaults (true) if no row exists yet
  const defaults = Object.fromEntries(TOGGLEABLE_KEYS.map((k) => [k, true]));
  return NextResponse.json(prefs ?? { userId, ...defaults });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  const body = await req.json();

  // Only allow updating known toggleable keys
  const data: Partial<Record<PrefKey, boolean>> = {};
  for (const key of TOGGLEABLE_KEYS) {
    if (typeof body[key] === "boolean") data[key] = body[key];
  }

  const prefs = await db.notificationPrefs.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  return NextResponse.json(prefs);
}
