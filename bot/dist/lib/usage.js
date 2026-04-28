"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrCreateUser = getOrCreateUser;
exports.canGenerate = canGenerate;
exports.checkMonthly = checkMonthly;
exports.logGeneration = logGeneration;
const db_1 = require("./db");
const tiers_1 = require("./tiers");
/** Find or create a User row keyed by Discord ID. */
async function getOrCreateUser(discordId, name) {
    const existing = await db_1.db.user.findUnique({ where: { discordId } });
    if (existing)
        return existing;
    return db_1.db.user.create({ data: { discordId, name: name ?? null } });
}
async function canGenerate(userId, tier) {
    const limit = tiers_1.TIER_LIMITS[tier].dailyGenerations;
    if (limit === Infinity)
        return true;
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const count = await db_1.db.generation.count({
        where: { userId, createdAt: { gte: since } },
    });
    return count < limit;
}
async function checkMonthly(userId, type, limit) {
    if (limit === Infinity)
        return { ok: true, used: 0, limit: Infinity };
    const since = new Date();
    since.setDate(1);
    since.setHours(0, 0, 0, 0);
    const used = await db_1.db.generation.count({
        where: { userId, type, createdAt: { gte: since } },
    });
    return { ok: used < limit, used, limit };
}
async function logGeneration(userId, type, input, output) {
    await db_1.db.generation.create({ data: { userId, type, input, output } });
}
