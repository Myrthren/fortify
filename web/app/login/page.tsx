import Link from "next/link";
import { Logo } from "@/components/logo";
import { ChevronLeft } from "lucide-react";
import { LoginButton } from "@/components/login-button";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="px-6 py-6">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text">
          <ChevronLeft className="h-4 w-4" /> Home
        </Link>
      </div>

      <div className="mx-auto flex max-w-sm flex-col items-center px-6 pt-20 pb-32 text-center">
        <Logo size={44} />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Welcome to Fortify</h1>
        <p className="mt-2 text-sm text-text-muted">
          Log in with Discord to continue.
        </p>

        <div className="mt-8 w-full">
          <LoginButton />
        </div>

        <p className="mt-8 text-xs text-text-muted">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline hover:text-text">Terms</Link> and{" "}
          <Link href="/privacy" className="underline hover:text-text">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
