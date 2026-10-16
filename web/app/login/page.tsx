import Link from "next/link";
import { Logo } from "@/components/logo";
import { Check, ChevronLeft } from "lucide-react";
import { LoginButton } from "@/components/login-button";
import { CREDITS_FREE_START } from "@/lib/credit-costs";

const AFTER_SIGN_IN = [
  `You start on the Free plan with ${CREDITS_FREE_START} starter credits. No card needed.`,
  "Upgrade from Pricing whenever you like: Pro £29, Elite £79 or Apex £199 a month.",
  "Paid plans get their role in the Fortify Discord server automatically.",
];

// Only same-site paths, so ?next= cannot bounce someone to another domain.
function safeNext(next: string | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg">
      <div className="bg-spotlight absolute inset-x-0 top-0 h-[600px]" />

      <div className="relative px-6 py-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-text-muted transition hover:text-text"
        >
          <ChevronLeft className="h-4 w-4" /> Home
        </Link>
      </div>

      <div className="relative mx-auto flex max-w-md flex-col items-center px-6 pt-8 pb-32 text-center sm:pt-14">
        <Logo size={48} />

        <h1 className="mt-8 text-3xl font-bold tracking-tight">
          Sign up or log in
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-text-muted">
          Fortify is an AI co-pilot for online business: it finds leads, writes outreach in your
          brand voice, watches your competitors, tracks trends with Trend Radar and runs your
          repeat work as workflows.
        </p>

        <div className="mt-8 w-full">
          <LoginButton callbackUrl={safeNext(next)} />
          <p className="mt-3 text-xs text-text-dim">
            Discord is the only way to sign in. New here? The same button creates your account.
          </p>
        </div>

        <div className="card mt-8 w-full p-5 text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-dim">After you sign in</p>
          <ul className="mt-3 space-y-2.5 text-sm">
            {AFTER_SIGN_IN.map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-text" />
                <span className="text-text-muted">{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-10 text-xs text-text-dim">
          By continuing you agree to our{" "}
          <Link href="/terms" className="text-text-muted underline-offset-4 hover:text-text hover:underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-text-muted underline-offset-4 hover:text-text hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
