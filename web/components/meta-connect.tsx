"use client";

import { useState } from "react";
import { CheckCircle, Unplug } from "lucide-react";

export function MetaConnectSection({
  connected,
  accountName,
}: {
  connected: boolean;
  accountName: string | null;
}) {
  const [disconnecting, setDisconnecting] = useState(false);

  async function disconnect() {
    if (!confirm("Disconnect your Meta Ads account?")) return;
    setDisconnecting(true);
    await fetch("/api/meta/disconnect", { method: "POST" });
    window.location.reload();
  }

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
        Meta Ads
      </h2>
      <div className="card divide-y divide-bg-border">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-sm font-medium">Meta Ads account</p>
            {connected ? (
              <p className="mt-0.5 text-xs text-text-muted flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-400" />
                Connected{accountName ? ` — ${accountName}` : ""}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-text-muted">
                Connect to see real campaign performance in the{" "}
                <a href="/dashboard/ads" className="underline">Ads dashboard</a>.
              </p>
            )}
          </div>
          {connected ? (
            <button
              onClick={disconnect}
              disabled={disconnecting}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <Unplug className="h-3.5 w-3.5" />
              Disconnect
            </button>
          ) : (
            <a href="/api/meta/connect" className="btn-primary text-sm">
              Connect
            </a>
          )}
        </div>
        {!connected && (
          <div className="px-5 py-3">
            <p className="text-xs text-text-muted">
              Requires{" "}
              <a
                href="https://developers.facebook.com/apps/941646295368966/review-status"
                target="_blank"
                rel="noreferrer noopener"
                className="underline"
              >
                Meta app review
              </a>{" "}
              for accounts other than the developer account. Currently in review.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
