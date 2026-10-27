"use client";
import { useEffect } from "react";
import type { WorkspaceMember } from "@/lib/workspace-member";
export function WorkspaceMemberUpdate({ user }: { user: WorkspaceMember }) {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("fortify:member-updated", { detail: user }));
  }, [user.email, user.username, user.tier, user.discordId, user.credits]);
  return null;
}
