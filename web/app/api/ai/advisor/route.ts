import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { claude, CLAUDE_MODELS } from "@/lib/claude";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { advisorSystemPrompt, buildAdvisorContext } from "@/lib/advisor";
import { ADVISOR_SECTIONS, advisorMessages, advisorSessionView, initialAdvisorProgress, readAdvisorProgress } from "@/lib/advisor-run";

export const maxDuration = 60;

/** Start a saved run, then generate one bounded section per subsequent request. */
export async function POST(req: Request) {
  // Reserve time for saving and returning before Netlify's 60-second ceiling.
  const deadline = Date.now() + 50_000;
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as { id: string }).id;
  const user = await db.user.findUnique({ where: { id: userId }, select: { tier: true } });
  if (!user) return new NextResponse("Not found", { status: 404 });
  if (user.tier !== "APEX") {
    return NextResponse.json({ error: "AI Advisor is an Apex-exclusive feature." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (body.sessionId === undefined) {
    if (typeof body.challenge !== "string" || body.challenge.trim().length < 10 || body.challenge.length > 4000) {
      return NextResponse.json({ error: "Describe your challenge in 10–4,000 characters." }, { status: 400 });
    }
    // Count whole sessions, not their individual section requests.
    const rl = rateLimit(`advisor:${userId}`, 3, 60 * 60_000);
    if (!rl.ok) return rateLimitResponse(rl.resetMs);
    const challenge = body.challenge.trim();
    const saved = await db.chatSession.create({ data: {
      userId,
      title: `Strategy: ${challenge.slice(0, 60)}${challenge.length > 60 ? "…" : ""}`,
      messages: advisorMessages(challenge, initialAdvisorProgress()),
    } });
    return NextResponse.json({
      session: advisorSessionView(saved),
      // Older open tabs expect these fields. Guide them to reload instead of
      // rendering an undefined title after the API changes beneath them.
      sessionId: saved.id, title: saved.title,
      response: "Your strategy session is saved. Refresh this page, open it in Past Sessions and choose Continue session to finish your brief.",
    });
  }

  if (typeof body.sessionId !== "string" || !Number.isInteger(body.step) || body.step < 0 || body.step >= ADVISOR_SECTIONS.length) {
    return NextResponse.json({ error: "Invalid session or section." }, { status: 400 });
  }
  const saved = await db.chatSession.findFirst({ where: { id: body.sessionId, userId } });
  if (!saved) return NextResponse.json({ error: "Session not found." }, { status: 404 });
  const progress = readAdvisorProgress(saved.messages);
  if (!progress) return NextResponse.json({ error: "Start a new Advisor session." }, { status: 400 });
  const reply = (error?: string, status = 200) => NextResponse.json({ session: advisorSessionView(saved), ...(error ? { error } : {}) }, { status });
  // Repeated requests return saved sections without calling or billing AI again.
  if (body.step < progress.sections.length) return reply();
  if (body.step !== progress.sections.length) return reply("Complete the previous section first.", 409);
  if (progress.leaseId && progress.leaseUntil > Date.now()) return reply("This section is still being written. Your progress is saved; try again shortly.", 409);
  if (progress.attempts >= 4) return reply("This section has failed repeatedly. Your earlier sections are saved; please start a new session later.", 429);

  const challenge = (saved.messages as { content: string }[])[0].content;
  const claimed = { ...progress, attempts: progress.attempts + 1, leaseId: randomUUID(), leaseUntil: Date.now() + 65_000 };
  const claimedMessages = advisorMessages(challenge, claimed);
  // Compare-and-set prevents simultaneous tabs generating the same section.
  // An expired lease recovers a killed function without another scheduled job.
  const claim = await db.chatSession.updateMany({
    where: { id: saved.id, userId, messages: { equals: saved.messages as Prisma.InputJsonArray } },
    data: { messages: claimedMessages },
  });
  if (!claim.count) return reply("This session changed in another request. Reload it and continue.", 409);

  try {
    const context = await buildAdvisorContext(userId);
    const section = ADVISOR_SECTIONS[body.step];
    const remaining = deadline - Date.now();
    if (remaining < 5_000) throw new Error("Advisor context exceeded its time budget");
    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(remaining)]);
    const response = await claude().messages.create({
      model: CLAUDE_MODELS.premium,
      max_tokens: 1600,
      system: advisorSystemPrompt(context),
      messages: [
        { role: "user", content: challenge },
        ...(progress.sections.length ? [{ role: "assistant" as const, content: progress.sections.join("\n\n") }] : []),
        { role: "user", content: `Write only section ${body.step + 1} of ${ADVISOR_SECTIONS.length}: "${section.title}". ${section.instruction} Start with the heading "## ${section.title}". Keep this section under 450 words and finish it fully. Earlier sections are saved separately; do not reproduce them.` },
      ],
    }, { signal, timeout: Math.min(35_000, remaining) });
    const text = response.content.filter((block) => block.type === "text").map((block) => (block as { text: string }).text).join("\n").trim();
    if (!text || response.stop_reason !== "end_turn") throw new Error("Advisor returned an incomplete section");
    const finished = { ...progress, sections: [...progress.sections, text], attempts: 0, leaseId: null, leaseUntil: 0 };
    const messages = advisorMessages(challenge, finished);
    const result = await db.chatSession.updateMany({
      where: { id: saved.id, userId, messages: { equals: claimedMessages } }, data: { messages },
    });
    if (!result.count) return reply("This session changed in another request. Reload it and continue.", 409);
    saved.messages = messages;
    return reply();
  } catch (error) {
    console.error("[advisor] Section failed:", error);
    const retryable = { ...claimed, leaseId: null, leaseUntil: 0 };
    await db.chatSession.updateMany({
      where: { id: saved.id, userId, messages: { equals: claimedMessages } },
      data: { messages: advisorMessages(challenge, retryable) },
    });
    return reply("The Advisor could not finish this section. Your progress is saved; continue the session to retry.", 503);
  }
}
