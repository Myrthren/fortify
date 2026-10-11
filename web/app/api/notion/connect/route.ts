import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildNotionAuthUrl } from "@/lib/notion";
import { createOAuthState } from "@/lib/oauth-state";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const state = createOAuthState((session.user as any).id as string, "notion");
  const url = buildNotionAuthUrl(state);
  return NextResponse.redirect(url);
}
