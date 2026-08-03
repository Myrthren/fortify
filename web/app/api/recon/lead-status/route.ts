import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const VALID_STATUSES = ["new", "contacted", "qualified", "dead"] as const;

// GET — all lead statuses for the current user, keyed by URL
export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const statuses = await db.leadStatus.findMany({
    where: { userId },
    select: { url: true, status: true },
  });

  return NextResponse.json({ statuses });
}

// PATCH — upsert the status for a single lead (keyed by business URL)
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const body = await req.json().catch(() => ({}));
  const url: string = (body.url ?? "").trim();
  const status: string = body.status;

  if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });
  if (!VALID_STATUSES.includes(status as any)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  await db.leadStatus.upsert({
    where: { userId_url: { userId, url } },
    update: { status },
    create: { userId, url, status },
  });

  return NextResponse.json({ ok: true });
}
