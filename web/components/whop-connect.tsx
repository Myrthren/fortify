"use client";

import { useState } from "react";
import { CheckCircle, Unplug, RefreshCw, Loader2 } from "lucide-react";

export function WhopConnectSection({
  connected,
  whopUserId,
}: {
  connected: boolean;
  whopUserId: string | null;
}) {
  const [busy, setBusy] = useState<"sync" | "disconnect" | null>(null);

  async function resync() {
    setBusy("sync");
    await fetch("/api/whop/resync", { method: "POST" });
    window.location.reload();
  }

  async function disconnect() {
    if (!confirm("Disconnect Whop? Your tier will stay as-is until it next syncs.")) return;
    setBusy("disconnect");
    await fetch("/api/whop/disconnect", { method: "POST" });
    window.location.reload();
  }

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
        Whop
      </h2>
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-sm font-medium">Whop account</p>
            {connected ? (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-text-muted">
                <CheckCircle className="h-3 w-3" />
                Connected{whopUserId ? ` — ${whopUserId}` : ""}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-text-muted">
                Bought Fortify on Whop? Connect your account to apply your tier automatically.
              </p>
            )}
          </div>

          {connected ? (
            <div className="flex items-center gap-2">
              <button
                onClick={resync}
                disabled={busy !== null}
                className="btn-secondary flex items-center gap-1.5 text-xs"
              >
                {busy === "sync" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Re-sync tier
              </button>
              <button
                onClick={disconnect}
                disabled={busy !== null}
                className="btn-secondary flex items-center gap-1.5 text-xs"
              >
                <Unplug className="h-3.5 w-3.5" />
                Disconnect
              </button>
            </div>
          ) : (
            <a href="/api/whop/connect" className="btn-secondary text-xs">
              Connect Whop
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
