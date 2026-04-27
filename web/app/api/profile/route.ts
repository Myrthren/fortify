import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const SOCIAL_KEYS = [
  "twitter",
  "linkedin",
  "github",
  "instagram",
  "youtube",
  "tiktok",
  "website",
] as const;

type SocialKey = (typeof SOCIAL_KEYS)[number];

function sanitizeSocials(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!SOCIAL_KEYS.includes(k as SocialKey)) continue;
    if (typeof v !== "string") continue;
    const trimmed = v.trim();
    if (!trimmed) continue;
    if (trimmed.length > 200) continue;
    out[k] = trimmed;
  }
  return out;
}

function sanitizeStringArray(input: unknown, max = 12, maxLen = 40): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter((s) => s.length >= 1 && s.length <= maxLen)
    .slice(0, max);
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  const profile = await db.profile.findUnique({ where: { userId } });
  return NextResponse.json({ profile });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  const body = (await req.json()) as {
    niche?: string | null;
    skills?: string[];
    lookingFor?: string[];
    canOffer?: string[];
    socials?: Record<string, string>;
  };

  const niche =
    typeof body.niche === "string" ? body.niche.trim().slice(0, 80) || null : null;
  const skills = sanitizeStringArray(body.skills);
  const lookingFor = sanitizeStringArray(body.lookingFor);
  const canOffer = sanitizeStringArray(body.canOffer);
  const socials = sanitizeSocials(body.socials);

  const profile = await db.profile.upsert({
    where: { userId },
    create: { userId, niche, skills, lookingFor, canOffer, socials },
    update: { niche, skills, lookingFor, canOffer, socials },
  });

  return NextResponse.json({ profile });
}
