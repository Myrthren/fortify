import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { PayPalButton } from "@/components/paypal-button";
import { Check, Gem } from "lucide-react";

const tiers = [
  {
    key: "free",
    name: "Free",
    price: "£0",
    blurb: "Get inside the gate.",
    cta: "Start free",
    features: [
      "100 starter credits",
      "£0.20 one-time AI trial",
      "10 cold outreach messages",
      "5 Trend Radar watch terms",
      "Hook Generator",
      "Member directory (read-only)",
      "Deal board (read-only)",
      "Community forums",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: "£29",
    blurb: "Armed and active.",
    cta: "Subscribe",
    planId: process.env.NEXT_PUBLIC_PAYPAL_PLAN_PRO,
    features: [
      "500 credits / month",
      "Unlimited AI chat",
      "Brand Voice Studio (1 voice)",
      "Cold Outreach — 50 / month",
      "Funnel Auditor — 5 / month",
      "Competitor Scanner (3 tracked)",
      "Lead Sourcing",
      "Content Inspiration Engine",
      "Meta Ads dashboard",
      "Shopify + Revenue dashboards",
      "Company DNA (AI memory)",
      "Logo Intelligence",
      "Analytics (GA4, Search Console)",
      "AI Matchmaking",
      "Trend Radar — 10 watch terms",
    ],
  },
  {
    key: "elite",
    name: "Elite",
    price: "£79",
    blurb: "Trusted operator.",
    cta: "Subscribe",
    planId: process.env.NEXT_PUBLIC_PAYPAL_PLAN_ELITE,
    highlight: true,
    features: [
      "Everything in Pro",
      "1,500 credits / month",
      "3 brand voice profiles",
      "Unlimited audits + outreach",
      "Unlimited Trend Radar terms",
      "10 competitors tracked",
      "Competitor Watch (live page monitoring)",
      "Fortify Recon (local business intel)",
      "Virality Engine + Reddit trends",
      "Workflows (AI automation builder)",
      "Company DNA — 100k characters",
      "Weekly AI strategy report (Discord)",
    ],
  },
  {
    key: "apex",
    name: "Apex",
    price: "£199",
    blurb: "Top of the fortress.",
    cta: "Subscribe",
    planId: process.env.NEXT_PUBLIC_PAYPAL_PLAN_APEX,
    features: [
      "Everything in Elite",
      "5,000 credits / month",
      "Unlimited brand voices + competitors",
      "Unlimited workflows + Company DNA",
      "AI Advisor — Claude Opus strategic briefs",
      "4,000-token AI responses (2× deeper)",
      "15-session AI memory (3× deeper context)",
      "Auto-publish to TikTok, YouTube, Facebook",
      "Mastermind Pod access",
      "Apex-only Discord channels",
      "Early access to new features",
    ],
  },
];

const DELAYS = ["", "anim-d1", "anim-d2", "anim-d3"];

export default function PricingPage() {
  return (
    <>
      <Nav />
      <section className="relative overflow-hidden">
        {/* Ambient background */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] overflow-hidden">
          <div className="aurora aurora-violet left-1/2 top-[-180px] h-[440px] w-[720px] -translate-x-1/2" />
          <div className="bg-grid-fade absolute inset-0" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="anim-fade-up mb-12 text-center sm:mb-16">
            <span className="eyebrow"><Gem className="h-3.5 w-3.5" /> Choose your tier</span>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              Pricing that scales with you.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-text-muted">
              Pay monthly, cancel anytime. All sales are final — no refunds. Every tier unlocks both
              site + Discord features.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tiers.map((t, i) => (
              <div
                key={t.key}
                className={`bento anim-fade-up ${DELAYS[i]} flex flex-col p-6 ${
                  t.highlight ? "ring-1 ring-white/25" : ""
                }`}
                style={t.highlight ? { boxShadow: "0 0 50px -18px rgba(255,255,255,0.35)" } : undefined}
              >
                {t.highlight && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-white px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black">
                    Popular
                  </span>
                )}
                <div className="mb-6">
                  <div className="text-sm font-medium text-text-muted">{t.name}</div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight">{t.price}</span>
                    {t.price !== "£0" && <span className="text-sm text-text-muted">/mo</span>}
                  </div>
                  <p className="mt-2 text-sm text-text-muted">{t.blurb}</p>
                </div>

                <ul className="mb-6 flex-1 space-y-2.5 text-sm">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.06]">
                        <Check className="h-2.5 w-2.5 text-text" />
                      </span>
                      <span className="text-text">{f}</span>
                    </li>
                  ))}
                </ul>

                {t.planId ? (
                  <PayPalButton planId={t.planId} tier={t.key as "pro" | "elite" | "apex"} />
                ) : (
                  <a href="/login" className={t.highlight ? "btn-primary w-full" : "btn-secondary w-full"}>
                    {t.cta}
                  </a>
                )}
              </div>
            ))}
          </div>

          <p className="anim-fade-up anim-d4 mt-10 text-center text-xs text-text-dim">
            Prices in GBP · Secure checkout via PayPal · Cancel anytime from your dashboard
          </p>
        </div>
      </section>
      <Footer />
    </>
  );
}
