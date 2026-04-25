import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { PayPalButton } from "@/components/paypal-button";
import { Check } from "lucide-react";

const tiers = [
  {
    key: "free",
    name: "Recruit",
    price: "$0",
    blurb: "Get inside the gate.",
    cta: "Start free",
    features: [
      "10 AI generations / day",
      "Basic profile + blurred directory",
      "Weekly trend digest email",
      "Read-only deal board",
    ],
  },
  {
    key: "pro",
    name: "Soldier",
    price: "$29",
    blurb: "Armed and active.",
    cta: "Subscribe",
    planId: process.env.NEXT_PUBLIC_PAYPAL_PLAN_PRO,
    features: [
      "Unlimited AI generations",
      "1 brand voice profile (Claude)",
      "Daily personalised trend radar",
      "Funnel auditor — 5/mo",
      "Cold outreach generator — 50/mo",
      "Full directory + matchmaking",
    ],
  },
  {
    key: "elite",
    name: "Knight",
    price: "$79",
    blurb: "Trusted operator.",
    cta: "Subscribe",
    planId: process.env.NEXT_PUBLIC_PAYPAL_PLAN_ELITE,
    highlight: true,
    features: [
      "Everything in Pro",
      "3 brand voice profiles",
      "Unlimited audits",
      "Competitor & niche scanner",
      "Weekly strategy report (Sundays)",
      "10 news-triggered alerts",
      "Office-hours booking",
    ],
  },
  {
    key: "apex",
    name: "Apex",
    price: "$199",
    blurb: "Top of the fortress.",
    cta: "Subscribe",
    planId: process.env.NEXT_PUBLIC_PAYPAL_PLAN_APEX,
    features: [
      "Everything in Elite",
      "Unlimited everything",
      "Claude Opus on every feature",
      "Custom AI workflows",
      "Monthly deep-dive PDF report",
      "Apex-only channels + concierge",
      "Early access to all new features",
    ],
  },
];

export default function PricingPage() {
  return (
    <>
      <Nav />
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-16 text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Pricing.</h1>
          <p className="mx-auto mt-4 max-w-xl text-text-muted">
            Pay monthly, cancel anytime. Every tier unlocks Discord + site features.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiers.map((t) => (
            <div
              key={t.key}
              className={`flex flex-col rounded-lg border bg-bg-panel p-6 ${
                t.highlight ? "border-white/30 glow-soft" : "border-bg-border"
              }`}
            >
              <div className="mb-6">
                <div className="text-sm font-medium text-text-muted">{t.name}</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tracking-tight">{t.price}</span>
                  {t.price !== "$0" && <span className="text-sm text-text-muted">/mo</span>}
                </div>
                <p className="mt-2 text-sm text-text-muted">{t.blurb}</p>
              </div>

              <ul className="mb-6 flex-1 space-y-2.5 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
                    <span>{f}</span>
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
