import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { whopUrl } from "@/lib/whop-checkout";

// Keep in line with the commission settings on the Whop product; Whop is
// what actually tracks and pays, this page only summarises it.
const TERMS = [
  { label: "Commission", value: "30% of each payment" },
  { label: "Duration", value: "First 12 months of every customer you refer" },
  { label: "Payouts", value: "Tracked and paid by Whop, on Whop's payout schedule" },
  { label: "Eligible purchases", value: "Whop checkouts through your referral link only" },
];

export default function AffiliatesPage() {
  const programme = whopUrl(process.env.WHOP_AFFILIATE_URL);
  return <><Nav /><main className="mx-auto max-w-3xl px-6 py-20">
    <span className="eyebrow">Fortify affiliates</span>
    <h1 className="mt-4 text-4xl font-bold">Introduce founders to Fortify.</h1>
    <p className="mt-5 text-text-muted">Share Fortify with your audience and earn commission on the subscriptions they buy through your Whop referral link.</p>

    <dl className="card mt-8 divide-y divide-bg-border">
      {TERMS.map((t) => <div key={t.label} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:gap-6">
        <dt className="w-44 shrink-0 text-sm text-text-dim">{t.label}</dt>
        <dd className="text-sm text-text">{t.value}</dd>
      </div>)}
    </dl>
    <p className="mt-3 text-xs leading-relaxed text-text-dim">
      Only Whop referral links earn commission. A customer who pays through PayPal, or reaches checkout from a link
      that isn&rsquo;t yours, is not attributed to you. On a £79 Elite plan, 30% is £23.70 a month for up to 12 months.
      The full programme terms on Whop take precedence over this summary.
    </p>

    {programme ? <a href={programme} className="btn-primary mt-8">View programme on Whop</a> : <p className="mt-8 text-text-muted">The affiliate programme is being prepared. Enrolment will open after checkout and attribution have been verified.</p>}
    <h2 className="mt-12 text-lg font-semibold">How it works</h2>
    <ol className="mt-4 list-decimal space-y-5 pl-5">
      <li>Find Fortify in Whop&rsquo;s Affiliates section and view the programme terms.</li>
      <li>Use View assets to copy your personal Whop referral link.</li>
      <li>Share that exact link with your audience, not fortify-io.com or the pricing page.</li>
      <li>Tell buyers to <a href="/whop" className="underline">connect Whop to Fortify after purchase</a> to activate their tier.</li>
      <li>Track referrals, eligible commissions and payouts in Whop.</li>
    </ol>
  </main><Footer /></>;
}
