import Link from "next/link";
import { ArrowRight, Bot, Gem } from "lucide-react";
import type { Tier } from "@prisma/client";

const PLANS = [
  { name: "Pro", price: "£29/mo", line: "500 credits, Brand Voice, lead extraction" },
  { name: "Elite", price: "£79/mo", line: "Unlimited outreach, Recon, Workflows" },
  { name: "Apex", price: "£199/mo", line: "No limits, AI Advisor, Mastermind Pods" },
];

const COMMANDS = ["/hook", "/outreach", "/audit", "/trends", "/competitors", "/profile", "/upgrade"];

// Dashboard home: the upgrade path for Free accounts and how to use the
// Discord bot, which every tier gets but nothing else explains.
export function GettingStarted({ tier }: { tier: Tier }) {
  const invite = process.env.NEXT_PUBLIC_DISCORD_INVITE;
  const free = tier === "FREE";

  return (
    <div className={`anim-fade-up anim-d1 mb-6 grid gap-3 ${free ? "lg:grid-cols-2" : ""}`}>
      {free && (
        <div className="bento flex flex-col p-5">
          <div className="mb-3 flex items-center gap-2 text-text-muted">
            <Gem className="h-4 w-4" />
            <h2 className="text-sm font-semibold text-text">Upgrade when you&rsquo;re ready</h2>
          </div>
          <ul className="flex-1 space-y-2 text-sm">
            {PLANS.map((p) => (
              <li key={p.name} className="flex items-baseline justify-between gap-3">
                <span><span className="font-medium text-text">{p.name}</span> <span className="text-text-muted">· {p.line}</span></span>
                <span className="shrink-0 tabular-nums text-text-muted">{p.price}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-text-dim">
            Pay with Whop or PayPal on the pricing page. PayPal activates instantly; after a Whop purchase, connect
            Whop in Settings.
          </p>
          <Link href="/pricing" className="btn-primary mt-4 self-start">
            See plans <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      <div className="bento p-5">
        <div className="mb-3 flex items-center gap-2 text-text-muted">
          <Bot className="h-4 w-4" />
          <h2 className="text-sm font-semibold text-text">Use Fortify in Discord</h2>
        </div>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-text-muted">
          <li>
            Join the Fortify Discord server with the Discord account you signed in with.
            {invite && <> <a href={invite} className="text-text underline underline-offset-4">Join the server</a>.</>}
          </li>
          <li>
            {free
              ? "Paid plans get their role there automatically."
              : "Your plan's role is added automatically. Missing? Use Refresh access in Settings."}
          </li>
          <li>
            Type <span className="font-mono text-text">/</span> in any channel to see the bot&rsquo;s commands:{" "}
            <span className="font-mono text-xs text-text">{COMMANDS.join(" ")}</span>
          </li>
          <li>Mention @Fortify to ask it anything. Alerts and reports arrive by DM, so allow DMs from server members.</li>
        </ol>
      </div>
    </div>
  );
}
