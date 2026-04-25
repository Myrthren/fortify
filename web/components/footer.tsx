import Link from "next/link";
import { Logo } from "./logo";

export function Footer() {
  return (
    <footer className="mt-32 border-t border-bg-border">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-6 py-12 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="text-sm text-text-muted">© {new Date().getFullYear()} Fortify</span>
        </div>
        <nav className="flex flex-wrap gap-6 text-sm text-text-muted">
          <Link href="/pricing" className="hover:text-text">Pricing</Link>
          <Link href="/terms" className="hover:text-text">Terms</Link>
          <Link href="/privacy" className="hover:text-text">Privacy</Link>
          <Link href="https://discord.gg/" className="hover:text-text">Discord</Link>
        </nav>
      </div>
    </footer>
  );
}
