import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

const blocked = new BlockList();
for (const [address, prefix] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.168.0.0", 16], ["192.0.0.0", 24], ["192.0.2.0", 24], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4]] as const) blocked.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of [["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8], ["2001:db8::", 32]] as const) blocked.addSubnet(address, prefix, "ipv6");

export function publicAddress(address: string): boolean {
  const family = isIP(address);
  return !!family && !blocked.check(address, family === 4 ? "ipv4" : "ipv6");
}

export function publicPageUrl(raw: string): URL {
  const url = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      (url.port && url.port !== "80" && url.port !== "443") || host === "localhost" || host.endsWith(".localhost") ||
      host.endsWith(".local") || (!host.includes(".") && !isIP(host)) || (isIP(host) && !publicAddress(host))) throw new Error("Use a public HTTP(S) website URL");
  url.hash = "";
  return url;
}

/** Pin the approved DNS answer for the socket; revalidate every redirect. */
export async function readPublicPage(raw: string): Promise<{ url: string; html: string }> {
  let url = publicPageUrl(raw);
  const deadline = Date.now() + 12_000;
  for (let hop = 0; hop <= 3; hop++) {
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const answers = isIP(host) ? [{ address: host, family: isIP(host) }] : await Promise.race([
      lookup(host, { all: true }),
      new Promise<never>((_, reject) => { const timer = setTimeout(() => reject(new Error("DNS lookup timed out")), Math.max(1, deadline - Date.now())); timer.unref(); }),
    ]);
    if (!answers.length || answers.some((answer) => !publicAddress(answer.address))) throw new Error("Website resolves to a non-public address");
    const address = answers[0];
    const result = await new Promise<{ status: number; location?: string; html: string; contentType: string }>((resolve, reject) => {
      const transport = url.protocol === "https:" ? httpsRequest : httpRequest;
      const req = transport(url, {
        headers: { "User-Agent": "FortifyResearch/1.0 (+https://fortify-io.com)", Accept: "text/html" },
        lookup: ((_hostname: string, options: any, cb: any) => options?.all ? cb(null, [address]) : cb(null, address.address, address.family)) as any,
      }, (res) => {
        const chunks: Buffer[] = []; let bytes = 0;
        res.on("data", (chunk: Buffer) => { bytes += chunk.length; if (bytes > 750_000) { req.destroy(new Error("Page exceeds research size limit")); return; } chunks.push(chunk); });
        res.on("error", reject);
        res.on("end", () => resolve({ status: res.statusCode ?? 0, location: res.headers.location, html: Buffer.concat(chunks).toString("utf8"), contentType: res.headers["content-type"] ?? "" }));
      });
      const timer = setTimeout(() => req.destroy(new Error("Website request timed out")), Math.max(1, deadline - Date.now()));
      req.on("close", () => clearTimeout(timer)); req.on("error", reject); req.end();
    });
    if ([301, 302, 303, 307, 308].includes(result.status) && result.location) {
      url = publicPageUrl(new URL(result.location, url).toString()); continue;
    }
    if (result.status < 200 || result.status >= 300) throw new Error(`Website returned HTTP ${result.status}`);
    if (!/text\/html|application\/xhtml\+xml/i.test(result.contentType)) throw new Error("Website did not return an HTML page");
    return { url: url.toString(), html: result.html };
  }
  throw new Error("Website redirected too many times");
}
