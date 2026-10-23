import { db } from "@/lib/db";
import {
  decisionPlan,
  parseContent,
  type DecisionDocument,
} from "@/lib/content-workspace";
import { planCounts, parsePlanDocument } from "@/lib/future-plans";
import {
  contentActor,
  contentBody,
  contentError,
  ContentError,
  requireContentAccess,
  validated,
  contentVersion,
} from "@/lib/content-storage";
import { NextResponse } from "next/server";
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await contentActor(req);
    if (user instanceof Response) return user;
    requireContentAccess("decision", user.tier);
    const { id } = await context.params;
    const body = await contentBody(req),
      version = contentVersion(body.version);
    const result = await db.$transaction(async (tx) => {
      const record = await tx.contentRecord.findFirst({
        where: { id, userId: user.id, kind: "decision" },
      });
      if (!record) throw new ContentError("This decision was not found.", 404);
      if (record.planId) {
        const plan = await tx.futurePlan.findFirst({
          where: { id: record.planId, userId: user.id },
          select: { id: true },
        });
        if (!plan)
          throw new ContentError("The linked plan is unavailable.", 409);
        return { record, plan };
      }
      const decision = validated(() =>
        parseContent("decision", record.document),
      ) as DecisionDocument;
      const document = validated(() => {
        const plan = decisionPlan(record.title, decision);
        plan.nodes[0].url = new URL(
          "/dashboard/decisions?id=" + encodeURIComponent(record.id),
          req.url,
        ).href;
        return parsePlanDocument(plan);
      });
      const locked = await tx.contentRecord.updateMany({
        where: { id, userId: user.id, version, planId: null },
        data: { version: { increment: 1 } },
      });
      if (!locked.count)
        throw new ContentError(
          "The decision changed. Reload it before creating a plan.",
          409,
        );
      const plan = await tx.futurePlan.create({
        data: {
          userId: user.id,
          title: record.title,
          description: `From Decision Room: ${record.id}`,
          document,
          ...planCounts(document),
        },
        select: { id: true },
      });
      await tx.contentRecord.update({
        where: { id },
        data: {
          planId: plan.id,
          history: [
            ...(Array.isArray(record.history) ? record.history : []).slice(-19),
            {
              version: version + 1,
              at: new Date().toISOString(),
              detail:
                "Plan created: " +
                decision.options.find((o) => o.id === decision.selected)!.title,
            },
          ],
        },
      });
      const saved = await tx.contentRecord.findFirst({
        where: { id, userId: user.id },
      });
      return { record: saved, plan };
    });
    return NextResponse.json(result);
  } catch (e) {
    return contentError(e);
  }
}
