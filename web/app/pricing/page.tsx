import Link from "next/link";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { CheckoutOptions } from "@/components/checkout-options";
import { PlanCard } from "@/components/plan-card";
import { FaqSection } from "@/components/faq";
import { whopCheckoutUrls } from "@/lib/whop-checkout";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { auth } from "@/auth";
import { PLANS, type PaidKey } from "@/lib/plans";
import { Check, Coins, Gem, Minus } from "lucide-react";

// PayPal plan ids are public (NEXT_PUBLIC_) and only used by the PayPal button.
const PAYPAL_PLAN_IDS: Record<PaidKey, string | undefined> = {
  pro: process.env.NEXT_PUBLIC_PAYPAL_PLAN_PRO,
  elite: process.env.NEXT_PUBLIC_PAYPAL_PLAN_ELITE,
  apex: process.env.NEXT_PUBLIC_PAYPAL_PLAN_APEX,
};

const tiers = PLANS;

// A cell is either included (true), not included (false), a value, or coming soon.
type Cell = boolean | string | { soon: true; note?: string };
const SOON = (note?: string): Cell => ({ soon: true, note });

const COMPARISON: { section: string; rows: { label: string; cells: [Cell, Cell, Cell, Cell] }[] }[] = [
  {
    section: "Credits and AI",
    rows: [
      { label: "Credits", cells: ["100 to start", "500 / month", "1,500 / month", "5,000 / month"] },
      { label: "AI chat", cells: ["Trial", "Unlimited", "Unlimited", "Unlimited, 2× deeper answers"] },
      { label: "Hook Generator", cells: [true, true, true, true] },
    ],
  },
  {
    section: "Leads and outreach",
    rows: [
      { label: "Cold outreach messages", cells: ["10 / month", "50 / month", "Unlimited", "Unlimited"] },
      { label: "Lead Extractor (TikTok, Instagram)", cells: [false, "10 per batch", "25 per batch", "50 per batch"] },
      { label: "Lead scoring", cells: [false, true, true, true] },
      { label: "Fortify Recon (Google Maps leads)", cells: [false, false, true, true] },
      { label: "Weekly lead pack (new local leads + drafts, Mondays)", cells: [false, false, "15 a week", "25 a week"] },
      { label: "Outbound Engine (autopilot)", cells: [false, false, SOON(), SOON()] },
    ],
  },
  {
    section: "Content",
    rows: [
      { label: "Brand voices", cells: [false, "1", "3", "Unlimited"] },
      { label: "Content Inspiration", cells: [false, true, true, true] },
      { label: "Virality Engine", cells: [false, false, true, true] },
      { label: "Auto-publish to YouTube and Facebook", cells: [false, false, false, true] },
      { label: "Auto-publish to TikTok", cells: [false, false, false, SOON()] },
    ],
  },
  {
    section: "Research",
    rows: [
      { label: "Trend Radar topics", cells: ["5", "10", "Unlimited", "Unlimited"] },
      { label: "Reddit and YouTube comment trends", cells: [false, false, true, true] },
      { label: "Funnel audits", cells: [false, "5 / month", "Unlimited", "Unlimited"] },
      { label: "Competitors tracked", cells: [false, "3", "10", "Unlimited"] },
      { label: "Competitor Watch (page change alerts)", cells: [false, false, true, true] },
    ],
  },
  {
    section: "Business",
    rows: [
      { label: "Company DNA (AI memory)", cells: [false, "30k characters", "100k characters", "Unlimited"] },
      { label: "Meta Ads, Shopify and Revenue dashboards", cells: [false, true, true, true] },
      { label: "Analytics (GA4, Search Console)", cells: [false, SOON(), SOON(), SOON()] },
    ],
  },
  {
    section: "Automation and strategy",
    rows: [
      { label: "Workflows", cells: [false, false, "Standard capacity", "Unlimited"] },
      { label: "Weekly AI strategy report (Discord)", cells: [false, false, true, true] },
      { label: "AI Advisor (in-depth strategy briefs)", cells: [false, false, false, true] },
      { label: "Monthly Growth Brief", cells: [false, false, false, true] },
    ],
  },
  {
    section: "Community",
    rows: [
      { label: "Community forums", cells: [true, true, true, true] },
      { label: "Member directory and deal board", cells: ["Read-only", true, true, true] },
      { label: "AI Matchmaking", cells: [false, true, true, true] },
      { label: "Mastermind Pods (launch with the first Apex members)", cells: [false, false, false, SOON()] },
    ],
  },
];

const DELAYS = ["", "anim-d1", "anim-d2", "anim-d3"];

export default async function PricingPage() {
  const whop = whopCheckoutUrls();
  const signedIn = !!(await auth())?.user;
  return (
    <>
      <Nav />
      <section className="relative overflow-x-clip">
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
              Pay monthly, cancel anytime. Every tier unlocks both the site and the Discord bot.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tiers.map((t, i) => (
              <PlanCard key={t.key} plan={t} previous={tiers[i - 1]?.name} className={`anim-fade-up ${DELAYS[i]}`}>
                {t.key === "free" ? (
                  <a href={signedIn ? "/dashboard" : "/login"} className="btn-secondary w-full">
                    {signedIn ? "Go to dashboard" : "Start free"}
                  </a>
                ) : (
                  <CheckoutOptions tier={t.key} whopUrl={whop[t.key]} planId={PAYPAL_PLAN_IDS[t.key]} highlight={t.highlight} signedIn={signedIn} />
                )}
              </PlanCard>
            ))}
          </div>

          <div className="mx-auto mt-8 max-w-3xl rounded-xl border border-bg-border bg-bg-panel px-5 py-4 text-center text-sm leading-relaxed text-text-muted">
            <p>
              <span className="font-medium text-text">Pay monthly, cancel anytime</span> with Whop or PayPal.
              There is no free trial of paid plans (the Free plan is the way to try Fortify), and payments
              are non-refundable. Cancelling a PayPal plan keeps your access until the end of the month you paid for; Whop access follows
              your Whop membership.
            </p>
          </div>

          <p className="mt-6 text-center text-sm text-text-muted">
            <a href="#compare" className="underline-offset-4 hover:text-text hover:underline">Compare every feature ↓</a>
          </p>

          {/* ── Full comparison ── */}
          <div id="compare" className="mt-20 scroll-mt-24">
            <h2 className="mb-2 text-center text-2xl font-bold tracking-tight sm:text-3xl">Compare plans</h2>
            <p className="mb-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-text-dim">
              <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-text" aria-hidden /> Included</span>
              <span className="inline-flex items-center gap-1.5"><Minus className="h-3.5 w-3.5" aria-hidden /> Not included</span>
              <span className="inline-flex items-center gap-1.5"><SoonBadge /> Not available yet</span>
            </p>
            <div className="card hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-bg-border">
                    <th className="w-[34%] px-4 py-3 text-left font-medium text-text-muted">Feature</th>
                    {tiers.map((t) => (
                      <th key={t.key} className={`px-3 py-3 text-center font-semibold ${t.highlight ? "text-text" : "text-text-muted"}`}>
                        {t.name}
                        <span className="block text-xs font-normal text-text-dim">{t.price}{t.price !== "£0" && "/mo"}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                {COMPARISON.map((group) => (
                  <tbody key={group.section}>
                    <tr>
                      <td colSpan={5} className="px-4 pb-2 pt-6 text-[11px] font-semibold uppercase tracking-wider text-text-dim">
                        {group.section}
                      </td>
                    </tr>
                    {group.rows.map((row) => (
                      <tr key={row.label} className="border-t border-bg-border/60">
                        <td className="px-4 py-2.5 text-text">{row.label}</td>
                        {row.cells.map((cell, ci) => (
                          <td key={ci} className={`px-3 py-2.5 text-center ${tiers[ci].highlight ? "bg-white/[0.02]" : ""}`}>
                            <CellValue cell={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>

            {/* Phones: each feature on its own row with all four plans side by side,
                under a plan header that stays pinned while scrolling. */}
            <div className="md:hidden">
              <div className="sticky top-14 z-10 grid grid-cols-4 gap-1 rounded-xl border border-bg-border bg-bg/90 px-2 py-2 text-center backdrop-blur">
                {tiers.map((t) => (
                  <div key={t.key} className={`rounded-md py-1 ${t.highlight ? "bg-white/[0.06]" : ""}`}>
                    <p className={`text-xs font-semibold ${t.highlight ? "text-text" : "text-text-muted"}`}>{t.name}</p>
                    <p className="text-[10px] text-text-dim">{t.price}{t.price !== "£0" && "/mo"}</p>
                  </div>
                ))}
              </div>
              {COMPARISON.map((group) => (
                <div key={group.section} className="mt-6">
                  <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-text-dim">{group.section}</p>
                  <div className="card divide-y divide-bg-border/60">
                    {group.rows.map((row) => (
                      <div key={row.label} className="px-3 py-3">
                        <p className="text-sm text-text">{row.label}</p>
                        <div className="mt-2 grid grid-cols-4 gap-1 text-center text-xs leading-snug">
                          {row.cells.map((cell, ci) => (
                            <div key={ci} className={`flex min-h-[28px] items-center justify-center rounded-md px-0.5 py-1 ${tiers[ci].highlight ? "bg-white/[0.04]" : ""}`}>
                              <span className="sr-only">{tiers[ci].name}: </span>
                              <CellValue cell={cell} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Credits ── */}
          <div id="credits" className="mt-20 scroll-mt-24">
            <div className="mb-6 text-center">
              <span className="eyebrow"><Coins className="h-3.5 w-3.5" /> Credits</span>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">What a credit buys</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-text-muted">
                Credits pay for heavier jobs that pull outside data. Everyday writing (hooks, outreach, audits,
                brand voice) uses each plan&rsquo;s monthly allowances instead. Paid plans add their credits on the
                1st of every month, unused credits roll over and never expire, and top-up packs start at 800 credits
                for £8.99.
              </p>
            </div>
            <div className="card mx-auto max-w-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-bg-border">
                    <th className="px-4 py-3 text-left font-medium text-text-muted">Action</th>
                    <th className="px-4 py-3 text-right font-medium text-text-muted">Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {CREDIT_COSTS.map((c) => (
                    <tr key={c.action} className="border-t border-bg-border/60">
                      <td className="px-4 py-2.5 text-text">{c.action}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-text-muted">{c.cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-center text-xs text-text-dim">
              As a guide, Pro&rsquo;s 500 monthly credits cover about ten lead searches or 25 Lead Extractor profiles.
            </p>
          </div>

          <div className="anim-fade-up anim-d4 mx-auto mt-14 max-w-2xl space-y-2 text-center text-xs leading-relaxed text-text-dim">
            <p>
              Prices in GBP. Whop and PayPal unlock the same tier and Discord roles; manage or cancel billing with
              the provider you paid through. See the{" "}
              <Link href="/terms" className="underline hover:text-text-muted">terms</Link>.
            </p>
            <p>
              Paid through Whop? <Link href="/whop" className="underline hover:text-text-muted">Activate your membership</Link>.
              PayPal needs no extra step. Referred by an affiliate? Buy through their Whop link so they receive credit.
            </p>
          </div>
        </div>
      </section>
      <FaqSection />
      <Footer />
    </>
  );
}

// Icons carry no text, so each mark gets a visually hidden label: screen
// readers and text-only views otherwise see the cell as empty.
function CellValue({ cell }: { cell: Cell }) {
  if (cell === true) return <><Check className="mx-auto h-4 w-4 text-text" aria-hidden /><span className="sr-only">Included</span></>;
  if (cell === false) return <><Minus className="mx-auto h-4 w-4 text-text-dim" aria-hidden /><span className="sr-only">Not included</span></>;
  if (typeof cell === "string") return <span className="text-text-muted">{cell}</span>;
  return <SoonBadge />;
}

function SoonBadge() {
  return (
    <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
      Soon
    </span>
  );
}
