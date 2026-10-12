import { load } from "cheerio";
import { createHash } from "node:crypto";

export type PageChange = { status: "baseline" | "changed" | "unchanged"; hash: string; content: string; summary: string;
  evidence: { added: string[]; removed: string[]; category: string; whyItMatters: string } };

export function meaningfulPageText(html: string): string {
  const $ = load(html);
  $("script,style,noscript,svg,nav,footer,aside,[hidden],[aria-hidden=true],[role=navigation],[role=banner],[class*=cookie],[id*=cookie]").remove();
  const root = $("main,[role=main],article").first();
  const scope = root.length ? root : $("body");
  scope.find("br,h1,h2,h3,h4,p,li,tr,section,div").append("\n");
  const lines = scope.text().split(/\n+/).map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 3 && !/^©|^copyright\b|^last (updated|checked):?\s/i.test(line));
  return [...new Set(lines)].join("\n").slice(0, 16_000);
}

export function comparePage(before: string | undefined, current: string): PageChange {
  const hash = createHash("sha256").update(current).digest("hex");
  const empty = { added: [] as string[], removed: [] as string[], category: "none", whyItMatters: "" };
  if (!before) return { status: "baseline", hash, content: current, summary: "Baseline saved; future scans compare readable page content.", evidence: empty };
  const oldLines = new Set(before.split("\n")), newLines = new Set(current.split("\n"));
  const added = [...newLines].filter((line) => !oldLines.has(line));
  const removed = [...oldLines].filter((line) => !newLines.has(line));
  if (!added.length && !removed.length) return { status: "unchanged", hash, content: current, summary: "No meaningful page-text change detected.", evidence: empty };
  const changed = [...added, ...removed].join(" ");
  const category = /£|\$|€|\bpricing|\bper month|\bper year|\bdiscount|\bfree trial/i.test(changed) ? "pricing or offer" : /\blaunch|\bnew product|\bnew feature|\bavailable now/i.test(changed) ? "product or service" : "page content";
  const evidence = { added: added.slice(0, 6).map((line) => line.slice(0, 500)), removed: removed.slice(0, 6).map((line) => line.slice(0, 500)), category,
    whyItMatters: category === "pricing or offer" ? "Review whether this changes your pricing or offer comparison; no business impact has been measured." : "Review these observed changes before changing your content or strategy." };
  const quotes = [evidence.removed[0] ? `Before: “${evidence.removed[0].slice(0, 180)}”` : "", evidence.added[0] ? `After: “${evidence.added[0].slice(0, 180)}”` : ""].filter(Boolean).join(" ");
  return { status: "changed", hash, content: current, summary: `Changed ${category}. ${quotes}`, evidence };
}
