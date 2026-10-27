import { workspaceMember, type WorkspaceMember } from "@/lib/workspace-member";
import { WorkspaceMemberUpdate } from "./workspace-member-update";
// Keep permissions fresh while sending only navigation fields to the client.
export function WorkspaceMemberSync({ user }: { user: WorkspaceMember; active?: string }) {
  return <WorkspaceMemberUpdate user={workspaceMember(user)} />;
}
