import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { SupportForm } from "@/components/support-form";
import { CopyButton } from "@/components/copy-button";

const FAQS = [
  {
    q: "I paid but didn't get my Discord role",
    a: "Make sure you're in the Fortune Fortress Discord server. The bot assigns roles automatically after payment — if it doesn't appear within a few minutes, open a ticket with your Discord ID.",
  },
  {
    q: "I can't log in",
    a: "Make sure you're authorising with the correct Discord account. Clear your browser cache and try again. If the problem persists, send us a message above.",
  },
  {
    q: "A bot command returned an error",
    a: "Include the exact command you used and the error message when contacting us. Most errors are resolved within minutes.",
  },
  {
    q: "I want to cancel my subscription",
    a: "Go to your PayPal account and cancel the billing agreement. Your access remains active until the end of the current billing period.",
  },
  {
    q: "My AI generation count isn't resetting",
    a: "Daily limits reset at midnight UTC. If you're on a paid plan and hitting limits unexpectedly, open a ticket.",
  },
];

export default async function SupportPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: (session.user as any).id },
    select: { email: true, tier: true, discordId: true },
  });
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-bg">
      <DashboardNav user={user} active="support" />

      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-widest text-text-muted">Help</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Support</h1>
          <p className="mt-2 text-text-muted">
            Get help with your subscription, access, or anything else.
          </p>
        </div>

        {/* Send a message */}
        <section className="mb-6 rounded-xl border border-bg-border bg-bg-panel p-6">
          <h2 className="mb-1 text-base font-semibold">Send a Message</h2>
          <p className="mb-5 text-sm text-text-muted leading-relaxed">
            Fill in the form and your message will be delivered directly to the owner via Discord.
            We typically respond within a few hours.
          </p>
          <SupportForm />
        </section>

        {/* Direct contact */}
        <section className="mb-6 rounded-xl border border-bg-border bg-bg-panel p-6">
          <h2 className="mb-4 text-base font-semibold">Direct Contact</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-text-muted">Discord</p>
              <p className="mt-0.5 font-mono text-sm">keneamaechina</p>
            </div>
            <CopyButton text="keneamaechina" />
          </div>
        </section>

        {/* Common issues */}
        <section className="rounded-xl border border-bg-border bg-bg-panel p-6">
          <h2 className="mb-4 text-base font-semibold">Common Issues</h2>
          <div className="flex flex-col divide-y divide-bg-border">
            {FAQS.map((faq) => (
              <div key={faq.q} className="py-4 first:pt-0 last:pb-0">
                <p className="text-sm font-medium">{faq.q}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
