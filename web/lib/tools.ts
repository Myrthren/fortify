import {
  Sparkles, Send, ClipboardCheck, Radar, TrendingUp, Search, Lightbulb, BarChart3,
  ShoppingBag, LineChart, Clapperboard, Dna, MapPin, Eye, Workflow, Zap, Activity,
  Handshake, Palette, AtSign, Target, PackageOpen, Layers, type LucideIcon,
} from "lucide-react";
import type { Tier } from "@prisma/client";

// Single source of truth for the dashboard tool inventory. The nav, the hub
// tab bars and the dashboard home grid all read from here, so a tool's tier,
// label and availability only ever change in one place.

export type MinTier = "PRO" | "ELITE" | "APEX";

export type ActiveKey =
  | "dashboard" | "voice" | "outreach" | "audit" | "trends" | "competitors"
  | "matchmaking" | "inspiration" | "leads" | "ads" | "analytics" | "shopify"
  | "revenue" | "virality" | "dna" | "logo" | "members" | "deals" | "pods"
  | "forums" | "messages" | "connections" | "notifications" | "profile"
  | "settings" | "support" | "credits" | "recon" | "competitor-watch"
  | "workflows" | "advisor" | "outbound" | "lead-extractor" | "lead-pack" | "pipeline" | "activity" | "plans";

export type HubKey = "leads" | "competitors" | "insights";

export type Tool = {
  key: ActiveKey;
  href: string;
  label: string;
  /** Shorter label used inside a hub's tab bar. */
  tabLabel?: string;
  desc: string;
  icon: LucideIcon;
  minTier?: MinTier;
  /** Built but not available yet; shown with a "Soon" marker, never as usable. */
  soon?: boolean;
  hub?: HubKey;
};

// Outbound sends from a mailbox that is not connected yet. Flip this on (build
// time, so server and client agree) once sending is live.
const OUTBOUND_LIVE = process.env.NEXT_PUBLIC_OUTBOUND_ENABLED === "true";

export const TOOLS: Record<Exclude<ActiveKey, "dashboard" | "activity" | "members" | "deals" | "pods" | "forums" | "messages" | "connections" | "notifications" | "profile" | "settings" | "support" | "credits">, Tool> = {
  plans: { key: "plans", href: "/dashboard/plans", label: "Plans", desc: "Map future goals, decisions and connected procedures", icon: Layers },
  pipeline: { key: "pipeline", href: "/dashboard/pipeline", label: "Lead Pipeline", desc: "Research, drafts and follow-ups for every prospect", icon: Target, hub: "leads" },
  voice:            { key: "voice", href: "/dashboard/voice", label: "Brand Voice Studio", desc: "Train AI on your tone of voice", icon: Sparkles, minTier: "PRO" },
  inspiration:      { key: "inspiration", href: "/dashboard/inspiration", label: "Content Inspiration", desc: "Mine Reddit and YouTube for angles", icon: Lightbulb, minTier: "PRO" },
  virality:         { key: "virality", href: "/dashboard/virality", label: "Virality Engine", desc: "Score and publish short-form video", icon: Clapperboard, minTier: "ELITE" },
  logo:             { key: "logo", href: "/dashboard/logo", label: "Logo Intelligence", desc: "Critique and refine your brand mark", icon: Palette, minTier: "PRO" },

  "lead-extractor": { key: "lead-extractor", href: "/dashboard/lead-extractor", label: "Lead Extractor", tabLabel: "Social leads", desc: "Contacts from TikTok and Instagram profiles", icon: AtSign, minTier: "PRO", hub: "leads" },
  "lead-pack":      { key: "lead-pack", href: "/dashboard/lead-pack", label: "Weekly Lead Pack", tabLabel: "Weekly pack", desc: "New local leads with drafts, every Monday", icon: PackageOpen, minTier: "ELITE", hub: "leads" },
  recon:            { key: "recon", href: "/dashboard/recon", label: "Fortify Recon", tabLabel: "Local leads", desc: "Local businesses from Google Maps", icon: MapPin, minTier: "ELITE", hub: "leads" },
  leads:            { key: "leads", href: "/dashboard/leads", label: "Lead Sourcing", tabLabel: "Lead scoring", desc: "Score prospects against your ideal customer", icon: Target, minTier: "PRO", hub: "leads" },
  outreach:         { key: "outreach", href: "/dashboard/outreach", label: "Cold Outreach", tabLabel: "Outreach", desc: "Messages in your voice that get replies", icon: Send, hub: "leads" },
  outbound:         { key: "outbound", href: "/dashboard/outbound", label: "Outbound Engine", tabLabel: "Autopilot", desc: "Finds, researches and emails leads for you", icon: Zap, minTier: "ELITE", soon: !OUTBOUND_LIVE, hub: "leads" },

  audit:            { key: "audit", href: "/dashboard/audit", label: "Funnel Auditor", desc: "Score and fix any landing page", icon: ClipboardCheck, minTier: "PRO" },
  trends:           { key: "trends", href: "/dashboard/trends", label: "Trend Radar", desc: "Track topics across the web", icon: TrendingUp },
  competitors:      { key: "competitors", href: "/dashboard/competitors", label: "Competitor Scanner", tabLabel: "Scanner", desc: "Intel reports on rivals", icon: Radar, minTier: "PRO", hub: "competitors" },
  "competitor-watch": { key: "competitor-watch", href: "/dashboard/competitor-tracking", label: "Competitor Watch", tabLabel: "Watch", desc: "Get alerted when their pages change", icon: Eye, minTier: "ELITE", hub: "competitors" },

  revenue:          { key: "revenue", href: "/dashboard/revenue", label: "Revenue", desc: "MRR, subscriptions and charges", icon: LineChart, minTier: "PRO", hub: "insights" },
  shopify:          { key: "shopify", href: "/dashboard/shopify", label: "Shopify", desc: "Orders, products and stock", icon: ShoppingBag, minTier: "PRO", hub: "insights" },
  ads:              { key: "ads", href: "/dashboard/ads", label: "Meta Ads", desc: "Campaign performance and ad intel", icon: BarChart3, minTier: "PRO", hub: "insights" },
  analytics:        { key: "analytics", href: "/dashboard/analytics", label: "Analytics", desc: "GA4 and Search Console", icon: Activity, minTier: "PRO", soon: true, hub: "insights" },
  dna:              { key: "dna", href: "/dashboard/company-dna", label: "Company DNA", desc: "The context every tool works from", icon: Dna, minTier: "PRO" },

  workflows:        { key: "workflows", href: "/dashboard/workflows", label: "Workflows", desc: "Multi-step AI automations", icon: Workflow, minTier: "ELITE" },
  advisor:          { key: "advisor", href: "/dashboard/advisor", label: "AI Advisor", desc: "In-depth strategy briefings", icon: Zap, minTier: "APEX" },
  matchmaking:      { key: "matchmaking", href: "/dashboard/matchmaking", label: "AI Matchmaking", desc: "Members worth talking to", icon: Handshake, minTier: "PRO" },
};

export const HUBS: Record<HubKey, { label: string; desc: string; icon: LucideIcon; tabs: ActiveKey[] }> = {
  leads:       { label: "Leads & Outreach", desc: "Find leads, score them, write to them", icon: Search, tabs: ["pipeline", "lead-extractor", "recon", "lead-pack", "leads", "outreach", "outbound"] },
  competitors: { label: "Competitors", desc: "Scan rivals and watch for changes", icon: Radar, tabs: ["competitors", "competitor-watch"] },
  insights:    { label: "Business Insights", desc: "Revenue, Shopify, ads and analytics", icon: LineChart, tabs: ["revenue", "shopify", "ads", "analytics"] },
};

export function tool(key: ActiveKey): Tool | undefined {
  return (TOOLS as Record<string, Tool>)[key];
}

const RANK: Record<Tier, number> = { FREE: 0, PRO: 1, ELITE: 2, APEX: 3 };

export function isLocked(minTier: MinTier | undefined, tier: Tier): boolean {
  return !!minTier && RANK[tier] < RANK[minTier];
}

/** The lowest tier that opens at least one usable tab in a hub. */
export function hubMinTier(hub: HubKey): MinTier | undefined {
  const tiers = HUBS[hub].tabs.map((k) => tool(k)).filter((t) => t && !t.soon).map((t) => t!.minTier);
  if (tiers.some((t) => !t)) return undefined;
  return tiers.sort((a, b) => RANK[a!] - RANK[b!])[0];
}

/** A hub's entry point: its first tab the user can open, else its first tab. */
export function hubHref(hub: HubKey, tier: Tier): string {
  const tabs = HUBS[hub].tabs.map((k) => tool(k)!);
  return (tabs.find((t) => !t.soon && !isLocked(t.minTier, tier)) ?? tabs[0]).href;
}

// Nav entries: either a single tool or a hub that stands in for several.
export type NavEntry = { kind: "tool"; key: ActiveKey } | { kind: "hub"; hub: HubKey };

export const NAV_GROUPS: { heading: string; entries: NavEntry[] }[] = [
  { heading: "Content",    entries: [{ kind: "tool", key: "voice" }, { kind: "tool", key: "inspiration" }, { kind: "tool", key: "virality" }, { kind: "tool", key: "logo" }] },
  { heading: "Growth",     entries: [{ kind: "hub", hub: "leads" }, { kind: "tool", key: "audit" }] },
  { heading: "Research",   entries: [{ kind: "tool", key: "trends" }, { kind: "hub", hub: "competitors" }] },
  { heading: "Business",   entries: [{ kind: "tool", key: "plans" }, { kind: "hub", hub: "insights" }, { kind: "tool", key: "dna" }] },
  { heading: "Automation", entries: [{ kind: "tool", key: "workflows" }, { kind: "tool", key: "advisor" }] },
];

export function entryKeys(e: NavEntry): ActiveKey[] {
  return e.kind === "hub" ? HUBS[e.hub].tabs : [e.key];
}
