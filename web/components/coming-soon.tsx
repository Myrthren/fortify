import { Clock } from "lucide-react";
import { DashboardNav } from "@/components/dashboard-nav";
import type { Tier } from "@prisma/client";

// Monochrome "coming soon" lock — used to hard-gate features that are built but
// not yet available to users (missing integration setup / pending API approval).
// Unlike LockedPage (a tier gate with an upgrade CTA), this signals "in development".

export function ComingSoonCard({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
      <div
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-bg-border"
        style={{ background: "linear-gradient(135deg,#141416,#0d0d0f)" }}
      >
        <Clock className="h-7 w-7 text-text-muted" />
      </div>
      <span className="eyebrow mb-2">In development</span>
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      {description && (
        <p className="mt-2 max-w-md text-sm text-text-muted leading-relaxed">{description}</p>
      )}
      <span className="mt-5 rounded-md bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-text-muted">
        Coming soon
      </span>
    </div>
  );
}

export function ComingSoonPage({
  user,
  active,
  title,
  description,
}: {
  user: {
    email: string | null;
    username?: string | null;
    tier: Tier;
    discordId: string | null;
    credits?: number;
  };
  active: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="min-h-screen">
      <DashboardNav user={user} active={active as any} />
      <main className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <ComingSoonCard title={title} description={description} />
      </main>
    </div>
  );
}
