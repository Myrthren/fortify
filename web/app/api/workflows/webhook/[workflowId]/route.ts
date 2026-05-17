/**
 * POST /api/workflows/webhook/[workflowId]
 * -------------------------------------------
 * External webhook trigger endpoint.
 * Fires the workflow if it is active and has a trigger_webhook node.
 * Optionally validates an X-Webhook-Secret header.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runWorkflow } from "@/lib/workflow-runner";

export async function POST(
  req: Request,
  { params }: { params: { workflowId: string } },
) {
  const workflow = await db.workflow.findUnique({
    where: { id: params.workflowId },
    select: { id: true, userId: true, active: true, nodes: true },
  });

  if (!workflow || !workflow.active) {
    return new NextResponse("Not found or inactive", { status: 404 });
  }

  // Parse nodes to find trigger_webhook config
  const raw = workflow.nodes as any;
  let nodes: any[] = [];
  if (raw && typeof raw === "object" && Array.isArray(raw.nodes)) {
    nodes = raw.nodes;
  } else if (Array.isArray(raw)) {
    nodes = raw;
  }

  const triggerNode = nodes.find((n: any) => n.type === "trigger_webhook");
  if (!triggerNode) {
    return new NextResponse("No webhook trigger configured", { status: 400 });
  }

  // Validate secret if configured
  const expectedSecret = triggerNode.config?.secret as string | undefined;
  if (expectedSecret) {
    const providedSecret = req.headers.get("x-webhook-secret") ?? req.headers.get("x-fortify-secret");
    if (providedSecret !== expectedSecret) {
      return new NextResponse("Invalid secret", { status: 401 });
    }
  }

  // Parse body
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch { /* ignore */ }

  const result = await runWorkflow(workflow.id, workflow.userId, { webhookBody: body });

  if (result.status === "error") {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, runId: result.runId });
}

// GET returns a simple info page about this webhook
export async function GET(
  _req: Request,
  { params }: { params: { workflowId: string } },
) {
  const workflow = await db.workflow.findUnique({
    where: { id: params.workflowId },
    select: { active: true },
  });

  return NextResponse.json({
    endpoint: `/api/workflows/webhook/${params.workflowId}`,
    method: "POST",
    active: workflow?.active ?? false,
    description: "POST JSON to this endpoint to trigger the workflow.",
    headers: { "Content-Type": "application/json", "X-Webhook-Secret": "(if configured)" },
  });
}
