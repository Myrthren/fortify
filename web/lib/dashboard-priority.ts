import { goalSteps } from "./workspace-goals";
import type { WorkspaceSnapshot } from "./workspace-activity";

export function dashboardPriority(snapshot: WorkspaceSnapshot, tier: string) {
  const attention = snapshot.attention[0];
  if (attention) return { label: "Needs attention", title: attention.title, description: attention.detail, href: attention.href, action: attention.action, warning: !!attention.warning };
  const saved = snapshot.activity.find(item => item.action === "Continue work");
  if (saved) return { label: "Continue your work", title: saved.title, description: `Your saved ${saved.detail.toLowerCase()} is ready to pick up.`, href: saved.href, action: "Continue work", warning: false };
  const step = snapshot.goal && goalSteps(snapshot.goal, snapshot.signals, tier).find(item => !item.done);
  if (step) return { label: "Your next step", title: step.title, description: step.description, href: step.href, action: "Get started", warning: false };
  if (snapshot.activity[0]) { const recent = snapshot.activity[0]; return { label: "Return to your workspace", title: recent.title, description: recent.detail, href: recent.href, action: recent.action, warning: false }; }
  return { label: "Start something useful", title: "Turn your next idea into a first draft.", description: "Start with a video or post. Keep the idea, evidence and edits together as it takes shape.", href: "/dashboard/content?view=story", action: "Start a draft", warning: false };
}
