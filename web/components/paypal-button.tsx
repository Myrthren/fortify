"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    paypal?: any;
  }
}

let sdkPromise: Promise<void> | null = null;

function loadPayPalSdk() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.paypal) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&vault=true&intent=subscription`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("PayPal SDK failed to load"));
    document.body.appendChild(script);
  });

  return sdkPromise;
}

export function PayPalButton({
  planId,
  tier,
}: {
  planId: string;
  tier: "pro" | "elite" | "apex";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">("idle");

  useEffect(() => {
    let mounted = true;
    loadPayPalSdk().then(() => {
      if (!mounted || !ref.current || !window.paypal) return;
      ref.current.innerHTML = "";

      window.paypal
        .Buttons({
          style: { shape: "rect", color: "white", layout: "vertical", label: "subscribe" },
          createSubscription: (_: any, actions: any) =>
            actions.subscription.create({ plan_id: planId }),
          onApprove: async (data: any) => {
            setStatus("processing");
            try {
              const res = await fetch("/api/paypal/activate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ subscriptionID: data.subscriptionID, tier }),
              });
              if (!res.ok) throw new Error(await res.text());
              setStatus("done");
              window.location.href = "/dashboard?welcome=1";
            } catch (e) {
              console.error(e);
              setStatus("error");
            }
          },
          onError: () => setStatus("error"),
        })
        .render(ref.current);
    });
    return () => {
      mounted = false;
    };
  }, [planId, tier]);

  return (
    <div className="space-y-2">
      <div ref={ref} className="min-h-[44px]" />
      {status === "processing" && (
        <p className="text-xs text-text-muted">Activating your subscription…</p>
      )}
      {status === "error" && (
        <p className="text-xs text-red-400">Something went wrong. Try again or contact support.</p>
      )}
    </div>
  );
}
