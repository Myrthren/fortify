export const WORKSPACE_GOALS = [
  { value: "clients", label: "Find clients", description: "Save a prospect, keep the research and prepare your first message." },
  { value: "content", label: "Create content", description: "Turn a topic into useful writing, then build on the result." },
  { value: "research", label: "Watch my market", description: "Research a topic or competitor and decide what to do next." },
] as const;
export type WorkspaceGoal = typeof WORKSPACE_GOALS[number]["value"];
export const isWorkspaceGoal = (value: unknown): value is WorkspaceGoal => WORKSPACE_GOALS.some(goal => goal.value === value);
export type GoalSignals = { leads: number; drafts: number; content: number; research: number; watches: number };
export type GoalStep = { title: string; description: string; href: string; done: boolean };
export function goalSteps(goal: WorkspaceGoal, signals: GoalSignals, tier: string): GoalStep[] {
  const chosen = { title: "Choose your focus", description: WORKSPACE_GOALS.find(item => item.value === goal)!.label, href: "#workspace-goal", done: true };
  if (goal === "clients") return [chosen,
    { title: "Save your first prospect", description: "Add a contact or save a result from a lead tool.", href: "/dashboard/pipeline", done: signals.leads > 0 },
    { title: "Prepare a first message", description: "Open a saved lead and draft outreach with its research.", href: "/dashboard/pipeline", done: signals.drafts > 0 }];
  if (goal === "content") return [chosen,
    { title: "Create your first piece", description: "Write an idea, develop the story beats and save your draft.", href: "/dashboard/content?view=story", done: signals.content > 0 },
    { title: "Build on your first result", description: "Compare another opening and keep a second story in your saved work.", href: "/dashboard/content?view=story", done: signals.content > 1 }];
  const elite = ["ELITE", "APEX"].includes(tier);
  return [chosen,
    { title: "Explore your first topic", description: tier === "FREE" ? "Use Trend Radar to explore your market." : "Run a competitor scan or explore Trend Radar.", href: tier === "FREE" ? "/dashboard/trends" : "/dashboard/competitors", done: signals.research > 0 },
    elite
      ? { title: "Keep watch on a competitor", description: "Add a page to Competitor Watch for future change alerts.", href: "/dashboard/competitor-tracking", done: signals.watches > 0 }
      : { title: "Explore a second angle", description: "Research another topic and compare what you learn.", href: "/dashboard/trends", done: signals.research > 1 }];
}
