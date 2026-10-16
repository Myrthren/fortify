import Link from "next/link";
import { Handshake, Info } from "lucide-react";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { NumberedStep, PageHero, SectionHeading } from "@/components/marketing-blocks";
import { PAID_PLANS } from "@/lib/plans";
import { whopUrl } from "@/lib/whop-checkout";

// Keep in line with the commission settings on the Whop product; Whop is
// what actually tracks and pays, this page only summarises it.
const RATE = 0.3;
const MONTHS = 12;

const TERMS = [
  { value: "30%", label: "of every payment a referred customer makes" },
  { value: "12 months", label: "of commission per customer you refer" },
  { value: "Whop", label: "tracks referrals and pays you out" },
];

const gbp = (n: number) => `£${n.toFixed(2)}`;

export default function AffiliatesPage() {
  const programme = whopUrl(process.env.WHOP_AFFILIATE_URL);
  return (
    <>
      <Nav />
      <PageHero eyebrow={<><Handshake className="h-3.5 w-3.5" /> Fortify affiliates</>} title="Introduce founders to Fortify.">
        Share your Whop referral link and earn 30% of what each customer pays for their first 12 months.
        <div className="mt-8 flex justify-center">
          {programme ? (
            <a href={programme} className="btn-primary">View the programme on Whop</a>
          ) : (
            <p className="rounded-full border border-bg-border bg-bg-panel/70 px-4 py-1.5 text-xs text-text-muted">
              Enrolment opens once checkout and attribution are verified.
            </p>
          )}
        </div>
      </PageHero>

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="py-16 sm:py-20">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {TERMS.map((t) => (
              <div key={t.value} className="card-elevated p-5 text-center">
                <p className="text-3xl font-bold tracking-tight">{t.value}</p>
                <p className="mt-1 text-sm text-text-muted">{t.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-bg-border py-16 sm:py-20">
          <SectionHeading title="What one referral is worth">
            Per customer, if they stay on the same plan for the full {MONTHS} months.
          </SectionHeading>
          <div className="card mx-auto max-w-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-bg-border">
                  <th className="px-4 py-3 text-left font-medium text-text-muted">Plan</th>
                  <th className="px-4 py-3 text-right font-medium text-text-muted">You earn / month</th>
                  <th className="px-4 py-3 text-right font-medium text-text-muted">Over {MONTHS} months</th>
                </tr>
              </thead>
              <tbody>
                {PAID_PLANS.map((p) => {
                  const monthly = Number(p.price.replace("£", "")) * RATE;
                  return (
                    <tr key={p.key} className="border-t border-bg-border/60">
                      <td className="px-4 py-3 text-text">
                        {p.name} <span className="text-text-dim">· {p.price}/mo</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-text">{gbp(monthly)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-text-muted">{gbp(monthly * MONTHS)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="border-t border-bg-border py-16 sm:py-20">
          <SectionHeading title="How it works" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <NumberedStep n={1} title="Join on Whop">
              Find Fortify in Whop&rsquo;s Affiliates section and read the programme terms.
            </NumberedStep>
            <NumberedStep n={2} title="Copy your link">
              Use View assets to copy your personal Whop referral link.
            </NumberedStep>
            <NumberedStep n={3} title="Share that exact link">
              Not fortify-io.com or the pricing page. Only your Whop link is tracked.
            </NumberedStep>
            <NumberedStep n={4} title="Buyers connect Whop">
              After paying, they <Link href="/whop" className="text-text underline underline-offset-4">connect Whop to Fortify</Link> to
              switch their tier on.
            </NumberedStep>
            <NumberedStep n={5} title="Get paid by Whop">
              Track referrals, eligible commissions and payouts in Whop, on Whop&rsquo;s payout schedule.
            </NumberedStep>
          </div>
        </section>

        <section className="border-t border-bg-border py-16 sm:py-20">
          <div className="card mx-auto flex max-w-3xl gap-3 p-6">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
            <p className="text-sm leading-relaxed text-text-muted">
              <span className="font-medium text-text">Only Whop checkouts count.</span> A customer who pays through
              PayPal, or reaches checkout from a link that isn&rsquo;t yours, isn&rsquo;t attributed to you. The full
              programme terms on Whop take precedence over this summary.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
