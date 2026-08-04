import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildAuthUrl, createPkce } from "@/lib/whop";

export async function GET() {
  const session = await auth();
  const base = process.env.AUTH_URL ?? "https://fortify-io.com";
  if (!session?.user) return NextResponse.redirect(new URL("/login", base));
  const userId = (session.user as any).id as string;

  const { verifier, challenge } = createPkce();
  const res = NextResponse.redirect(buildAuthUrl(userId, challenge));

  // PKCE verifier must survive the round-trip to Whop and back.
  res.cookies.set("whop_pkce", verifier, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 min
  });
  return res;
}
