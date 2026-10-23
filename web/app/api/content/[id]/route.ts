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
  contentVersion,
  contentJson,
} from "@/lib/content-storage";
type Context = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";
export async function GET(req: Request, context: Context) {
  try {
    const user = await contentActor(req, false);
    if (user instanceof Response) return user;
    const { id } = await context.params;
    const record = await db.contentRecord.findFirst({
      where: { id, userId: user.id },
    });
    if (!record || !isContentKind(record.kind))
      throw new ContentError("This record was not found.", 404);
    requireContentAccess(record.kind, user.tier);
    return contentJson(record);
  } catch (e) {
    return contentError(e);
  }
}
export async function PATCH(req: Request, context: Context) {
  try {
    const user = await contentActor(req);
    if (user instanceof Response) return user;
    const { id } = await context.params;
    const existing = await db.contentRecord.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing || !isContentKind(existing.kind))
      throw new ContentError("This record was not found.", 404);
    const kind = existing.kind;
    requireContentAccess(kind, user.tier);
    const body = await contentBody(req),
      version = contentVersion(body.version);
    if (existing.version !== version)
      throw new ContentError(
        "This record changed elsewhere. Reload the saved version; your edits remain on screen.",
        409,
      );
    const title = validated(() => contentTitle(body.title)),
      document = validated(() => parseContent(kind, body.document));
    await validateContentLinks(user.id, kind, document);
    const record = await db.$transaction(async (tx) => {
      const saved = await tx.contentRecord.updateMany({
        where: { id, userId: user.id, version },
        data: {
          title,
          document,
          history: contentHistory(
            existing.history,
            version + 1,
            kind,
            document,
          ),
          version: { increment: 1 },
        },
      });
      if (!saved.count)
        throw new ContentError(
          "This record changed elsewhere. Your edits are still on screen. Reload the saved version before trying again.",
          409,
        );
      return tx.contentRecord.findFirst({ where: { id, userId: user.id } });
    });
    return contentJson(record);
  } catch (e) {
    return contentError(e);
  }
}
