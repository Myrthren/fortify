import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { exchangeNotionCode } from "@/lib/notion";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", req.url));
  const userId = (session.user as any).id as string;

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/dashboard/settings?notion=error", req.url));
  }

  try {
    const { accessToken, botId, workspaceName, workspaceIcon } = await exchangeNotionCode(code);

    await db.notionConnection.upsert({
      where: { userId },
      create: { userId, accessToken, botId, workspaceName, workspaceIcon },
      update: { accessToken, botId, workspaceName, workspaceIcon },
    });
  } catch (e) {
    console.error("[notion/callback]", e);
    return NextResponse.redirect(new URL("/dashboard/settings?notion=error", req.url));
  }

  return NextResponse.redirect(new URL("/dashboard/settings?notion=connected", req.url));
}
