import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildAuthUrl } from "@/lib/google";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", process.env.AUTH_URL ?? "https://fortify-io.com"));
  const userId = (session.user as any).id as string;
  return NextResponse.redirect(buildAuthUrl(userId));
}
