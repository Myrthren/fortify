import { Plus } from "lucide-react";

// Shared by the landing page and /pricing so the two never disagree.
// Keep billing answers in line with the PayPal and Whop webhooks: a PayPal
// cancellation keeps the tier until the paid month ends (cron/paypal-expire).
export const FAQ: { q: string; a: string }[] = [
  {
    q: "How often does Competitor Watch check pages?",
    a: "Active watches check readable public web pages daily at 07:00 UTC while you have enough credits. You can also scan manually. Alerts include added and removed wording; they are not real-time social-feed monitoring. Pages that require login or JavaScript may be unreadable. A scan that produces no usable page result does not spend credits.",
  },
  {
    q: "What do I get on the free plan?",
    a: "100 starter credits, 10 outreach messages a month, 5 Trend Radar topics, the Story Forge (script editor) and the community — forums, member directory and deal board. No card needed. The Free plan is how you try Fortify; there is no separate free trial of paid plans.",
  },
  {
    q: "How do I pay, and can I cancel?",
    a: "Plans are monthly in GBP: Pro £29, Elite £79, Apex £199. Pay through Whop or PayPal — both unlock the same tier and Discord roles. Cancel any time with the provider you paid through. With PayPal, you keep your plan until the end of the month you've paid for; with Whop, access follows your Whop membership.",
  },
  {
    q: "Do you offer refunds?",
    a: "No. Payments are non-refundable, including partial months and unused credits, so start on Free and upgrade once you know you'll use it. Billing problems such as a duplicate charge go to support@fortify-io.com.",
  },
  {
    q: "What are credits for?",
    a: "Credits pay for the heavier jobs that call outside data sources — lead searches (50), Lead Extractor profiles (20 each), Recon searches (from 50), and competitor scans (35–50). Everyday writing tools such as hooks, outreach and audits use their own monthly allowances instead. Paid plans add credits on the 1st of each month and unused credits roll over; they never expire. Top-up packs start at 800 credits for £8.99.",
  },
  {
    q: "Do PayPal and Whop purchases work the same way?",
    a: "Both grant the same tier. PayPal checkout runs on the pricing page while you're signed in and activates your tier immediately — no extra step. A Whop purchase needs one step afterwards: connect your Whop account in Settings (see /whop) so Fortify can match the membership to you.",
  },
  {
    q: "How does the Discord side work?",
    a: "Fortify's bot lives in the Fortify Discord server. Join it with the same Discord account you sign in with, and your paid tier's role is granted automatically. Then use slash commands such as /hook, /outreach, /trends and /audit, mention @Fortify to ask questions, and receive alerts and reports by DM.",
  },
  {
    q: "Does it actually write in my voice?",
    a: "Yes. Brand Voice Studio learns from samples of your own writing, and Company DNA gives every tool the context about your business, offer and audience — so outputs are specific, not generic.",
  },
  {
    q: "Who is Fortify for?",
    a: "Solo founders, agencies, freelancers and community owners who do their own outreach, content and research — and would rather run one subscription than five.",
  },
];

export function FaqSection({ id = "faq" }: { id?: string }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-bg-border">
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-24">
        <h2 className="mb-8 text-center text-3xl font-bold tracking-tight sm:text-4xl">Questions</h2>
        <div className="space-y-2">
          {FAQ.map((f) => (
            <details key={f.q} className="faq card group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {f.q}
                <Plus className="h-4 w-4 shrink-0 text-text-muted transition-transform duration-200 group-open:rotate-45" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
