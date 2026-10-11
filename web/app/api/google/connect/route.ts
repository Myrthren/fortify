import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", process.env.AUTH_URL ?? "https://fortify-io.com"));
  return NextResponse.json({ error: "Google integrations are not released yet." }, { status: 503 });
}
