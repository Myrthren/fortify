import { ClassicPublicNav } from "./classic-public-nav";
import Link from "next/link";
import { Logo } from "./logo";

export function Nav() {
  // .btn-ghost sets its own display, which beats Tailwind's `hidden`, so the
  // breakpoint visibility lives on a wrapper rather than on the link itself.
  return (
    <>
    <div className="theme-original-only"><ClassicPublicNav /></div>
    <div className="theme-scifi-only"><header className="sticky top-0 z-40 border-b border-bg-border bg-bg/80 backdrop-blur">
      <div className="mx-auto command-nav flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo withWord />
        <nav className="flex items-center gap-1 text-sm">
          <span className="hidden md:contents">
            <Link href="/#features" className="btn-ghost">Features</Link>
            <Link href="/#faq" className="btn-ghost">FAQ</Link>
          </span>
          <Link href="/pricing" className="btn-ghost">Pricing</Link>
          <span className="hidden sm:contents">
            <Link href="/login" className="btn-ghost">Log in</Link>
          </span>
          <Link href="/login" className="btn-primary">Get started</Link>
        </nav>
      </div>
    </header></div>
    </>
  );
}
