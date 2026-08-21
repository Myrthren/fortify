"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIER_TO_ROLE_ID = exports.TIER_NAMES = exports.TIER_LIMITS = void 0;
// Same source of truth as web/lib/tiers.ts
exports.TIER_LIMITS = {
    FREE: { dailyGenerations: 10, brandVoices: 0, monthlyAudits: 0, monthlyOutreach: 0, watchTerms: 0, competitors: 0 },
    PRO: { dailyGenerations: Infinity, brandVoices: 1, monthlyAudits: 5, monthlyOutreach: 50, watchTerms: 0, competitors: 3 },
    ELITE: { dailyGenerations: Infinity, brandVoices: 3, monthlyAudits: Infinity, monthlyOutreach: Infinity, watchTerms: 10, competitors: 10 },
    APEX: { dailyGenerations: Infinity, brandVoices: Infinity, monthlyAudits: Infinity, monthlyOutreach: Infinity, watchTerms: Infinity, competitors: Infinity },
};
exports.TIER_NAMES = {
    FREE: "Free",
    PRO: "Pro",
    ELITE: "Elite",
    APEX: "Apex",
};
// Mirrors web/lib/tiers.ts — the bot assigns these on join when a member
// already has an active plan.
exports.TIER_TO_ROLE_ID = {
    FREE: undefined,
    PRO: "1497408012816744568",
    ELITE: "1497408076486148247",
    APEX: "1497408133444931664",
};
