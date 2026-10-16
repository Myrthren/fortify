"use client";

import { useState } from "react";
import { PayPalButton } from "@/components/paypal-button";

// One primary way to subscribe per tier. Whop is the main checkout when it is
// configured (it is also what affiliate attribution runs on); PayPal stays
// available behind a secondary toggle so the card is not a stack of buttons.
// The PayPal SDK only mounts once the toggle is opened.
//
// PayPal activation (/api/paypal/activate) attaches the subscription to the
// signed-in account, so a signed-out visitor is sent to sign in first —
// otherwise they could pay and end up with no tier.
const SIGN_IN_FOR_PAYPAL = "/login?next=/pricing";

export function CheckoutOptions({
  tier,
  whopUrl,
  planId,
  highlight,
  signedIn,
}: {
  tier: "pro" | "elite" | "apex";
  whopUrl: string | null;
  planId: string | undefined;
  highlight?: boolean;
  signedIn: boolean;
}) {
  const [showPayPal, setShowPayPal] = useState(false);
  const primary = highlight ? "btn-primary w-full" : "btn-secondary w-full";

  if (!whopUrl) {
    if (!planId) return <p className="text-center text-xs text-text-muted">Checkout is temporarily unavailable.</p>;
    return signedIn ? (
      <PayPalButton planId={planId} tier={tier} />
    ) : (
      <a href={SIGN_IN_FOR_PAYPAL} className={primary}>Sign in to subscribe</a>
    );
  }

  return (
    <div className="space-y-2">
      <a href={whopUrl} className={primary}>
        Subscribe with Whop
      </a>
      <p className="text-center text-[11px] leading-snug text-text-dim">
        Then connect Whop in Settings to activate.
      </p>
      {planId && (
        showPayPal ? (
          <PayPalButton planId={planId} tier={tier} />
        ) : signedIn ? (
          <button
            type="button"
            onClick={() => setShowPayPal(true)}
            className="block w-full text-center text-xs text-text-muted underline-offset-4 transition hover:text-text hover:underline"
          >
            Pay with PayPal instead — activates instantly
          </button>
        ) : (
          <a
            href={SIGN_IN_FOR_PAYPAL}
            className="block w-full text-center text-xs text-text-muted underline-offset-4 transition hover:text-text hover:underline"
          >
            Pay with PayPal instead — sign in first
          </a>
        )
      )}
    </div>
  );
}
