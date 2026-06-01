#!/usr/bin/env node
/**
 * Fortify email campaign sender (Resend).
 *
 * Reads marketing/fortify-email.html and sends it to every recipient in a CSV.
 * No npm install needed — uses Node 18+ native fetch.
 *
 * USAGE (from the repo root or the marketing folder):
 *
 *   1. Put your Resend key in the environment:
 *        Windows PowerShell:  $env:RESEND_API_KEY="re_xxx"
 *        macOS/Linux:         export RESEND_API_KEY=re_xxx
 *
 *   2. Make a recipients CSV (see recipients.example.csv). Columns: email,name
 *
 *   3. Dry run first (prints what WOULD send, sends nothing):
 *        node send-campaign.js --to recipients.csv --dry-run
 *
 *   4. Real send:
 *        node send-campaign.js --to recipients.csv
 *
 *   Options:
 *     --to <file>        CSV of recipients (default: recipients.csv)
 *     --html <file>      HTML file to send (default: fortify-email.html)
 *     --from "<addr>"    From address (default: env RESEND_FROM or onboarding@resend.dev)
 *     --subject "<txt>"  Subject line (default: built-in)
 *     --dry-run          Validate + preview, send nothing
 *     --limit <n>        Only send to the first n recipients (testing)
 *
 * NOTE: Until you verify a domain in Resend, the test API key can ONLY send to
 * your own account email. Verify fortify-io.com in the Resend dashboard to send
 * to real recipients and to land in inboxes (DKIM/SPF).
 */

const fs = require("fs");
const path = require("path");

// ── Parse args ──────────────────────────────────────────────────────────────
function arg(flag, fallback = undefined) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return fallback;
  // boolean flag (no value follows or next token is another flag)
  const next = process.argv[i + 1];
  if (next === undefined || next.startsWith("--")) return true;
  return next;
}

const HERE = __dirname;
const TO_FILE = arg("--to", "recipients.csv");
const HTML_FILE = arg("--html", "fortify-email.html");
const FROM = arg("--from", process.env.RESEND_FROM || "Fortify <onboarding@resend.dev>");
const SUBJECT = arg("--subject", "One co-pilot. Five tools you can cancel.");
const DRY_RUN = arg("--dry-run", false) === true;
const LIMIT = arg("--limit") ? parseInt(arg("--limit"), 10) : Infinity;

const API_KEY = process.env.RESEND_API_KEY;

// ── Helpers ─────────────────────────────────────────────────────────────────
function die(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

function resolveFile(p) {
  return path.isAbsolute(p) ? p : path.join(HERE, p);
}

function parseCsv(raw) {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  // Detect + skip a header row if it contains "email"
  const start = /email/i.test(lines[0]) ? 1 : 0;
  const rows = [];
  for (let i = start; i < lines.length; i++) {
    const [email, name] = lines[i].split(",").map((s) => (s ?? "").trim());
    if (!email) continue;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      console.warn(`  ⚠ skipping invalid email on line ${i + 1}: "${email}"`);
      continue;
    }
    rows.push({ email, name: name || "" });
  }
  return rows;
}

// Personalise: replace {{name}} and a basic greeting fallback
function personalise(html, name) {
  const safeName = name ? name.replace(/[<>]/g, "") : "there";
  return html.replace(/\{\{\s*name\s*\}\}/g, safeName);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sendOne(to, html) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: [to], subject: SUBJECT, html }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `HTTP ${res.status}`);
  }
  return json.data?.id || "(no id)";
}

// ── Main ────────────────────────────────────────────────────────────────────
(async () => {
  if (!API_KEY) die("RESEND_API_KEY is not set. See the usage notes at the top of this file.");

  const htmlPath = resolveFile(HTML_FILE);
  const toPath = resolveFile(TO_FILE);
  if (!fs.existsSync(htmlPath)) die(`HTML file not found: ${htmlPath}`);
  if (!fs.existsSync(toPath)) die(`Recipients CSV not found: ${toPath}\n   Make one from recipients.example.csv`);

  const html = fs.readFileSync(htmlPath, "utf8");
  let recipients = parseCsv(fs.readFileSync(toPath, "utf8"));
  if (recipients.length === 0) die("No valid recipients found in the CSV.");
  if (Number.isFinite(LIMIT)) recipients = recipients.slice(0, LIMIT);

  console.log(`\nFortify campaign`);
  console.log(`  From:        ${FROM}`);
  console.log(`  Subject:     ${SUBJECT}`);
  console.log(`  HTML:        ${path.basename(htmlPath)} (${(html.length / 1024).toFixed(1)} KB)`);
  console.log(`  Recipients:  ${recipients.length}`);
  console.log(`  Mode:        ${DRY_RUN ? "DRY RUN (nothing sent)" : "LIVE SEND"}\n`);

  if (DRY_RUN) {
    recipients.forEach((r, i) => console.log(`  ${i + 1}. ${r.email}${r.name ? `  (${r.name})` : ""}`));
    console.log(`\n✅ Dry run complete. Remove --dry-run to actually send.\n`);
    return;
  }

  let ok = 0;
  let failed = 0;
  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    const body = personalise(html, r.name);
    try {
      const id = await sendOne(r.email, body);
      ok++;
      console.log(`  ✅ ${i + 1}/${recipients.length}  ${r.email}  →  ${id}`);
    } catch (e) {
      failed++;
      console.log(`  ❌ ${i + 1}/${recipients.length}  ${r.email}  →  ${e.message}`);
    }
    // Resend free tier ~2 req/sec — throttle to stay safe
    await sleep(600);
  }

  console.log(`\nDone. Sent: ${ok}  Failed: ${failed}\n`);
})();
