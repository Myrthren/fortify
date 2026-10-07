import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { whopUrl } from "@/lib/whop-checkout";

export default function AffiliatesPage() {
  const programme = whopUrl(process.env.WHOP_AFFILIATE_URL);
  return <><Nav /><main className="mx-auto max-w-3xl px-6 py-20">
    <span className="eyebrow">Fortify affiliates</span>
    <h1 className="mt-4 text-4xl font-bold">Introduce founders to Fortify.</h1>
    <p className="mt-5 text-text-muted">Share Fortify with your audience and earn commission on eligible referred purchases through Whop. Your commission rate and payout terms are shown on Whop.</p>
    {programme ? <a href={programme} className="btn-primary mt-8">View programme on Whop</a> : <p className="mt-8 text-text-muted">The affiliate programme is being prepared. Enrolment will open after checkout and attribution have been verified.</p>}
    <ol className="mt-10 list-decimal space-y-5 pl-5">
      <li>Find Fortify in Whop’s Affiliates section and view the programme terms.</li>
      <li>Use View assets to copy your personal Whop referral link.</li>
      <li>Share that exact link with your audience. Purchases through PayPal do not earn Whop affiliate commission.</li>
      <li>Tell buyers to <a href="/whop" className="underline">connect Whop to Fortify after purchase</a> to activate their tier.</li>
      <li>Track referrals, eligible commissions and payouts in Whop.</li>
    </ol>
  </main><Footer /></>;
}
