import { createHash } from "crypto";
/** Never substitute Fortify's own product or an agency offer for the customer's. */
export function requireCampaignOffer(value: string | null | undefined): string {
  const offer = value?.trim();
  if (!offer) throw new Error("Describe what you sell in this campaign before running it. No outreach will run without your offer.");
  return offer;
}

export function offerFingerprint(value: string | null | undefined): string {
  return createHash("sha256").update("customer-offer-v1:" + requireCampaignOffer(value)).digest("hex");
}

export function supportedExcerpt(source: string, excerpt: string): boolean {
  const normalise = (v: string) => v.toLowerCase().replace(/[“”"']/g, "").replace(/\s+/g, " ").trim();
  const needle = normalise(excerpt);
  return needle.length >= 4 && normalise(source).includes(needle);
}
