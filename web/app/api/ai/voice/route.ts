import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TIER_LIMITS } from "@/lib/tiers";
import { trainBrandVoice } from "@/lib/voice";

const MIN_SAMPLE_CHARS = 200;
const MAX_SAMPLE_CHARS = 30000;

// GET — list current user's voices
export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  const voices = await db.brandVoice.findMany({
    where: { userId },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      isActive: true,
      createdAt: true,
      systemPrompt: true,
    },
  });
  return NextResponse.json({ voices });
}

// POST — create + train a new voice
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return new NextResponse("Not found", { status: 404 });

  const limit = TIER_LIMITS[user.tier].brandVoices;
  const existing = await db.brandVoice.count({ where: { userId } });
  if (existing >= limit) {
    return NextResponse.json(
      {
        error:
          limit === 0
            ? "Brand voices require a paid tier. Upgrade to Pro to start."
            : `You've used all ${limit} voice slot${limit === 1 ? "" : "s"} on your tier. Upgrade or delete an existing voice.`,
        upgrade: true,
      },
      { status: 403 }
    );
  }

  const { name, samples } = (await req.json()) as { name?: string; samples?: string };
  if (!name || name.trim().length < 2) {
    return new NextResponse("Name is required (min 2 chars)", { status: 400 });
  }
  if (!samples || samples.length < MIN_SAMPLE_CHARS) {
    return new NextResponse(
      `Need at least ${MIN_SAMPLE_CHARS} characters of writing samples to learn the voice`,
      { status: 400 }
    );
  }
  if (samples.length > MAX_SAMPLE_CHARS) {
    return new NextResponse(`Samples too long (max ${MAX_SAMPLE_CHARS} chars)`, {
      status: 400,
    });
  }

  let systemPrompt: string;
  try {
    const trained = await trainBrandVoice({ name: name.trim(), samples });
    systemPrompt = trained.systemPrompt;
  } catch (e: any) {
    console.error("[voice] training failed", e);
    return new NextResponse(`Training failed: ${e.message}`, { status: 500 });
  }

  // First voice → make it active automatically
  const isFirst = existing === 0;

  const voice = await db.brandVoice.create({
    data: {
      userId,
      name: name.trim(),
      trainingData: samples,
      systemPrompt,
      isActive: isFirst,
    },
    select: { id: true, name: true, isActive: true, systemPrompt: true, createdAt: true },
  });

  return NextResponse.json({ voice });
}
