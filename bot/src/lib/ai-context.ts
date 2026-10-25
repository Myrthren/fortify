import { AsyncLocalStorage } from "node:async_hooks";

const memberContext = new AsyncLocalStorage<string>();
export const currentAiUserId = () => memberContext.getStore();
/** Internal only: callers must supply an authenticated or owned record's member ID. */
export function withAiUser<T>(userId: string, action: () => T): T {
  if (!userId?.trim()) throw new Error("AI requests require a member account");
  return memberContext.run(userId, action);
}
