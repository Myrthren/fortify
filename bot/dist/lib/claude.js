"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLAUDE_MODELS = void 0;
exports.claude = claude;
const ai_context_1 = require("./ai-context");
const ai_router_1 = require("./ai-router");
exports.CLAUDE_MODELS = ai_router_1.AI_MODELS;
/** Every call is bound to the authenticated member or an owned background job. */
function claude(memberId) {
    return { messages: { create: async (params, options) => {
                const userId = memberId || (0, ai_context_1.currentAiUserId)();
                if (!userId)
                    throw new Error("AI requests require a member account");
                return (0, ai_router_1.routedAiMessage)(userId, params, options);
            } } };
}
