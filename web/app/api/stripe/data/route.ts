import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getStripeData } from "@/lib/stripe-intel";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const conn = await db.stripeConnection.findUnique({ where: { userId } });
  if (!conn) return NextResponse.json({ error: "Not connected", notConnected: true }, { status: 404 });

  try {
    const data = await getStripeData(conn.apiKey);
    return NextResponse.json(data);
  } catch (e: any) {
    console.error("[stripe/data]", e);
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
