"use client";

import { useState } from "react";
import { Unplug } from "lucide-react";

export function GoogleConnectSection({
  connected,
  gaPropertyName,
  scSiteUrl,
}: {
  connected: boolean;
  gaPropertyName: string | null;
  scSiteUrl: string | null;
}) {
  const [disconnecting, setDisconnecting] = useState(false);

  async function disconnect() {
    if (!confirm("Disconnect your Google account? This will remove Analytics, Search Console, and YouTube data.")) return;
    setDisconnecting(true);
    await fetch("/api/google/disconnect", { method: "POST" });
    window.location.reload();
  }

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
        Google
      </h2>
      <div className="card divide-y divide-bg-border">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-sm font-medium">Google account</p>
            {connected ? (
              <div className="mt-0.5 space-y-0.5">
                <p className="text-xs text-text-muted">Unreleased — existing connection retained but data access is disabled.</p>
                {gaPropertyName && (
                  <p className="text-xs text-text-muted">· GA4: {gaPropertyName}</p>
                )}
                {scSiteUrl && (
                  <p className="text-xs text-text-muted">· Search Console: {scSiteUrl}</p>
                )}
              </div>
            ) : (
              <p className="mt-0.5 text-xs text-text-muted">
                GA4, Search Console, and YouTube — pending Google app verification.
              </p>
            )}
          </div>
          {connected ? (
            <div className="flex gap-2">
              <button
                onClick={disconnect}
                disabled={disconnecting}
                className="btn-secondary text-xs flex items-center gap-1.5"
              >
                <Unplug className="h-3.5 w-3.5" />
                Disconnect
              </button>
            </div>
          ) : (
            <span className="rounded-md bg-white/[0.06] px-2 py-1 text-xs text-text-muted">
              Unreleased
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
