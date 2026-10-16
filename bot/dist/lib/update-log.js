"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startUpdateLog = startUpdateLog;
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_http_1 = require("node:http");
const discord_js_1 = require("discord.js");
const db_1 = require("./db");
const STATE_ID = "discord-update-log";
const DEFAULT_CHANNEL_ID = "1507848599927787560";
const DEFAULT_ROLE_ID = "1469480118912024791";
const blankState = () => ({ batch: null, releases: [], deliveries: [] });
const firstLine = (value = "") => value.split("\n", 1)[0].trim();
const isRevert = (commit) => /This reverts commit [0-9a-f]{7,40}\.?/i.test(`${commit.message ?? ""}\n${commit.body ?? ""}`) || /^revert(?:\(.+\))?:/i.test(commit.message ?? "");
const revertedSha = (commit) => /This reverts commit ([0-9a-f]{7,40})\.?/i.exec(`${commit.message ?? ""}\n${commit.body ?? ""}`)?.[1]?.toLowerCase() ?? null;
function nextVersion(current, bump) {
    const [major, minor, patch] = current.split(".").map(Number);
    if (bump === "major")
        return `${major + 1}.0.0`;
    if (bump === "minor")
        return `${major}.${minor + 1}.0`;
    return `${major}.${minor}.${patch + 1}`;
}
function determineBump(commits) {
    const messages = commits.map((commit) => `${commit.message ?? ""}\n${commit.body ?? ""}`);
    if (messages.some((message) => /(^|\n)[^\n]*!:\s|BREAKING[ -]CHANGE:/i.test(message)))
        return "major";
    return messages.some((message) => /^feat(?:\(.+\))?:/im.test(message)) ? "minor" : "patch";
}
function classify(message = "") {
    const match = /^(feat|fix|perf|refactor|security|docs|chore)(?:\([^)]*\))?!?:\s*(.+)$/i.exec(firstLine(message));
    const labels = {
        feat: "What's new",
        fix: "Fixes",
        perf: "Improvements",
        refactor: "Improvements",
        security: "Security",
        docs: "Helpful updates",
        chore: "Behind the scenes",
    };
    const summary = match?.[2] ?? firstLine(message);
    return { label: labels[match?.[1]?.toLowerCase() ?? ""] ?? "Other changes", summary: summary ? `${summary[0].toUpperCase()}${summary.slice(1)}` : summary };
}
function buildEmbed(release) {
    const groups = new Map();
    for (const commit of release.commits) {
        const { label, summary } = classify(commit.message);
        if (!summary)
            continue;
        groups.set(label, [...(groups.get(label) ?? []), `• ${summary}`]);
    }
    const fields = [...groups.entries()].slice(0, 5).map(([name, lines]) => ({ name, value: lines.slice(0, 10).join("\n").slice(0, 1024), inline: false }));
    fields.push({ name: "Fortify version", value: `v${release.version}`, inline: true });
    if (release.repositoryUrl)
        fields.push({ name: "More detail", value: `[Technical change list](${release.repositoryUrl}/compare/${release.before}...${release.after})`, inline: true });
    return new discord_js_1.EmbedBuilder().setColor(release.bump === "major" ? 0xe74c3c : release.bump === "minor" ? 0x3498db : 0x2ecc71).setTitle("Fortify has been updated").setDescription("Here’s what’s changed since the last update.").addFields(fields).setFooter({ text: "Fortify Update Log" }).setTimestamp();
}
async function loadState() {
    await db_1.db.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "UpdateLogState" ("id" TEXT PRIMARY KEY, "payload" JSONB NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    const rows = await db_1.db.$queryRawUnsafe('SELECT "payload" FROM "UpdateLogState" WHERE "id" = $1', STATE_ID);
    return rows[0] ? JSON.parse(JSON.stringify(rows[0].payload)) : blankState();
}
async function saveState(state) {
    const payload = JSON.parse(JSON.stringify(state));
    await db_1.db.$executeRawUnsafe('INSERT INTO "UpdateLogState" ("id", "payload") VALUES ($1, $2::jsonb) ON CONFLICT ("id") DO UPDATE SET "payload" = EXCLUDED."payload", "updatedAt" = CURRENT_TIMESTAMP', STATE_ID, JSON.stringify(payload));
}
function signatureIsValid(raw, signature, secret) {
    if (!signature?.startsWith("sha256="))
        return false;
    const expected = `sha256=${node_crypto_1.default.createHmac("sha256", secret).update(raw).digest("hex")}`;
    return signature.length === expected.length && node_crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
async function rawBody(request) {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > 1_000_000)
            throw new Error("Payload too large.");
        chunks.push(buffer);
    }
    return Buffer.concat(chunks);
}
function startUpdateLog(client) {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
        console.warn("[update-log] Disabled: GITHUB_WEBHOOK_SECRET is not set.");
        return;
    }
    const channelId = process.env.DISCORD_UPDATE_LOG_CHANNEL_ID ?? DEFAULT_CHANNEL_ID;
    const roleId = process.env.DISCORD_UPDATE_LOG_ROLE_ID ?? DEFAULT_ROLE_ID;
    const branch = process.env.GITHUB_DEFAULT_BRANCH ?? "main";
    const windowMs = Number(process.env.UPDATE_LOG_WINDOW_HOURS ?? 4) * 60 * 60 * 1000;
    let timer;
    let tail = Promise.resolve();
    const serial = (work) => { const result = tail.then(work, work); tail = result.then(() => undefined, () => undefined); return result; };
    const channel = async () => {
        const result = await client.channels.fetch(channelId);
        if (!result?.isTextBased?.() || typeof result.send !== "function")
            throw new Error("Update-log channel is unavailable or not text-based.");
        return result;
    };
    const post = async (release) => (await channel()).send({ content: `<@&${roleId}>`, allowedMentions: { roles: [roleId] }, embeds: [buildEmbed(release)] });
    const edit = async (release) => {
        const target = await channel();
        const message = await target.messages.fetch(release.messageId);
        await message.edit({ content: `<@&${roleId}>`, allowedMentions: { parse: [] }, embeds: [buildEmbed(release)] });
    };
    const remove = async (release) => {
        const target = await channel();
        const message = await target.messages.fetch(release.messageId).catch(() => null);
        if (message)
            await message.delete();
    };
    const schedule = async () => {
        if (timer)
            clearTimeout(timer);
        const batch = (await loadState()).batch;
        if (!batch)
            return;
        timer = setTimeout(() => { void flushDue().catch((error) => console.error("[update-log] timer failed", error)); }, Math.max(0, Date.parse(batch.closesAt) - Date.now()));
    };
    const latestVersion = (state) => state.releases.at(-1)?.version ?? "0.2.0";
    const flushDueUnsafe = async (state) => {
        const batch = state.batch;
        if (!batch || Date.parse(batch.closesAt) > Date.now())
            return false;
        if (!batch.commits.length) {
            state.batch = null;
            return true;
        }
        const bump = determineBump(batch.commits);
        const release = { ...batch, id: node_crypto_1.default.randomUUID(), version: nextVersion(latestVersion(state), bump), bump, visible: true, messageId: "" };
        release.messageId = (await post(release)).id;
        state.releases.push(release);
        state.batch = null;
        return true;
    };
    const reconcile = async (state, sha) => {
        if (state.batch) {
            const commits = state.batch.commits.filter((commit) => !commit.id.startsWith(sha));
            if (commits.length !== state.batch.commits.length) {
                state.batch = commits.length ? { ...state.batch, commits } : null;
                return true;
            }
        }
        const release = [...state.releases].reverse().find((candidate) => candidate.visible && candidate.commits.some((commit) => commit.id.startsWith(sha)));
        if (!release)
            return false;
        const commits = release.commits.filter((commit) => !commit.id.startsWith(sha));
        if (!commits.length) {
            await remove(release);
            release.visible = false;
        }
        else {
            const updated = { ...release, commits };
            await edit(updated);
            Object.assign(release, updated);
        }
        return true;
    };
    const retained = async (push, sha) => {
        const apiUrl = push.repository?.url;
        if (!apiUrl)
            throw new Error("GitHub repository API URL is missing.");
        const response = await fetch(`${apiUrl}/compare/${sha}...${push.after}`, { headers: { Accept: "application/vnd.github+json", ...(process.env.GITHUB_API_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_API_TOKEN}` } : {}) } });
        if (!response.ok)
            throw new Error(`GitHub comparison failed (${response.status}).`);
        const comparison = await response.json();
        return comparison.status === "ahead" || comparison.status === "identical";
    };
    const flushDue = () => serial(async () => { const state = await loadState(); const changed = await flushDueUnsafe(state); if (changed)
        await saveState(state); await schedule(); });
    const processPush = (push) => serial(async () => {
        const state = await loadState();
        await flushDueUnsafe(state);
        if (push.forced) {
            const tracked = [...new Set([...(state.batch?.commits ?? []), ...state.releases.filter((release) => release.visible).flatMap((release) => release.commits)].map((commit) => commit.id))];
            for (const sha of tracked)
                if (!(await retained(push, sha)))
                    await reconcile(state, sha);
        }
        for (const commit of push.commits.filter(isRevert)) {
            const sha = revertedSha(commit);
            if (sha)
                await reconcile(state, sha);
        }
        const commits = push.commits.filter((commit) => !isRevert(commit));
        if (commits.length) {
            if (!state.batch)
                state.batch = { id: node_crypto_1.default.randomUUID(), startedAt: new Date().toISOString(), closesAt: new Date(Date.now() + windowMs).toISOString(), before: push.before, after: push.after, repositoryUrl: push.repository?.html_url, repositoryApiUrl: push.repository?.url, commits: [] };
            const ids = new Set(state.batch.commits.map((commit) => commit.id));
            state.batch.commits.push(...commits.filter((commit) => !ids.has(commit.id)));
            state.batch.after = push.after;
        }
        await saveState(state);
        await schedule();
    });
    const server = (0, node_http_1.createServer)(async (request, response) => {
        if (request.method === "GET" && request.url === "/health") {
            response.writeHead(200, { "content-type": "application/json" });
            return response.end(JSON.stringify({ ok: true }));
        }
        if (request.method !== "POST" || request.url !== "/github") {
            response.writeHead(404);
            return response.end();
        }
        try {
            const raw = await rawBody(request);
            const signature = request.headers["x-hub-signature-256"];
            if (!signatureIsValid(raw, Array.isArray(signature) ? signature[0] : signature, secret)) {
                response.writeHead(401);
                return response.end("Invalid signature");
            }
            if (request.headers["x-github-event"] !== "push") {
                response.writeHead(202);
                return response.end();
            }
            const delivery = request.headers["x-github-delivery"];
            const push = JSON.parse(raw.toString("utf8"));
            if (typeof delivery !== "string" || push.ref !== `refs/heads/${branch}` || push.deleted || !push.commits?.length) {
                response.writeHead(202);
                return response.end();
            }
            const state = await loadState();
            if (state.deliveries.some((item) => item.id === delivery)) {
                response.writeHead(200);
                return response.end(JSON.stringify({ duplicate: true }));
            }
            await processPush(push);
            const updated = await loadState();
            updated.deliveries = [...updated.deliveries, { id: delivery, at: new Date().toISOString() }].filter((item) => Date.parse(item.at) > Date.now() - 90 * 24 * 60 * 60 * 1000);
            await saveState(updated);
            response.writeHead(202, { "content-type": "application/json" });
            response.end(JSON.stringify({ queued: true }));
        }
        catch (error) {
            console.error("[update-log] webhook failed", error);
            response.writeHead(500);
            response.end("Update log processing failed");
        }
    });
    const port = Number(process.env.PORT ?? 3000);
    server.listen(port, () => console.log(`[update-log] Listening for GitHub webhooks on port ${port}.`));
    void flushDue().catch((error) => console.error("[update-log] recovery failed", error));
}
