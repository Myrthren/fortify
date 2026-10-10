"use client";

import { useState } from "react";
import { PayPalButton } from "@/components/paypal-button";

// One primary way to subscribe per tier. Whop is the main checkout when it is
// configured (it is also what affiliate attribution runs on); PayPal stays
// available behind a secondary toggle so the card is not a stack of buttons.
// The PayPal SDK only mounts once the toggle is opened.
export function CheckoutOptions({
  tier,
  whopUrl,
  planId,
  highlight,
}: {
  tier: "pro" | "elite" | "apex";
  whopUrl: string | null;
  planId: string | undefined;
  highlight?: boolean;
}) {
  const [showPayPal, setShowPayPal] = useState(false);
  const primary = highlight ? "btn-primary w-full" : "btn-secondary w-full";

  if (!whopUrl) {
    return planId ? (
      <PayPalButton planId={planId} tier={tier} />
    ) : (
      <p className="text-center text-xs text-text-muted">Checkout is temporarily unavailable.</p>
    );
  }

  return (
    <div className="space-y-2">
      <a href={whopUrl} className={primary}>
        Subscribe
      </a>
      {planId && (
        showPayPal ? (
          <PayPalButton planId={planId} tier={tier} />
        ) : (
          <button
            type="button"
            onClick={() => setShowPayPal(true)}
            className="block w-full text-center text-xs text-text-muted underline-offset-4 transition hover:text-text hover:underline"
          >
            Prefer PayPal?
          </button>
        )
      )}
    </div>
  );
}
