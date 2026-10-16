import Link from "next/link";
import { ArrowRight, CreditCard, Link2, ShoppingBag } from "lucide-react";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { PlanCard } from "@/components/plan-card";
import { NumberedStep, PageHero, SectionHeading } from "@/components/marketing-blocks";
import { PAID_PLANS } from "@/lib/plans";
import { whopCheckoutUrls } from "@/lib/whop-checkout";

export default function WhopPage() {
  const urls = whopCheckoutUrls();
  return (
    <>
      <Nav />
      <PageHero eyebrow={<><ShoppingBag className="h-3.5 w-3.5" /> Fortify on Whop</>} title="Buy on Whop. Connect once. You're in.">
        Pay through Whop, then link that Whop account to Fortify from Settings. Your tier and Discord role switch on
        as soon as the two are connected.
      </PageHero>

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="py-16 sm:py-20">
          <SectionHeading title="Choose your plan">
            Monthly, in GBP. Referred by an affiliate? Use their Whop link instead of these buttons so they get credit.
          </SectionHeading>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-3">
            {PAID_PLANS.map((plan, i) => (
              <PlanCard key={plan.key} plan={plan} previous={PAID_PLANS[i - 1]?.name}>
                {urls[plan.key] ? (
                  <a href={urls[plan.key]!} className={plan.highlight ? "btn-primary w-full" : "btn-secondary w-full"}>
                    Buy {plan.name} on Whop
                  </a>
                ) : (
                  <p className="text-center text-xs text-text-muted">Whop checkout is being prepared.</p>
                )}
              </PlanCard>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-text-muted">
            <Link href="/pricing#compare" className="underline-offset-4 hover:text-text hover:underline">
              Compare every feature <ArrowRight className="inline h-3.5 w-3.5" />
            </Link>
          </p>
        </section>

        <section className="border-t border-bg-border py-16 sm:py-20">
          <SectionHeading title="After you pay">Four steps, about two minutes.</SectionHeading>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <NumberedStep n={1} title="Buy on Whop">
              Pick a plan above. Already paying through PayPal? Contact support before buying a second subscription.
            </NumberedStep>
            <NumberedStep n={2} title="Sign in to Fortify">
              <Link href="/login" className="text-text underline underline-offset-4">Sign in with Discord</Link>. The
              same button creates your account if you&rsquo;re new.
            </NumberedStep>
            <NumberedStep n={3} title="Connect Whop">
              Open <Link href="/dashboard/settings" className="text-text underline underline-offset-4">Settings</Link>,
              choose Connect Whop and sign in with the Whop account you paid with.
            </NumberedStep>
            <NumberedStep n={4} title="Your tier switches on">
              Access and your Discord role update on connection. If you&rsquo;ve only just paid, choose Re-sync tier in
              Settings.
            </NumberedStep>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 border-t border-bg-border py-16 sm:py-20 md:grid-cols-2">
          <div className="card p-6">
            <div className="mb-2 flex items-center gap-2 text-text-muted">
              <CreditCard className="h-4 w-4" />
              <h2 className="text-sm font-semibold text-text">Prefer PayPal?</h2>
            </div>
            <p className="text-sm leading-relaxed text-text-muted">
              Subscribe from the <Link href="/pricing" className="text-text underline underline-offset-4">pricing page</Link> while
              signed in. PayPal activates your tier straight away, with nothing to connect.
            </p>
          </div>
          <div className="card p-6">
            <div className="mb-2 flex items-center gap-2 text-text-muted">
              <Link2 className="h-4 w-4" />
              <h2 className="text-sm font-semibold text-text">Managing your membership</h2>
            </div>
            <p className="text-sm leading-relaxed text-text-muted">
              Renewals and cancellation happen in your{" "}
              <a href="https://whop.com/orders/" className="text-text underline underline-offset-4">Whop orders</a>.
              Disconnecting Whop in Fortify removes access immediately but does not cancel Whop billing.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
