"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.currentAiUserId = void 0;
exports.withAiUser = withAiUser;
const node_async_hooks_1 = require("node:async_hooks");
const memberContext = new node_async_hooks_1.AsyncLocalStorage();
const currentAiUserId = () => memberContext.getStore();
exports.currentAiUserId = currentAiUserId;
/** Internal only: callers must supply an authenticated or owned record's member ID. */
function withAiUser(userId, action) {
    if (!userId?.trim())
        throw new Error("AI requests require a member account");
    return memberContext.run(userId, action);
}
