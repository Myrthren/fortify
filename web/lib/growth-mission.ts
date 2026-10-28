export const MISSION_GOALS = [
  { value: "booked-calls", label: "Calls booked", singular: "booked call" },
  { value: "qualified-replies", label: "Replies received", singular: "reply" },
  { value: "won-clients", label: "Clients won", singular: "client won" },
] as const;

export type MissionGoal = typeof MISSION_GOALS[number]["value"];
export type MissionInput = {
  businessId: string;
  goal: MissionGoal;
  target: number;
  deadline: Date;
  offer: string;
  audience: string;
};

const trimmed = (value: unknown, label: string, max: number) => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new Error(`${label} must be between 1 and ${max} characters.`);
  return value.trim();
};

export function parseMissionInput(body: Record<string, unknown>, now = new Date()): MissionInput {
  const businessId = trimmed(body.businessId, "Business", 100);
  if (!MISSION_GOALS.some(item => item.value === body.goal)) throw new Error("Choose a goal Fortify can track in your pipeline.");
  if (!Number.isInteger(body.target) || (body.target as number) < 1 || (body.target as number) > 1000) throw new Error("Choose a target between 1 and 1,000.");
  if (typeof body.deadline !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.deadline)) throw new Error("Choose a valid deadline.");
  const deadline = new Date(`${body.deadline}T23:59:59.999Z`);
  const today = now.toISOString().slice(0, 10);
  const lastAllowed = new Date(Date.parse(`${today}T00:00:00.000Z`) + 365 * 86400000).toISOString().slice(0, 10);
  if (!Number.isFinite(deadline.getTime()) || deadline.toISOString().slice(0, 10) !== body.deadline || body.deadline < today || body.deadline > lastAllowed) throw new Error("Choose a deadline from today up to one year away.");
  return {
    businessId,
    goal: body.goal as MissionGoal,
    target: body.target as number,
    deadline,
    offer: trimmed(body.offer, "Offer", 700),
    audience: trimmed(body.audience, "Audience", 700),
  };
}

export function missionGoalLabel(goal: string) {
  return MISSION_GOALS.find(item => item.value === goal)?.label ?? "Outcomes";
}

export function missionMilestonesForStage(status: string) {
  return { replied: status === "replied", booked: status === "meeting-booked", won: status === "won" };
}

export type MissionOutcome = { status: string; repliedAt?: string | Date | null; bookedAt?: string | Date | null; wonAt?: string | Date | null };
export function missionProgress(goal: string, leads: MissionOutcome[]) {
  return leads.filter(lead => goal === "won-clients" ? !!lead.wonAt || lead.status === "won"
    : goal === "qualified-replies" ? !!lead.repliedAt || lead.status === "replied"
    : !!lead.bookedAt || lead.status === "meeting-booked").length;
}

export function missionNextStep(pending: number, approvedStatuses: string[]) {
  if (pending > 0) return `Review ${pending} prospect${pending === 1 ? "" : "s"} waiting for a decision.`;
  if (!approvedStatuses.length) return "Add prospects from your pipeline to start the review.";
  const ready = approvedStatuses.filter(status => ["new", "qualified", "draft-ready"].includes(status)).length;
  if (ready) return `Prepare and send outreach to ${ready} approved prospect${ready === 1 ? "" : "s"}.`;
  const contacted = approvedStatuses.filter(status => status === "contacted").length;
  if (contacted) return `Check the ${contacted} contacted prospect${contacted === 1 ? "" : "s"} and record replies or follow-ups.`;
  return "Review your results and add the next focused group of prospects.";
}
