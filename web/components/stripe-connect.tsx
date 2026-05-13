"use client";

import { useState } from "react";
import { CheckCircle, Unplug, Loader2 } from "lucide-react";

export function StripeConnectSection({ connected }: { connected: boolean }) {
  const [keyInput, setKeyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: keyInput }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed"); return; }
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect Stripe?")) return;
    setDisconnecting(true);
    await fetch("/api/stripe/disconnect", { method: "POST" });
    window.location.reload();
  }

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
        Stripe
      </h2>
      <div className="card divide-y divide-bg-border">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-sm font-medium">Stripe account</p>
            {connected ? (
              <p className="mt-0.5 text-xs text-text-muted flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-400" />
                Connected
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-text-muted">
                Connect to see MRR, revenue, and subscriber stats.
              </p>
            )}
          </div>
          {connected && (
            <button onClick={disconnect} disabled={disconnecting} className="btn-secondary text-xs flex items-center gap-1.5">
              <Unplug className="h-3.5 w-3.5" />
              Disconnect
            </button>
          )}
        </div>

        {!connected && (
          <div className="px-5 py-4 space-y-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">
                Restricted API key{" "}
                <span className="text-text-dim">(read-only: balance, charges, customers, subscriptions)</span>
              </label>
              <input
                className="input w-full font-mono text-xs"
                placeholder="sk_live_... or rk_live_..."
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                disabled={saving}
              />
            </div>
            {error && <p className="text-xs text-red-300">{error}</p>}
            <div className="flex items-center justify-between">
              <a
                href="https://dashboard.stripe.com/apikeys/create"
                target="_blank"
                rel="noreferrer noopener"
                className="text-xs text-text-muted underline underline-offset-2"
              >
                Create a restricted key in Stripe →
              </a>
              <button onClick={connect} disabled={saving || !keyInput} className="btn-primary text-sm">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Connect
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
