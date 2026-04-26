import Link from "next/link";
import { Logo } from "@/components/logo";
import { ChevronLeft } from "lucide-react";
import { LoginButton } from "@/components/login-button";

export default function LoginPage() {
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

      <div className="relative mx-auto flex max-w-sm flex-col items-center px-6 pt-12 pb-32 text-center sm:pt-20">
        <Logo size={48} />

        <h1 className="mt-8 text-3xl font-bold tracking-tight">
          Welcome to Fortify
        </h1>
        <p className="mt-3 text-sm text-text-muted">
          Log in with Discord to continue.
        </p>

        <div className="mt-10 w-full">
          <LoginButton />
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
