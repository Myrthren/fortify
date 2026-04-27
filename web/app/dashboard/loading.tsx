import { Loader2 } from "lucide-react";
import { Logo } from "@/components/logo";

// Renders instantly during server-component navigation while the
// real page is still streaming. Keeps the user out of "is it broken?" land.
export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-bg">
      {/* Nav skeleton — matches DashboardNav height to prevent layout shift */}
      <header className="border-b border-bg-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo withWord />
          <div className="flex items-center gap-2">
            <div className="h-5 w-16 animate-pulse rounded-md bg-bg-elevated" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8 space-y-3">
          <div className="h-8 w-48 animate-pulse rounded-md bg-bg-elevated" />
          <div className="h-4 w-72 animate-pulse rounded-md bg-bg-elevated/60" />
        </div>

        <div className="card flex items-center justify-center p-12">
          <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
        </div>
      </main>
    </div>
  );
}
