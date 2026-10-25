export type BusinessTier = "FREE" | "PRO" | "ELITE" | "APEX";

export const BUSINESS_LIMITS: Record<BusinessTier, number> = {
  FREE: 0,
  PRO: 1,
  ELITE: 5,
  APEX: Number.POSITIVE_INFINITY,
};

export const BUSINESS_STAGES = ["Idea", "Pre-revenue", "Early revenue", "Growing", "Established"] as const;
export const BUSINESS_MODELS = ["Services", "SaaS", "E-commerce", "Creator / media", "Marketplace", "Other"] as const;
export const BUSINESS_CHANNELS = ["Content", "Outbound", "Paid ads", "Partnerships", "SEO", "Community"] as const;

export type BusinessSetupInput = {
  name: string;
  website: string;
  industry: string;
  stage: string;
  businessModel: string;
  offer: string;
  audience: string;
  objective: string;
  bottleneck: string;
  teamSize: string;
  channels: string[];
};

export type BusinessRecommendation = {
  phase: "Foundation" | "Demand" | "Systems";
  title: string;
  detail: string;
  href: string;
  tool: string;
};

const text = (value: unknown, max: number, field: string) => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required.`);
  return value.trim().slice(0, max);
};

export function parseBusinessSetup(value: Record<string, unknown>): BusinessSetupInput {
  const website = typeof value.website === "string" ? value.website.trim().slice(0, 300) : "";
  if (website && !/^https?:\/\//i.test(website)) throw new Error("Use a full website address beginning with http:// or https://.");
  const channels = Array.isArray(value.channels)
    ? [...new Set(value.channels.filter((item): item is string => typeof item === "string" && BUSINESS_CHANNELS.includes(item as typeof BUSINESS_CHANNELS[number])))].slice(0, 6)
    : [];
  if (!channels.length) throw new Error("Choose at least one way you reach customers.");
  return {
    name: text(value.name, 100, "Business name"), website,
    industry: text(value.industry, 100, "Industry"),
    stage: text(value.stage, 40, "Business stage"),
    businessModel: text(value.businessModel, 50, "Business model"),
    offer: text(value.offer, 700, "Offer"),
    audience: text(value.audience, 700, "Audience"),
    objective: text(value.objective, 700, "Primary objective"),
    bottleneck: text(value.bottleneck, 700, "Current bottleneck"),
    teamSize: text(value.teamSize, 40, "Team size"), channels,
  };
}

export function businessLimitLabel(limit: number) {
  return Number.isFinite(limit) ? String(limit) : "Unlimited";
}

export function buildBusinessRecommendations(input: BusinessSetupInput): BusinessRecommendation[] {
  const demand = input.channels.includes("Outbound")
    ? { title: "Build a qualified prospect lane", detail: `Define ${input.audience} as a target segment, then move researched prospects into one reviewable pipeline.`, href: "/dashboard/pipeline", tool: "Lead Pipeline" }
    : input.channels.includes("Content") || input.channels.includes("SEO")
      ? { title: "Turn evidence into a content position", detail: `Collect demand signals from ${input.audience}, approve one angle and carry it into a publishable story.`, href: "/dashboard/content?view=research", tool: "Signal Atlas" }
      : { title: "Map the next demand experiment", detail: `Create one measurable route from ${input.offer} to the audience most likely to act.`, href: "/dashboard/plans", tool: "Plans" };
  const automation = /time|manual|capacity|busy|repeat|operation|process/i.test(input.bottleneck)
    ? { title: "Remove the repeated bottleneck", detail: `Convert the repeated work behind “${input.bottleneck.slice(0, 110)}” into a bounded procedure with a human checkpoint.`, href: "/dashboard/workflows", tool: "Workflows" }
    : { title: "Instrument the operating constraint", detail: `Track the evidence behind “${input.bottleneck.slice(0, 110)}” and review whether it improves each week.`, href: "/dashboard/activity", tool: "Activity" };
  return [
    { phase: "Foundation", title: "Establish the business context", detail: `Fortify will use ${input.name}, its offer and its audience as the active context for future plans and agent work.`, href: "/dashboard/company-dna", tool: "Company DNA" },
    { phase: "Demand", ...demand },
    { phase: "Systems", ...automation },
  ];
}
