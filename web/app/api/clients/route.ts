import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

async function owner() {
  const session = await auth();
  if (!session?.user) return null;
  return db.user.findUnique({ where: { id: (session.user as any).id }, select: { id: true, tier: true } });
}
export async function GET() {
  const user = await owner(); if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const clients = await db.clientWorkspace.findMany({ where: { userId: user.id }, orderBy: { name: "asc" },
    include: { brandVoice: { select: { name: true } }, _count: { select: { workflows: true, watches: true } } } });
  const voices = await db.brandVoice.findMany({ where: { userId: user.id }, select: { id: true, name: true } });
  return NextResponse.json({ clients, voices });
}
export async function POST(req: Request) {
  const user = await owner(); if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (user.tier === "FREE") return NextResponse.json({ error: "Client contexts require Pro or above" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== "string" || body.name.trim().length < 2 || body.name.length > 100 ||
      typeof body.context !== "string" || !body.context.trim() || body.context.length > (user.tier === "PRO" ? 30000 : 100000)) return NextResponse.json({ error: "Provide a client name and business context within your plan's memory limit" }, { status: 400 });
  const voiceId = body.brandVoiceId || null;
  if (voiceId && (typeof voiceId !== "string" || !await db.brandVoice.findFirst({ where: { id: voiceId, userId: user.id } }))) return NextResponse.json({ error: "Choose one of your own saved voices" }, { status: 400 });
  const entries = [{ label: "Client business", content: body.context.trim() }];
  if (body.id) {
    if (typeof body.id !== "string" || !await db.clientWorkspace.findFirst({ where: { id: body.id, userId: user.id } })) return new NextResponse("Not found", { status: 404 });
    const client = await db.clientWorkspace.update({ where: { id: body.id }, data: { name: body.name.trim(), entries, brandVoiceId: voiceId } });
    return NextResponse.json({ client });
  }
  if (await db.clientWorkspace.count({ where: { userId: user.id } }) >= (user.tier === "PRO" ? 3 : user.tier === "ELITE" ? 20 : 100)) return NextResponse.json({ error: "Client context limit reached" }, { status: 403 });
  return NextResponse.json({ client: await db.clientWorkspace.create({ data: { userId: user.id, name: body.name.trim(), entries, brandVoiceId: voiceId } }) });
}
export async function DELETE(req: Request) {
  const user = await owner(); if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const body = await req.json().catch(() => null);
  if (typeof body?.id !== "string") return new NextResponse("Client ID required", { status: 400 });
  const client = await db.clientWorkspace.findFirst({ where: { id: body.id, userId: user.id }, include: { _count: { select: { workflows: true, watches: true } } } });
  if (!client) return new NextResponse("Not found", { status: 404 });
  if (client._count.workflows || client._count.watches) return NextResponse.json({ error: "Remove linked watches/workflows before deleting their client context" }, { status: 409 });
  await db.clientWorkspace.delete({ where: { id: client.id } }); return NextResponse.json({ ok: true });
}
