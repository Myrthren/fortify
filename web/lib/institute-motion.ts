import type { Agent, World } from "./research-institute";

export type WorkPose = "walk" | "read" | "type" | "bench" | "repair" | "discuss" | "wait";

// Planar two-bone reach. Shared by the authored arm and leg chains; clamp the
// reach before acos so changing stations never produces NaN joint rotations.
export function limbAngles(down: number, forward: number, upper: number, lower: number, bend = 1) {
  const raw = Math.hypot(down, forward), distance = Math.max(Math.abs(upper - lower) + .004, Math.min(upper + lower - .004, raw));
  const joint = bend * Math.acos(Math.max(-1, Math.min(1, (distance * distance - upper * upper - lower * lower) / (2 * upper * lower))));
  const root = Math.atan2(-forward, down) - Math.atan2(lower * Math.sin(joint), upper + lower * Math.cos(joint));
  return { root, joint };
}

export function footCycle(distance: number, side: number) {
  const phase = ((distance / 1.05 + side * .5) % 1 + 1) % 1;
  const planted = phase < .62;
  const swing = planted ? 0 : (phase - .62) / .38;
  const forward = planted ? .24 - phase / .62 * .48 : -.24 + (swing * swing * (3 - 2 * swing)) * .48;
  const lift = planted ? 0 : Math.sin(swing * Math.PI) * .10;
  return { forward, lift, planted };
}

export function handReach(kind: WorkPose, side: number, time: number, reduced = false) {
  const motion = reduced ? 0 : Math.sin(time * (kind === "type" ? 9 : 2.1) + side * 1.9);
  if (kind === "read") return { down: .38, forward: .34, wrist: -.5 };
  if (kind === "type") return { down: .25 + motion * .007, forward: .43 + motion * .008, wrist: -1.45 };
  if (kind === "bench") return { down: .30 + motion * .014, forward: .42 + motion * .035, wrist: -.9 };
  if (kind === "repair") return { down: .13 + side * .07 + motion * .012, forward: .43 + motion * .025, wrist: -.4 };
  if (kind === "discuss" && side === 1) return { down: .08 + motion * .035, forward: .30 + motion * .045, wrist: -.7 };
  return null;
}

// Presentation follows the recorded action. Waiting agents never appear to run
// an experiment, and a fault does not manufacture a repair decision for Jun.
export function workPose(agent: Agent, walking: boolean, world: Pick<World, "status" | "round">): { kind: WorkPose; seated: boolean; label: string } {
  if (walking) return { kind: "walk", seated: false, label: "Walking to station" };
  if (world.status !== "active" || /waiting|could not/i.test(agent.activity)) return { kind: "wait", seated: false, label: "Waiting" };
  const seated = (agent.location === "office" && (agent.id === "mira" || agent.id === "ivo")) ||
    (agent.location === "analysis" && (agent.id === "ada" || agent.id === "nia")) ||
    (agent.location === "compute" && (agent.id === "mira" || agent.id === "ivo"));
  if (world.round === 0) return { kind: "read", seated, label: "Reading the brief" };
  if (agent.location === "meeting" || (agent.location === "analysis" && !seated)) return { kind: "discuss", seated: false, label: "Discussing evidence" };
  if (agent.location === "maintenance") return { kind: /service|recalibrat|add a third/i.test(agent.activity) ? "repair" : "read", seated: false, label: /service|recalibrat/i.test(agent.activity) ? "Servicing equipment" : "Checking equipment" };
  if (agent.location === "workbench") return { kind: "bench", seated: false, label: "Working at the bench" };
  return { kind: /notes|findings/i.test(agent.activity) ? "read" : "type", seated, label: "Working at the terminal" };
}
