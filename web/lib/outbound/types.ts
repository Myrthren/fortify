/**
 * Outbound — domain types and provider contracts.
 *
 * Everything the outbound engine touches on the outside world (finding
 * businesses, reading their site, thinking about them, writing, sending) goes
 * through one of the interfaces below. The engine never imports Apify, Brave,
 * Anthropic or Resend directly — it asks the registry for a provider by key.
 * Swapping Resend for SES is a new file in providers/send plus one env var.
 */

// ─── Discovery ────────────────────────────────────────────

export type DiscoveryInput = {
  /** Free-text description of the target, e.g. "dental practices in Manchester" */
  query: string;
  location?: string | null;
  industry?: string | null;
  limit: number;
};

export type DiscoveredBusiness = {
  company: string;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  contactName?: string | null;
  industry?: string | null;
  location?: string | null;
  /** Whatever the source returned, kept for debugging and future enrichment. */
  raw?: Record<string, unknown>;
};

export type DiscoveryPoll =
  | { status: "running" }
  | { status: "done"; results: DiscoveredBusiness[] }
  | { status: "failed"; error: string };

/**
 * Providers come in two shapes and the engine handles both:
 *
 *  - Synchronous (`discover`) — answers inside one request. Brave.
 *  - Two-phase (`startJob` + `pollJob`) — takes minutes, so the engine starts a
 *    job on one tick and collects it on a later one. Apify crawlers.
 *
 * Two-phase exists because a scraper that runs for four minutes cannot live
 * inside a serverless function invocation. Splitting it means a timeout costs
 * nothing: the job keeps running remotely and the next tick picks it up.
 */
export interface DiscoveryProvider {
  readonly key: string;
  readonly label: string;
  /** False when the provider's credentials are missing — the registry skips it. */
  isAvailable(): boolean;
  discover?(input: DiscoveryInput): Promise<DiscoveredBusiness[]>;
  startJob?(input: DiscoveryInput): Promise<string>;
  pollJob?(jobId: string): Promise<DiscoveryPoll>;
}

// ─── Scraping ─────────────────────────────────────────────

export type ScrapedPage = {
  url: string;
  title: string | null;
  /** Visible text, already stripped of markup. */
  text: string;
};

/**
 * Machine-detectable facts about a site. These are deliberately separate from
 * the AI analysis: they are cheap, deterministic, and give the model concrete
 * evidence to reason from instead of guessing. If a signal is null it means
 * "could not tell", which is different from false.
 */
export type SiteSignals = {
  hasSsl: boolean;
  hasContactForm: boolean;
  hasBookingWidget: boolean;
  hasLiveChat: boolean;
  hasChatbot: boolean;
  hasNewsletterCapture: boolean;
  hasPhoneNumber: boolean;
  hasMobileViewport: boolean;
  hasMetaDescription: boolean;
  titleLength: number | null;
  h1Count: number;
  detectedCrm: string[];
  detectedAnalytics: string[];
  detectedBooking: string[];
  detectedChat: string[];
  detectedEcommerce: string[];
  detectedEmailMarketing: string[];
  socialLinks: string[];
  emails: string[];
  htmlBytes: number;
  fetchMs: number;
};

export type ScrapedSite = {
  finalUrl: string;
  pages: ScrapedPage[];
  /** Concatenated page text, truncated to a model-safe budget. */
  text: string;
  signals: SiteSignals;
};

export interface ScrapeProvider {
  readonly key: string;
  readonly label: string;
  isAvailable(): boolean;
  scrape(url: string, opts?: { maxPages?: number }): Promise<ScrapedSite>;
}

// ─── Analysis ─────────────────────────────────────────────

export type Assessment = {
  /** 1 = badly broken, 5 = strong. */
  rating: number;
  note: string;
};

export const ANALYSIS_DIMENSIONS = [
  "websiteQuality",
  "leadCapture",
  "bookingSystem",
  "contactForms",
  "crm",
  "chatbot",
  "automation",
  "manualWorkflows",
  "marketing",
  "seo",
  "customerExperience",
] as const;

export type AnalysisDimension = (typeof ANALYSIS_DIMENSIONS)[number];

export type LeadAnalysis = Record<AnalysisDimension, Assessment>;

export type Opportunity = {
  title: string;
  /** Must quote or reference something actually on the site. Guardrails check this. */
  evidence: string;
  impact: "high" | "medium" | "low";
  /** Which Fortify capability addresses it. */
  fortifyService: string;
  /** 0-100 confidence that this is real and worth raising. */
  score: number;
};

export type AnalysisResult = {
  analysis: LeadAnalysis;
  opportunities: Opportunity[];
  /** Why Fortify could help, in plain language. Shown on the lead page. */
  summary: string;
  suggestedService: string;
  /** 0-100. Below the campaign's threshold the lead is disqualified. */
  opportunityScore: number;
  /** Enrichment the analyser picked up in passing. */
  contactName?: string | null;
  industry?: string | null;
  /** Set when the analyser judges the lead a bad fit outright. */
  disqualify?: { reason: string } | null;
};

export type AnalysisInput = {
  company: string;
  website: string | null;
  industry?: string | null;
  location?: string | null;
  site: ScrapedSite | null;
  /** What the sender is offering — steers which gaps count as opportunities. */
  offer: string;
};

export interface AnalysisProvider {
  readonly key: string;
  readonly label: string;
  isAvailable(): boolean;
  analyse(input: AnalysisInput): Promise<AnalysisResult>;
}

// ─── Composition ──────────────────────────────────────────

/**
 * The variation axes. One value is chosen per email from a per-lead seeded RNG,
 * so two leads never receive the same shape of message and a re-run of the same
 * lead is reproducible.
 */
export type VariationChoice = {
  greeting: string;
  opening: string;
  structure: string;
  tone: string;
  signOff: string;
  cta: string;
  /** Rough target, the guardrail enforces the hard 70-140 range. */
  targetWords: number;
};

export type ComposeInput = {
  lead: {
    company: string;
    contactName?: string | null;
    website?: string | null;
    industry?: string | null;
    location?: string | null;
  };
  analysis: AnalysisResult | null;
  offer: string;
  sender: { name: string; title?: string | null; email: string };
  variation: VariationChoice;
  /** 0 = first touch. 1+ = follow-up, with the thread so far for context. */
  step: number;
  previousEmails: { subject: string; body: string; sentAt: Date | null }[];
  /** Trained brand voice system prompt, when the campaign has one. */
  voiceSystemPrompt?: string | null;
  /** Subjects/openers already used for this user recently — avoid repeating. */
  avoidPhrases?: string[];
};

export type ComposedEmail = {
  subject: string;
  body: string;
  model: string;
};

export interface ComposeProvider {
  readonly key: string;
  readonly label: string;
  isAvailable(): boolean;
  compose(input: ComposeInput): Promise<ComposedEmail>;
}

// ─── Sending ──────────────────────────────────────────────

export type OutboundMessage = {
  to: string;
  toName?: string | null;
  from: string;
  fromName?: string | null;
  replyTo?: string | null;
  subject: string;
  /** Plain text. Providers wrap it themselves — cold email should not look like a newsletter. */
  text: string;
  /** Set on follow-ups so the reply threads under the original. */
  inReplyTo?: string | null;
  references?: string[];
  headers?: Record<string, string>;
};

export type SendResult = {
  /** Provider's own id, used to match webhook events back to the email. */
  providerId: string | null;
  /** RFC Message-ID, used for threading follow-ups. */
  messageId: string | null;
};

export interface SendProvider {
  readonly key: string;
  readonly label: string;
  isAvailable(): boolean;
  /** True when the provider reports opens without us injecting a pixel. */
  readonly tracksOpens: boolean;
  /** True when the provider reports bounces via webhook. */
  readonly tracksBounces: boolean;
  send(message: OutboundMessage): Promise<SendResult>;
}

// ─── Inbox (reading replies back) ─────────────────────────

/**
 * A message pulled from the sending mailbox.
 *
 * This exists because a plain mailbox has no webhook. Providers that push
 * events (Resend) never need it; providers that are just SMTP do, and without
 * it "a reply stops the sequence" would depend on someone pasting replies in by
 * hand — which is the one guarantee in this system that cannot be manual.
 */
export type InboundMessage = {
  /** IMAP UID within the mailbox. Used as the resume point, not as an id. */
  uid: number;
  /** RFC Message-ID of this reply. */
  messageId: string | null;
  /** Message-IDs this is a reply to, newest intent first. */
  inReplyTo: string[];
  from: string | null;
  fromName: string | null;
  to: string[];
  subject: string;
  /** Body with quoted history and signature already stripped. */
  text: string;
  receivedAt: Date;
  /** True when this is a delivery status notification rather than a human. */
  isBounce: boolean;
  /** For a DSN, the address that actually failed. */
  bouncedRecipient: string | null;
  /** True when the DSN reports a permanent failure. */
  isHardBounce: boolean;
};

export type InboxCursor = {
  uidValidity: string | null;
  lastUid: number;
};

export type InboxFetch = {
  messages: InboundMessage[];
  cursor: InboxCursor;
};

export interface InboxProvider {
  readonly key: string;
  readonly label: string;
  isAvailable(): boolean;
  /** Identifies the mailbox, so its read cursor can be stored against it. */
  identity(): { host: string; username: string; mailbox: string };
  /**
   * Everything arrived since `cursor`. Must not mutate the mailbox — no marking
   * as read, no moving, no deleting. It is the user's real inbox.
   */
  fetchSince(cursor: InboxCursor, limit: number): Promise<InboxFetch>;
}
