import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { exchangeCode, getWhopUserId, syncWhopTier } from "@/lib/whop";

export async function GET(req: Request) {
  const base = process.env.AUTH_URL ?? "https://fortify-io.com";
  const done = (q: string) => NextResponse.redirect(`${base}/dashboard/settings?${q}`);

  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", base));
  const userId = (session.user as any).id as string;

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) return done(`error=${encodeURIComponent(error)}`);
  if (!code || state !== userId) return done("error=invalid_state");

  const verifier = (await cookies()).get("whop_pkce")?.value;
  if (!verifier) return done("error=pkce_expired");

  try {
    const accessToken = await exchangeCode(code, verifier);
    const whopUserId = await getWhopUserId(accessToken);

    // Reject if this Whop account is already linked to a different Fortify user.
    const clash = await db.user.findUnique({ where: { whopUserId } });
    if (clash && clash.id !== userId) return done("error=whop_already_linked");

    await db.user.update({ where: { id: userId }, data: { whopUserId } });

    const { membershipId } = await syncWhopTier(userId, whopUserId);
    if (!membershipId) {
      // Account linked, but no active Fortify membership on Whop.
      return done("whop=linked_no_membership");
    }

    const res = done("whop=connected");
    res.cookies.delete("whop_pkce");
    return res;
  } catch (e: any) {
    console.error("[whop/callback]", e);
    return done(`error=${encodeURIComponent(e.message ?? "Whop OAuth failed")}`);
  }
}
