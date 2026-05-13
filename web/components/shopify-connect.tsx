"use client";

import { useState } from "react";
import { CheckCircle, Unplug, Loader2 } from "lucide-react";

export function ShopifyConnectSection({ connected, shop }: { connected: boolean; shop: string | null }) {
  const [shopInput, setShopInput] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/shopify/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop: shopInput, accessToken: tokenInput }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed"); return; }
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect Shopify?")) return;
    setDisconnecting(true);
    await fetch("/api/shopify/disconnect", { method: "POST" });
    window.location.reload();
  }

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
        Shopify
      </h2>
      <div className="card divide-y divide-bg-border">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-sm font-medium">Shopify store</p>
            {connected ? (
              <p className="mt-0.5 text-xs text-text-muted flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-400" />
                Connected{shop ? ` — ${shop}` : ""}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-text-muted">
                Connect to see revenue, orders, and top products.
              </p>
            )}
          </div>
          {connected ? (
            <button onClick={disconnect} disabled={disconnecting} className="btn-secondary text-xs flex items-center gap-1.5">
              <Unplug className="h-3.5 w-3.5" />
              Disconnect
            </button>
          ) : null}
        </div>

        {!connected && (
          <div className="px-5 py-4 space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-text-muted mb-1">Shop domain</label>
                <input
                  className="input w-full"
                  placeholder="mystore.myshopify.com"
                  value={shopInput}
                  onChange={(e) => setShopInput(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Admin API access token</label>
                <input
                  className="input w-full"
                  placeholder="shpat_..."
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
            {error && (
              <p className="text-xs text-red-300">{error}</p>
            )}
            <div className="flex items-center justify-between">
              <a
                href="https://help.shopify.com/en/manual/apps/app-types/custom-apps"
                target="_blank"
                rel="noreferrer noopener"
                className="text-xs text-text-muted underline underline-offset-2"
              >
                How to get an access token →
              </a>
              <button onClick={connect} disabled={saving || !shopInput || !tokenInput} className="btn-primary text-sm">
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
