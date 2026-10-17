// Loads the public checkout pages in headless Chrome and fails if any link or
// button inside a card is covered by something else, or if a paid plan has
// no clickable checkout button. Catches the kind of bug where a decorative
// overlay silently swallowed the Subscribe buttons on /pricing.
//
//   node scripts/check-clickable.mjs [baseUrl]     (default https://fortify-io.com)
//   CHROME_PATH=/path/to/chrome node scripts/check-clickable.mjs http://localhost:3000
//
// Talks to Chrome over the DevTools protocol directly, so it needs no npm
// packages; it does need Node 22+ for the global WebSocket.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = (process.argv[2] || "https://fortify-io.com").replace(/\/$/, "");
const PAGES = ["/", "/pricing", "/whop", "/affiliates", "/login"];
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900, mobile: false },
  { name: "phone", width: 375, height: 812, mobile: true },
];
// Paid plans that must each have a reachable checkout control on /pricing.
const PLANS = ["Pro", "Elite", "Apex"];

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  const found = candidates.find((p) => p && existsSync(p));
  if (!found) throw new Error("Chrome not found; set CHROME_PATH");
  return found;
}

// Runs inside the page. Returns blocked controls and per-plan checkout status.
const AUDIT = `(() => {
  const label = (el) => (el.innerText || el.getAttribute("aria-label") || el.tagName).trim().replace(/\\s+/g, " ").slice(0, 60);
  const describe = (el) => el ? el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\\s+/).slice(0, 3).join(".") : "") : "nothing";
  let lastHit = null;
  // An inline link that wraps has one box per line, and the centre of its
  // overall box can fall between them, so test the centre of each fragment.
  const reachable = (el) => {
    el.scrollIntoView({ block: "center", inline: "center" });
    const rects = [...el.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
    if (!rects.length) return null; // hidden at this size: not our concern
    for (const r of rects) {
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (hit === el || el.contains(hit)) return true;
      lastHit = hit;
    }
    return false;
  };
  const controls = [...document.querySelectorAll(".bento a, .bento button, .card a, .card button, .card-elevated a, .card-elevated button, main a.btn-primary, main a.btn-secondary")];
  const blocked = [];
  let checked = 0;
  for (const el of controls) {
    const ok = reachable(el);
    if (ok === null) continue;
    checked++;
    if (!ok) blocked.push(label(el) + " (under " + describe(lastHit) + ")");
  }
  const plans = {};
  if (location.pathname === "/pricing") {
    for (const card of document.querySelectorAll(".bento")) {
      const name = card.querySelector("span")?.innerText?.trim();
      if (!${JSON.stringify(PLANS)}.includes(name)) continue;
      const buttons = [...card.querySelectorAll("a, button")].filter((b) => /subscribe|sign in|paypal/i.test(b.innerText));
      plans[name] = buttons.some((b) => reachable(b) === true);
    }
  }
  return { checked, blocked, plans };
})()`;

async function main() {
  const profile = mkdtempSync(join(tmpdir(), "fortify-click-"));
  const port = 9300 + Math.floor(Math.random() * 500);
  const chrome = spawn(findChrome(), [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: "ignore" });

  const failures = [];
  try {
    const ws = await connect(port);
    for (const vp of VIEWPORTS) {
      await ws.send("Emulation.setDeviceMetricsOverride", { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.mobile });
      for (const path of PAGES) {
        const url = BASE + path;
        const loaded = ws.once("Page.loadEventFired");
        await ws.send("Page.navigate", { url });
        await Promise.race([loaded, sleep(30000)]);
        await sleep(2500); // let hydration and entrance animations settle
        const { result } = await ws.send("Runtime.evaluate", { expression: AUDIT, returnByValue: true });
        const r = result.value;
        const missing = Object.keys(r.plans).length ? PLANS.filter((p) => !r.plans[p]) : [];
        if (path === "/pricing" && !Object.keys(r.plans).length) missing.push(...PLANS);
        const status = r.blocked.length || missing.length ? "FAIL" : "ok";
        console.log(`${status.padEnd(4)} ${vp.name.padEnd(7)} ${path.padEnd(12)} ${r.checked} controls checked`);
        for (const b of r.blocked) failures.push(`${vp.name} ${path}: "${b}" is covered and can't be clicked`);
        for (const p of missing) failures.push(`${vp.name} ${path}: ${p} has no clickable checkout button`);
      }
    }
    ws.close();
  } finally {
    chrome.kill();
    await sleep(500);
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold files */ }
  }

  if (failures.length) {
    console.error(`\n${failures.length} problem(s):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log("\nAll card links and checkout buttons are clickable.");
}

async function connect(port) {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === "page");
    } catch { /* Chrome still starting */ }
    if (!target) await sleep(200);
  }
  if (!target) throw new Error("Could not reach Chrome's DevTools endpoint");

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let nextId = 1;
  const pending = new Map();
  const waiters = new Map();
  socket.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      data.error ? reject(new Error(data.error.message)) : resolve(data.result);
    } else if (data.method && waiters.has(data.method)) {
      for (const w of waiters.get(data.method)) w(data.params);
      waiters.delete(data.method);
    }
  };
  const api = {
    send: (method, params = {}) => new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    }),
    once: (method) => new Promise((resolve) => waiters.set(method, [...(waiters.get(method) || []), resolve])),
    close: () => socket.close(),
  };
  await api.send("Page.enable");
  // Visit as someone who has already answered the cookie banner. The fixed
  // banner otherwise covers whatever sits at the bottom of a phone screen,
  // which is expected and dismissible, not the overlay bug this test is for.
  await api.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `try { localStorage.setItem("fortify-cookie-consent", "declined"); } catch {}`,
  });
  return api;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

main().catch((err) => { console.error(err); process.exit(1); });
