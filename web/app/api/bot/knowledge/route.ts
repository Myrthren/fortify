import { NextResponse } from "next/server";
import { FORTIFY_KNOWLEDGE, KNOWLEDGE_VERSION } from "@/lib/fortify-knowledge";

/**
 * GET /api/bot/knowledge
 * Public, read-only canonical Fortify feature knowledge for the Discord bot.
 * The bot fetches this (cached) so its knowledge stays current with every
 * web deploy, without needing a bot redeploy.
 */
export const dynamic = "force-static";
export const revalidate = 300; // re-generate at most every 5 minutes

export async function GET() {
  return NextResponse.json({
    version: KNOWLEDGE_VERSION,
    knowledge: FORTIFY_KNOWLEDGE,
  });
}
