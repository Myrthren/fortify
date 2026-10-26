export const SIMULATION_TUTORIAL_VERSION = 1;
export type TutorialStep = "welcome" | "inspect" | "advance" | "intervene" | "respond" | "replay" | "finish";
export type TutorialOutcome = "completed" | "skipped";
export type TutorialContext = { businessId: string | null; businessName: string; seen: boolean };
export function tutorialScope(businessId: string | null) { return businessId ? `business:${businessId}` : "personal"; }
export function simulationStorageKey(userId: string, businessId: string | null) {
  // Preserve the original personal save; business sessions get isolated keys.
  return businessId ? `fortify-institute-v1:${userId}:business:${businessId}` : `fortify-institute-v1:${userId}`;
}
export const TUTORIAL_STEPS: Record<TutorialStep, { title: string; detail: string; action: string; target: string; progress: number }> = {
  welcome: { title: "See how your team responds.", detail: "Inspect a person, move time forward, change a condition and replay the response. This practice run leaves your saved session intact. These worlds model decisions; they do not execute actions in connected software.", action: "Start walkthrough", target: "world", progress: 0 },
  inspect: { title: "Meet a person behind the work.", detail: "Select a person in the room or the people strip. Their objective, current action and memory explain what they are trying to do.", action: "Inspect Mira", target: "people", progress: 1 },
  advance: { title: "Let the team make its first decisions.", detail: "Advance one round. Each agent chooses from its goals and available resources. The event history records what actually resolved.", action: "Advance one round", target: "playback", progress: 2 },
  intervene: { title: "Give the team a problem to solve.", detail: "Introduce an equipment fault. Health will fall to 35%. The team can only respond after time moves forward.", action: "Introduce a fault", target: "playback", progress: 3 },
  respond: { title: "Now watch the response.", detail: "Advance another round. Inspect the changed actions and event history: maintenance takes priority when the shared system fails.", action: "See the response", target: "playback", progress: 4 },
  replay: { title: "Compare the response with the past.", detail: "Move the replay slider back, or use the button here. You are inspecting a recorded state; replay cannot change the present.", action: "Replay the previous round", target: "replay", progress: 5 },
  finish: { title: "You can read the room now.", detail: "Inspect, advance, intervene and replay. Return to your saved session and explore any of the three environments. You can restart this walkthrough whenever you need it.", action: "Return to my session", target: "world", progress: 5 },
};
