type StarterNode = { id: string; type: string; label: string; x: number; y: number; config: Record<string, string> };
type StarterConnection = { id: string; fromId: string; fromPort: "out"; toId: string };
type Starter = { id: string; name: string; description: string; nodes: StarterNode[]; connections: StarterConnection[] };

// Starters are drafts. They do not send messages or perform external actions.
export const WORKFLOW_STARTERS: Starter[] = [
  {
    id: "weekly-ideas",
    name: "Weekly idea planner",
    description: "Generate a fresh set of content ideas every Monday. Add a delivery action when ready.",
    nodes: [
      { id: "trigger", type: "trigger_schedule", label: "Every Monday", x: 460, y: 160, config: { cron: "0 9 * * 1", timezone: "UTC" } },
      { id: "ideas", type: "ai_generate", label: "Draft ideas", x: 460, y: 340, config: { prompt: "Suggest five specific content ideas for my business this week. Include a short hook and the audience problem for each.", outputVar: "weekly_ideas", model: "haiku", maxTokens: "500" } },
    ],
    connections: [{ id: "first", fromId: "trigger", fromPort: "out", toId: "ideas" }],
  },
  {
    id: "daily-content-brief",
    name: "Daily content brief",
    description: "Turn a daily idea into a short brief. Review the result in run history before adding a delivery action.",
    nodes: [
      { id: "trigger", type: "trigger_schedule", label: "Every morning", x: 460, y: 160, config: { cron: "0 8 * * *", timezone: "UTC" } },
      { id: "idea", type: "ai_generate", label: "Generate an idea", x: 460, y: 340, config: { prompt: "Suggest one useful content idea for my audience today. Include the audience problem and a concrete angle.", outputVar: "daily_idea", model: "haiku", maxTokens: "350" } },
      { id: "brief", type: "ai_summarise", label: "Make a brief", x: 460, y: 520, config: { input: "{{daily_idea}}", maxLength: "100 words", outputVar: "content_brief" } },
    ],
    connections: [
      { id: "first", fromId: "trigger", fromPort: "out", toId: "idea" },
      { id: "second", fromId: "idea", fromPort: "out", toId: "brief" },
    ],
  },
];

export function getWorkflowStarter(id: string): Starter | undefined {
  return WORKFLOW_STARTERS.find((starter) => starter.id === id);
}

export function validCron(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const bounds = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 6]];
  return parts.every((part, index) => part.split(",").every((segment) => {
    const match = /^(\*|\d+|\d+-\d+)(?:\/(\d+))?$/.exec(segment);
    if (!match || (match[2] !== undefined && Number(match[2]) < 1)) return false;
    if (match[1] === "*") return true;
    const values = match[1].split("-").map(Number);
    const [min, max] = bounds[index];
    return values.every((value) => value >= min && value <= max) && values[0] <= (values[1] ?? values[0]);
  }));
}

export function cronTimeAt(now: Date, timezone: string): { minute: number; hour: number; day: number; month: number; weekday: number } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      minute: "numeric", hour: "numeric", day: "numeric", month: "numeric", weekday: "short", hourCycle: "h23",
    }).formatToParts(now);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
    if (weekday < 0) return null;
    return { minute: Number(get("minute")), hour: Number(get("hour")), day: Number(get("day")), month: Number(get("month")), weekday };
  } catch {
    return null;
  }
}

export function activationIssue(raw: unknown): string | null {
  const filled = (value: unknown) => typeof value === "string" && value.trim().length > 0;
  const graph = raw as { nodes?: StarterNode[]; connections?: StarterConnection[] } | StarterNode[] | null;
  const nodes = Array.isArray(graph) ? graph : graph?.nodes;
  const connections = Array.isArray(graph) ? [] : graph?.connections ?? [];
  if (!Array.isArray(nodes) || nodes.length === 0) return "Add and save at least one workflow node before activating.";
  if (!nodes.every((node) => node && typeof node.id === "string" && typeof node.type === "string" && node.config && typeof node.config === "object")) return "Workflow nodes are invalid. Save the workflow again.";
  if (!Array.isArray(connections)) return "Workflow connections are invalid. Save the workflow again.";
  const ids = new Set(nodes.map((node) => node.id));
  if (ids.size !== nodes.length) return "Workflow nodes must have unique IDs. Save the workflow again.";
  if (!connections.every((connection) => connection && ids.has(connection.fromId) && ids.has(connection.toId))) return "A workflow connection points to a missing node.";
  const trigger = nodes.find((node) => node.type?.startsWith("trigger_"));
  if (!trigger) return "Add a trigger before activating this workflow.";
  if (nodes.length > 1 && nodes.some((node) => node.type.startsWith("trigger_") && !connections.some((connection) => connection.fromId === node.id))) return "Connect the trigger to the next step before activating.";
  for (const node of nodes) {
    if (!node.type.startsWith("trigger_") && !connections.some((connection) => connection.toId === node.id)) return `Connect ${node.label || "the step"} to the workflow.`;
    if (node.type === "trigger_schedule" && (typeof node.config?.cron !== "string" || !validCron(node.config.cron))) return "Set a valid five-part schedule before activating.";
    if (node.type === "trigger_schedule" && node.config?.timezone && !cronTimeAt(new Date(), node.config.timezone)) return "Set a valid timezone, such as Europe/London, before activating.";
    if (node.type === "trigger_webhook" && (typeof node.config?.secret !== "string" || !node.config.secret.trim())) return "Add a secret token to the webhook trigger before activating.";
    if (node.type === "ai_generate" && (typeof node.config?.prompt !== "string" || !node.config.prompt.trim())) return `Add a prompt to ${node.label || "AI Generate"}.`;
    if (node.type === "action_discord" && (!filled(node.config?.channel) || !filled(node.config?.message))) return `Set a channel and message for ${node.label || "Discord Post"}.`;
    if (node.type === "action_email" && (!filled(node.config?.to) || !filled(node.config?.subject) || !filled(node.config?.body))) return `Set a recipient, subject and body for ${node.label || "Send Email"}.`;
  }
  const outgoing = new Map<string, string[]>();
  for (const connection of connections) outgoing.set(connection.fromId, [...(outgoing.get(connection.fromId) ?? []), connection.toId]);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function hasCycle(id: string): boolean {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const next of outgoing.get(id) ?? []) if (hasCycle(next)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  }
  if (nodes.some((node) => hasCycle(node.id))) return "Remove the loop in the workflow connections before activating.";
  return null;
}
