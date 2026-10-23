import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  isContentKind,
  contentTitle,
  parseContent,
} from "@/lib/content-workspace";
import {
  contentActor,
  contentBody,
  contentError,
  ContentError,
  requireContentAccess,
  validated,
  validateContentLinks,
  contentHistory,
  contentJson,
} from "@/lib/content-storage";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const user = await contentActor(req, false);
    if (user instanceof Response) return user;
    const kind = new URL(req.url).searchParams.get("kind");
    if (!isContentKind(kind)) throw new ContentError("Choose a workspace.");
    requireContentAccess(kind, user.tier);
    const records = await db.contentRecord.findMany({
      where: { userId: user.id, kind },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        kind: true,
        title: true,
        version: true,
        planId: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({ records });
  } catch (e) {
    return contentError(e);
  }
}
export async function POST(req: Request) {
  try {
    const user = await contentActor(req);
    if (user instanceof Response) return user;
    const body = await contentBody(req);
    if (!isContentKind(body.kind))
      throw new ContentError("Choose a workspace.");
    const kind = body.kind;
    requireContentAccess(kind, user.tier);
    const title = validated(() => contentTitle(body.title));
    const document = validated(() => parseContent(kind, body.document));
    await validateContentLinks(user.id, kind, document);
    const record = await db.contentRecord.create({
      data: {
        userId: user.id,
        kind,
        title,
        document,
        history: contentHistory([], 1, kind, document),
      },
    });
    return contentJson(record, 201);
  } catch (e) {
    return contentError(e);
  }
}
