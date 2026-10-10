import Link from "next/link";
import { Logo } from "./logo";
import { whopUrl } from "@/lib/whop-checkout";

export function Footer() {
  // Only link to pages that lead somewhere: the affiliate page is a dead end
  // until enrolment opens, and there is no Discord link without an invite.
  const affiliatesOpen = !!whopUrl(process.env.WHOP_AFFILIATE_URL);
  const discordInvite = process.env.NEXT_PUBLIC_DISCORD_INVITE;

  return (
    <footer className="mt-32 border-t border-bg-border">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-6 py-12 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="text-sm text-text-muted">© {new Date().getFullYear()} Fortify</span>
        </div>
        <nav className="flex flex-wrap gap-6 text-sm text-text-muted">
          <Link href="/pricing" className="hover:text-text">Pricing</Link>
          {affiliatesOpen && <Link href="/affiliates" className="hover:text-text">Affiliates</Link>}
          <Link href="/terms" className="hover:text-text">Terms</Link>
          <Link href="/privacy" className="hover:text-text">Privacy</Link>
          {discordInvite && <a href={discordInvite} className="hover:text-text">Discord</a>}
        </nav>
      </div>
    </footer>
  );
}
