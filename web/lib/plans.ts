// Public plan cards, shared by /pricing and /whop. Limits behind these lines
// live in lib/tiers.ts; keep the wording in step with it.
export type PaidKey = "pro" | "elite" | "apex";
export type PlanKey = "free" | PaidKey;

export type Plan = {
  key: PlanKey;
  name: string;
  price: string;
  blurb: string;
  highlight?: boolean;
  highlights: string[];
};

export const PLANS: Plan[] = [
  {
    key: "free",
    name: "Free",
    price: "£0",
    blurb: "Get inside the gate.",
    highlights: [
      "100 starter credits",
      "10 outreach messages a month",
      "5 Trend Radar topics",
      "Forums, member directory and deal board",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: "£29",
    blurb: "For operators getting started.",
    highlights: [
      "500 credits a month",
      "Brand Voice Studio and unlimited AI chat",
      "Social lead extraction and lead scoring",
      "Competitor Scanner for 3 rivals",
    ],
  },
  {
    key: "elite",
    name: "Elite",
    price: "£79",
    blurb: "The full outbound and research stack.",
    highlight: true,
    highlights: [
      "1,500 credits a month",
      "Unlimited outreach, audits and trend topics",
      "Local business leads with Fortify Recon",
      "Workflows and live Competitor Watch",
    ],
  },
  {
    key: "apex",
    name: "Apex",
    price: "£199",
    blurb: "No ceilings, plus strategy on tap.",
    highlights: [
      "5,000 credits a month",
      "AI Advisor strategy briefs on Claude Opus",
      "Unlimited voices, competitors and workflows",
      "Mastermind Pods and Apex-only channels",
    ],
  },
];

export const PAID_PLANS = PLANS.filter((p): p is Plan & { key: PaidKey } => p.key !== "free");
