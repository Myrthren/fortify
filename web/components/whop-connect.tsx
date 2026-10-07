"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Unplug, RefreshCw, Loader2 } from "lucide-react";

export function WhopConnectSection({
  connected,
  whopUserId,
}: {
  connected: boolean;
  whopUserId: string | null;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("whop") === "connected") setNotice("Whop is connected. Your membership has been checked.");
    if (query.get("whop") === "linked_no_membership") setNotice("Whop is connected, but no active Fortify membership was found. Check you used the purchasing account, then re-sync your tier.");
    if (query.has("error")) setNotice("Whop could not connect. Please try again or contact support.");
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"sync" | "disconnect" | null>(null);

  async function request(action: "sync" | "disconnect") {
    setError(null);
    setBusy(action);
    try {
      const res = await fetch(`/api/whop/${action === "sync" ? "resync" : "disconnect"}`, { method: "POST" });
      if (!res.ok) throw new Error("Whop request failed. Please try again.");
      const result = await res.json();
      if (action === "sync" && result.membershipId && result.effectiveTier !== result.tier) {
        setError("Your Whop membership is linked, but PayPal manages access on this account. Contact support before buying another subscription.");
        return;
      }
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function resync() { await request("sync"); }

  async function disconnect() {
    if (!confirm("Disconnect Whop? Whop-provided Fortify access will be removed immediately. This does not cancel Whop billing; cancel your subscription on Whop separately.")) return;
    await request("disconnect");
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
        <p className="px-5 pb-4 text-xs text-text-muted">
          Use the same Whop account you purchased with. Manage or cancel Whop billing on{" "}
          <a href="https://whop.com/orders/" className="underline">Whop</a>.
        </p>
        {notice && <p role="status" className="px-5 pb-4 text-sm text-text-muted">{notice}</p>}
        {error && <p role="alert" className="px-5 pb-4 text-sm text-red-400">{error}</p>}
      </div>
    </section>
  );
}
