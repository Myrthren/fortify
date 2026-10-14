/** Only replay read/generation actions. Delivery mutations require a fresh reviewed run. */
export function retrySafe(nodeType: string, config: Record<string, string>): boolean {
  return nodeType.startsWith("ai_") || nodeType === "action_lead_search" || nodeType === "action_research_page" ||
    nodeType === "action_email" || (nodeType === "action_http_request" && ["GET", "HEAD"].includes((config.method || "GET").toUpperCase()));
}
export function retryCount(raw: string | undefined): number {
  const count = Number(raw); return Number.isInteger(count) ? Math.max(0, Math.min(count, 3)) : 0;
}
