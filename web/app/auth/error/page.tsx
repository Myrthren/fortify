import Link from "next/link";
import { Logo } from "@/components/logo";

const ERROR_MESSAGES: Record<string, { title: string; body: string }> = {
  Configuration: {
    title: "Server configuration error",
    body: "Something is misconfigured on our end. Try again — if it persists, contact support.",
  },
  AccessDenied: {
    title: "Access denied",
    body: "You don't have permission to sign in. Contact support if you believe this is a mistake.",
  },
  Verification: {
    title: "Sign-in link expired",
    body: "The sign-in link is no longer valid. Try logging in again.",
  },
  Default: {
    title: "Something went wrong",
    body: "We hit an unexpected error signing you in. Try again.",
  },
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const meta = ERROR_MESSAGES[error ?? "Default"] ?? ERROR_MESSAGES.Default;

  return (
    <div className="min-h-screen bg-bg">
      <div className="px-6 py-6">
        <Link href="/" className="text-sm text-text-muted hover:text-text">
          ← Home
        </Link>
      </div>

      <div className="mx-auto flex max-w-md flex-col items-center px-6 pt-20 text-center">
        <Logo size={44} />
        <h1 className="mt-8 text-2xl font-bold tracking-tight">{meta.title}</h1>
        <p className="mt-3 text-sm text-text-muted">{meta.body}</p>
        {error && (
          <p className="mt-4 font-mono text-xs text-text-muted">code: {error}</p>
        )}
        <div className="mt-8 flex gap-3">
          <Link href="/login" className="btn-primary">
            Try again
          </Link>
          <Link href="/" className="btn-secondary">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
