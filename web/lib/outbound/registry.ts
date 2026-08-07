import { braveDiscovery } from "@/lib/outbound/providers/discovery/brave";
import { googleMapsDiscovery } from "@/lib/outbound/providers/discovery/google-maps";
import { claudeAnalysis } from "@/lib/outbound/providers/analysis/claude";
import { claudeComposer } from "@/lib/outbound/providers/compose/claude";
import { fetchScraper } from "@/lib/outbound/providers/scrape/fetch";
import { resendSender } from "@/lib/outbound/providers/send/resend";
import { smtpSender } from "@/lib/outbound/providers/send/smtp";
import type {
  AnalysisProvider,
  ComposeProvider,
  DiscoveryProvider,
  ScrapeProvider,
  SendProvider,
} from "@/lib/outbound/types";

/**
 * Provider registry.
 *
 * The engine resolves providers by key at call time — never by import. Adding a
 * provider is one file plus one line in the relevant map; switching the default
 * is one env var. Campaigns can also pin their own provider per row, which is
 * what makes per-campaign inbox and source choice possible later without
 * touching the engine.
 */

const DISCOVERY: Record<string, DiscoveryProvider> = {
  [googleMapsDiscovery.key]: googleMapsDiscovery,
  [braveDiscovery.key]: braveDiscovery,
};

const SCRAPE: Record<string, ScrapeProvider> = {
  [fetchScraper.key]: fetchScraper,
};

const ANALYSIS: Record<string, AnalysisProvider> = {
  [claudeAnalysis.key]: claudeAnalysis,
};

const COMPOSE: Record<string, ComposeProvider> = {
  [claudeComposer.key]: claudeComposer,
};

const SEND: Record<string, SendProvider> = {
  [resendSender.key]: resendSender,
  [smtpSender.key]: smtpSender,
};

/**
 * Resolve in order: explicit request, env default, first available. Falling
 * through to "first available" matters because a missing API key should degrade
 * to a working alternative rather than failing the whole tick.
 */
function resolve<T extends { key: string; isAvailable(): boolean }>(
  kind: string,
  map: Record<string, T>,
  requested: string | null | undefined,
  envDefault: string | undefined
): T {
  const candidates = [requested, envDefault].filter(Boolean) as string[];
  for (const key of candidates) {
    const p = map[key];
    if (p?.isAvailable()) return p;
  }
  const fallback = Object.values(map).find((p) => p.isAvailable());
  if (fallback) return fallback;

  const configured = Object.keys(map).join(", ");
  throw new Error(
    `No ${kind} provider is available. Configured: ${configured}. Check the relevant API keys are set.`
  );
}

export function getDiscoveryProvider(key?: string | null): DiscoveryProvider {
  return resolve("discovery", DISCOVERY, key, process.env.OUTBOUND_DISCOVERY_PROVIDER);
}

export function getScrapeProvider(key?: string | null): ScrapeProvider {
  return resolve("scrape", SCRAPE, key, process.env.OUTBOUND_SCRAPE_PROVIDER);
}

export function getAnalysisProvider(key?: string | null): AnalysisProvider {
  return resolve("analysis", ANALYSIS, key, process.env.OUTBOUND_ANALYSIS_PROVIDER);
}

export function getComposeProvider(key?: string | null): ComposeProvider {
  return resolve("compose", COMPOSE, key, process.env.OUTBOUND_COMPOSE_PROVIDER);
}

export function getSendProvider(key?: string | null): SendProvider {
  return resolve("send", SEND, key, process.env.OUTBOUND_SEND_PROVIDER);
}

/** Used by the campaign form to show only providers that will actually work. */
export function listProviders() {
  const describe = (map: Record<string, { key: string; label: string; isAvailable(): boolean }>) =>
    Object.values(map).map((p) => ({
      key: p.key,
      label: p.label,
      available: p.isAvailable(),
    }));

  return {
    discovery: describe(DISCOVERY),
    scrape: describe(SCRAPE),
    analysis: describe(ANALYSIS),
    compose: describe(COMPOSE),
    send: describe(SEND),
  };
}
