import Link from "next/link";
import { Logo } from "./logo";

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-bg-border bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Logo withWord />
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/pricing" className="btn-ghost">Pricing</Link>
          <Link href="/login" className="btn-ghost">Log in</Link>
          <Link href="/login" className="btn-primary">Get started</Link>
        </nav>
      </div>
    </header>
  );
}
