export const WORKSPACE_LAYOUTS = ["classic", "command-centre"] as const;

export type WorkspaceLayout = (typeof WORKSPACE_LAYOUTS)[number];

// Keep the established workspace as the safe default until an owner chooses
// the new command-centre experience for everyone.
export const DEFAULT_WORKSPACE_LAYOUT: WorkspaceLayout = "classic";

export function isWorkspaceLayout(value: unknown): value is WorkspaceLayout {
  return typeof value === "string" && (WORKSPACE_LAYOUTS as readonly string[]).includes(value);
}
