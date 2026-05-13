import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { exchangeCode, getLongLivedToken, getAdAccounts } from "@/lib/meta";

/**
 * GET /api/meta/callback?code=xxx&state=xxx
 * Receives the Facebook OAuth redirect, exchanges code for token,
 * fetches the primary ad account, and upserts MetaConnection.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  const userId = (session.user as any).id as string;

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // User denied permission
  if (error) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?meta=denied", req.url)
    );
  }

  // CSRF check: state must equal userId
  if (!state || state !== userId) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?meta=error", req.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?meta=error", req.url)
    );
  }

  try {
    // Exchange code → short-lived token → long-lived token (60 days)
    const shortToken = await exchangeCode(code);
    const token = await getLongLivedToken(shortToken);

    // Get the user's first active ad account
    const accounts = await getAdAccounts(token);
    const primary = accounts.find((a) => a.account_status === 1) ?? accounts[0] ?? null;

    await db.metaConnection.upsert({
      where: { userId },
      create: {
        userId,
        accessToken: token,
        accountId: primary?.id ?? null,
        accountName: primary?.name ?? null,
      },
      update: {
        accessToken: token,
        accountId: primary?.id ?? null,
        accountName: primary?.name ?? null,
        connectedAt: new Date(),
      },
    });

    return NextResponse.redirect(new URL("/dashboard/ads?meta=connected", req.url));
  } catch (e: any) {
    console.error("[meta/callback]", e);
    const msg = encodeURIComponent(e.message ?? "unknown");
    return NextResponse.redirect(
      new URL(`/dashboard/settings?meta=error&msg=${msg}`, req.url)
    );
  }
}
