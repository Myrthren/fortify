import Link from "next/link";

export default function BannedPage() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="text-5xl mb-6">🚫</div>
        <h1 className="text-2xl font-bold tracking-tight mb-3">Account suspended</h1>
        <p className="text-text-muted text-sm leading-relaxed mb-6">
          Your account has been suspended from Fortify. If you believe this is a mistake or
          would like to appeal, please contact us at{" "}
          <a href="mailto:support@fortify-io.com" className="text-text underline underline-offset-2">
            support@fortify-io.com
          </a>
          .
        </p>
        <Link href="/dashboard" className="btn-secondary text-sm">
          ← Back to dashboard
        </Link>
      </div>
    </div>
  );
}
