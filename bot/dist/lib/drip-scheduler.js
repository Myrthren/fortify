"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startDripScheduler = startDripScheduler;
const drip_1 = require("./drip");
/**
 * In-process scheduler. The bot is a single long-running Railway container, so
 * the sweeps live here rather than in a web cron — one process is also what
 * keeps a sweep from racing another copy of itself.
 *
 * The two sweeps run at :11 and :27 rather than both on the hour. Overlapping
 * sweeps would stack their send rates on top of each other, and the whole point
 * of the pacing is that total volume stays predictable.
 *
 * Every schedule below is UTC. Servers run UTC and a schedule written in local
 * time drifts an hour at each daylight-saving boundary unless the zone is
 * stated explicitly.
 */
const WELCOME_MINUTE = 11;
const ACTIVATION_MINUTE = 27;
const REPORT_DAY = 1; // Monday
const REPORT_HOUR = 9;
const REPORT_MINUTE = 5;
/** Last minute each job ran, so a tick landing twice in one minute is a no-op. */
const lastRun = new Map();
function once(job, stamp) {
    if (lastRun.get(job) === stamp)
        return false;
    lastRun.set(job, stamp);
    return true;
}
async function tick(client) {
    const now = new Date();
    const stamp = now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
    const minute = now.getUTCMinutes();
    try {
        if (minute === WELCOME_MINUTE && once("welcome", stamp)) {
            await (0, drip_1.sweep)(client, "WELCOME");
        }
        if (minute === ACTIVATION_MINUTE && once("activation", stamp)) {
            await (0, drip_1.sweep)(client, "ACTIVATION");
        }
        if (now.getUTCDay() === REPORT_DAY &&
            now.getUTCHours() === REPORT_HOUR &&
            minute === REPORT_MINUTE &&
            once("report", stamp)) {
            await (0, drip_1.weeklyReport)(client);
        }
    }
    catch (e) {
        console.error("[drip] scheduler tick failed:", e);
    }
}
function startDripScheduler(client) {
    setInterval(() => void tick(client), 30 * 1000);
    console.log(`[drip] scheduler started — WELCOME :${WELCOME_MINUTE}, ACTIVATION :${ACTIVATION_MINUTE}, report Mon ${REPORT_HOUR}:${String(REPORT_MINUTE).padStart(2, "0")} UTC`);
}
