import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildNotionAuthUrl } from "@/lib/notion";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const state = Math.random().toString(36).slice(2);
  const url = buildNotionAuthUrl(state);
  return NextResponse.redirect(url);
}
