// What a credit buys, for the pricing page and FAQ. Each figure mirrors the
// deduction in the route named alongside it; change both together.
export const CREDIT_COSTS: { action: string; cost: string }[] = [
  { action: "Lead search (Lead Sourcer)", cost: "50" },                                       // api/leads/source
  { action: "Lead Extractor, per social profile", cost: "20" },                               // api/lead-extractor
  { action: "Fortify Recon search", cost: "50, +25 for emails, +25 for AI context" },        // api/recon
  { action: "Competitor social or Meta Ads scan", cost: "50" },                               // api/competitors/[id]/scan-*
  { action: "Competitor search-ranking scan", cost: "35" },                                   // api/competitors/[id]/scan-serp
  { action: "Competitor Watch: add a page, then each check", cost: "25, then 10" },          // api/competitor-watch
  { action: "Logo generation / enhancement", cost: "150 / 100" },                             // api/logo/*
];

export const CREDITS_FREE_START = 100;
