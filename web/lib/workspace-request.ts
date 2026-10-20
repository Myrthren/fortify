import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function workspaceUserId() {
  const session = await auth();
  const id = (session?.user as { id?: unknown } | undefined)?.id;
  return typeof id === "string" && id.length ? id : null;
}
export function mutationOrigin(req: Request) {
  return req.headers.get("origin") === new URL(req.url).origin;
}
export const workspaceError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
export async function workspaceBody(req: Request): Promise<Record<string, unknown>> {
  const raw = await req.text();
  if (raw.length > 30000) throw new Error("This request is too large.");
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid request.");
  return value;
}
