import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { verifyStripeKey } from "@/lib/stripe-intel";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const body = await req.json().catch(() => ({}));
  const apiKey = (body.apiKey ?? "").trim();

  if (!apiKey || !apiKey.startsWith("sk_")) {
    return NextResponse.json({ error: "Invalid API key — must start with sk_" }, { status: 400 });
  }

  try {
    await verifyStripeKey(apiKey);
    await db.stripeConnection.upsert({
      where: { userId },
      create: { userId, apiKey },
      update: { apiKey },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: `Invalid key: ${e.message}` }, { status: 400 });
  }
}
