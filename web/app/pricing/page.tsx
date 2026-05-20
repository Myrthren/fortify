import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { PayPalButton } from "@/components/paypal-button";
import { Check } from "lucide-react";

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
      "Basic profile + directory",
      "Deal board (read-only)",
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
      "Unlimited AI chat (budget-based)",
      "1 brand voice profile",
      "Trend Radar — 10 watch terms",
      "Cold outreach — 50 / month",
      "Funnel auditor — 5 / month",
      "Fortify Recon lead sourcing",
      "Full directory + matchmaking",
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
      "Competitor & niche scanner",
      "Virality score + Reddit trends",
      "Weekly strategy report",
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
      "Unlimited brand voices",
      "Custom AI workflows",
      "Auto-publish content",
      "Mastermind Pod access",
      "Apex-only Discord channels",
      "Early access to new features",
    ],
  },
];

export default function PricingPage() {
  return (
    <>
      <Nav />
      <section className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="bg-spotlight absolute inset-x-0 top-0 -z-10 h-[400px]" />

        <div className="mb-12 text-center sm:mb-16">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Pricing</h1>
          <p className="mx-auto mt-4 max-w-xl text-text-muted">
            Pay monthly, cancel anytime. Every tier unlocks both site + Discord features.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tiers.map((t) => (
            <div
              key={t.key}
              className={`flex flex-col p-6 ${
                t.highlight
                  ? "card-elevated relative ring-1 ring-white/20 glow-soft"
                  : "card"
              }`}
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
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
                    <span className="text-text">{f}</span>
                  </li>
                ))}
              </ul>

              {t.planId ? (
                <PayPalButton planId={t.planId} tier={t.key as "pro" | "elite" | "apex"} />
              ) : (
                <a href="/login" className="btn-secondary w-full">{t.cta}</a>
              )}
            </div>
          ))}
        </div>
      </section>
      <Footer />
    </>
  );
}
