import { createHash, randomUUID } from "crypto";
import { lookup } from "dns/promises";
import { isIP } from "net";
import { db } from "@/lib/db";
import { chargeForResult } from "@/lib/result-credits";

const MAX_HTML_BYTES = 2_000_000;
const MAX_TEXT_CHARS = 40_000;
const SNAPSHOT_VERSION = 1;
export type WatchLink = {
  id: string; url: string; label: string; type: string;
  lastHash?: string; lastScanAt?: string; lastText?: string; snapshotVersion?: number;
};
export class WatchChanged extends Error {
  constructor() { super("This watch changed during the scan. Refresh and try again. No credits charged."); }
}

/** Reject local/private destinations at every redirect, before requesting a page. */
export function publicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0)) ||
      (a === 198 && (b === 18 || b === 19)));
  }
  // Only globally routed IPv6 unicast. This also rejects mapped IPv4/local forms.
  return isIP(address) === 6 && /^[23][0-9a-f]{0,3}:/i.test(address);
}

async function publicUrl(value: string, signal: AbortSignal) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      (url.port && !["80", "443"].includes(url.port))) throw new Error("Unsupported page URL");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [{ address: host }] : await Promise.race([
    lookup(host, { all: true }),
    new Promise<never>((_, reject) => {
      if (signal.aborted) reject(new Error("Page lookup timed out"));
      else signal.addEventListener("abort", () => reject(new Error("Page lookup timed out")), { once: true });
    }),
  ]);
  if (!addresses.length || addresses.some(a => !publicAddress(a.address))) throw new Error("Page URL must be public");
  return url;
}

/** Bound bytes and redirects; unsuccessful or challenge pages never replace evidence. */
export type PublicPage = { html: string; finalUrl: string; contentType: string };

/** Safely fetch a public, readable document for Fortify-owned research features. */
export async function readPublicPage(value: string): Promise<PublicPage> {
  const signal = AbortSignal.timeout(10_000);
  let url = value;
  for (let redirects = 0; redirects <= 3; redirects++) {
    const target = await publicUrl(url, signal);
    const res = await fetch(target, { redirect: "manual", signal, headers: {
      "User-Agent": "Mozilla/5.0 (compatible; FortifyBot/1.0)", Accept: "text/html,text/plain",
    } });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get("location");
      void res.body?.cancel().catch(() => {});
      if (!location) throw new Error("Invalid redirect");
      url = new URL(location, target).href;
      continue;
    }
    if (!res.ok || !/^(text\/html|text\/plain|application\/xhtml\+xml)\b/i.test(res.headers.get("content-type") ?? "")) {
      void res.body?.cancel().catch(() => {});
      throw new Error("Page unavailable or not readable text");
    }
    const reader = res.body?.getReader();
    if (!reader) throw new Error("Empty page");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        bytes += chunk.length;
        if (bytes > MAX_HTML_BYTES) throw new Error("Page exceeds scan size limit");
        chunks.push(chunk);
      }
    } finally { void reader.cancel().catch(() => {}); }
    const html = Buffer.concat(chunks).toString("utf8");
    const text = readableWatchText(html);
    if (text.length < 20 || (text.length < 1000 && /just a moment|verify (?:that )?you are human|enable javascript|access denied|checking your browser/i.test(text))) {
      throw new Error("Page has no usable readable content");
    }
    return { html, finalUrl: target.href, contentType: res.headers.get("content-type") ?? "" };
  }
  throw new Error("Too many redirects");
}

export async function readWatchPage(value: string): Promise<string> {
  return readableWatchText((await readPublicPage(value)).html);
}

/** Compare visible wording, ignoring markup, scripts, navigation and timestamps. */
export function readableWatchText(html: string): string {
  const entities: Record<string, string> = { amp: "&", nbsp: " ", lt: "<", gt: ">", quot: '"', apos: "'", pound: "£", euro: "€", ndash: "–", mdash: "—" };
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|nav|footer|time)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity: string) => {
      if (!entity.startsWith("#")) return entities[entity.toLowerCase()] ?? whole;
      const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
    })
    .replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_CHARS);
}

export function compareWatchText(link: WatchLink, text: string, now = new Date()) {
  const lastHash = createHash("sha256").update(text).digest("hex");
  const next = { ...link, lastText: text, lastHash, lastScanAt: now.toISOString(), snapshotVersion: SNAPSHOT_VERSION };
  if (link.snapshotVersion !== SNAPSHOT_VERSION || !link.lastText) {
    return { link: next, hasChange: false, summary: "Readable page baseline saved. Future scans will show added and removed wording." };
  }
  if (link.lastText === text) return { link: next, hasChange: false, summary: "No readable page changes detected." };
  const before = link.lastText.split(" "), after = text.split(" ");
  let start = 0, end = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  while (end < before.length - start && end < after.length - start && before[before.length - 1 - end] === after[after.length - 1 - end]) end++;
  const excerpt = (words: string[]) => words.join(" ").slice(0, 260);
  const removed = excerpt(before.slice(start, before.length - end));
  const added = excerpt(after.slice(start, after.length - end));
  const details = [removed && `Removed: “${removed}”`, added && `Added: “${added}”`].filter(Boolean).join("\n");
  return { link: next, hasChange: true, summary: `Page wording changed${link.label ? ` (${link.label.slice(0, 100)})` : ""}.\n${details}` };
}

export async function scanWatch(watch: { id: string; userId: string; links: unknown; updatedAt: Date }, receiptId?: string) {
  if (receiptId && await db.creditTransaction.findUnique({ where: { id: receiptId } })) return { scans: [], creditsUsed: 0, skipped: true };
  const links = Array.isArray(watch.links) ? watch.links as WatchLink[] : [];
  if (!links.length || links.length > 3) throw new Error("Watch must have one to three page links");
  const updatedLinks = [...links];
  const scans: { id: string; url: string; hasChange: boolean; summary: string; scannedAt: string; failed: boolean }[] = [];
  // Fetch at most three pages together so a watch fits within one function budget.
  await Promise.all(links.map(async (link, index) => {
    try {
      const text = await readWatchPage(link.url);
      const comparison = compareWatchText(link, text);
      updatedLinks[index] = comparison.link;
      scans[index] = { id: randomUUID(), url: link.url, hasChange: comparison.hasChange, summary: comparison.summary, scannedAt: comparison.link.lastScanAt, failed: false };
    } catch {
      scans[index] = { id: randomUUID(), url: link.url, hasChange: false, summary: "Scan failed: page unavailable, blocked or unreadable. Previous baseline preserved. No charge for this page.", scannedAt: new Date().toISOString(), failed: true };
    }
  }));
  const valid = scans.filter(s => !s.failed);
  if (!valid.length) return { scans, creditsUsed: 0, skipped: false };
  const charged = await chargeForResult(watch.userId, 10, "spend_competitor_watch_scan", async tx => {
    const claimed = await tx.competitorWatch.updateMany({ where: { id: watch.id, userId: watch.userId, active: true, updatedAt: watch.updatedAt }, data: { links: updatedLinks } });
    if (claimed.count !== 1) throw new WatchChanged();
    for (const scan of scans) {
      const saved = await tx.competitorWatchScan.create({ data: { watchId: watch.id, url: scan.url, hasChange: scan.hasChange, summary: scan.summary } });
      scan.id = saved.id;
      scan.scannedAt = saved.scannedAt.toISOString();
    }
  }, receiptId);
  return { scans: charged ? scans : [], creditsUsed: charged ? 10 : 0, skipped: !charged };
}
