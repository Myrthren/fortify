import Link from "next/link";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { CheckoutOptions } from "@/components/checkout-options";
import { FaqSection } from "@/components/faq";
import { whopCheckoutUrls } from "@/lib/whop-checkout";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { auth } from "@/auth";
import { Check, Coins, Gem, Minus } from "lucide-react";

type PaidKey = "pro" | "elite" | "apex";

const tiers: {
  key: "free" | PaidKey;
  name: string;
  price: string;
  blurb: string;
  planId?: string;
  highlight?: boolean;
  highlights: string[];
}[] = [
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
    planId: process.env.NEXT_PUBLIC_PAYPAL_PLAN_PRO,
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
    planId: process.env.NEXT_PUBLIC_PAYPAL_PLAN_ELITE,
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
    planId: process.env.NEXT_PUBLIC_PAYPAL_PLAN_APEX,
    highlights: [
      "5,000 credits a month",
      "AI Advisor strategy briefs on Claude Opus",
      "Unlimited voices, competitors and workflows",
      "Mastermind Pods and Apex-only channels",
    ],
  },
];

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
      { label: "Outbound Engine (autopilot)", cells: [false, false, SOON(), SOON()] },
    ],
  },
  {
    section: "Content",
    rows: [
      { label: "Brand voices", cells: [false, "1", "3", "Unlimited"] },
      { label: "Content Inspiration", cells: [false, true, true, true] },
      { label: "Logo Intelligence", cells: [false, true, true, true] },
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
      { label: "AI Advisor (Claude Opus)", cells: [false, false, false, true] },
    ],
  },
  {
    section: "Community",
    rows: [
      { label: "Community forums", cells: [true, true, true, true] },
      { label: "Member directory and deal board", cells: ["Read-only", true, true, true] },
      { label: "AI Matchmaking", cells: [false, true, true, true] },
      { label: "Mastermind Pods and Apex channels", cells: [false, false, false, true] },
      { label: "Early access to new features", cells: [false, false, false, true] },
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
              Pay monthly, cancel anytime. Every tier unlocks both the site and the Discord bot.
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
                <div className="mb-6">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-text-muted">{t.name}</span>
                    {t.highlight && (
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black">
                        Recommended
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight">{t.price}</span>
                    {t.price !== "£0" && <span className="text-sm text-text-muted">/mo</span>}
                  </div>
                  <p className="mt-2 text-sm text-text-muted">{t.blurb}</p>
                </div>

                <ul className="mb-6 flex-1 space-y-2.5 text-sm">
                  {i > 0 && (
                    <li className="text-xs text-text-dim">Everything in {tiers[i - 1].name}, plus:</li>
                  )}
                  {t.highlights.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.06]">
                        <Check className="h-2.5 w-2.5 text-text" />
                      </span>
                      <span className="text-text">{f}</span>
                    </li>
                  ))}
                </ul>

                {t.key === "free" ? (
                  <a href={signedIn ? "/dashboard" : "/login"} className="btn-secondary w-full">
                    {signedIn ? "Go to dashboard" : "Start free"}
                  </a>
                ) : (
                  <CheckoutOptions tier={t.key} whopUrl={whop[t.key]} planId={t.planId} highlight={t.highlight} signedIn={signedIn} />
                )}
              </div>
            ))}
          </div>

          <div className="mx-auto mt-8 max-w-3xl rounded-xl border border-bg-border bg-bg-panel px-5 py-4 text-center text-sm leading-relaxed text-text-muted">
            <p>
              <span className="font-medium text-text">Pay monthly, cancel anytime</span> with Whop or PayPal.
              There is no free trial of paid plans (the Free plan is the way to try Fortify), and payments
              are non-refundable. Cancelling a PayPal plan moves you to Free straight away; Whop access follows
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
            <div className="card overflow-x-auto">
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
