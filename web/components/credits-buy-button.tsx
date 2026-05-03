"use client";

import { useState } from "react";

export function CreditsBuyButton({
  packId,
  price,
  credits,
}: {
  packId: string;
  price: string;
  credits: number;
}) {
  const [status, setStatus] = useState<"idle" | "loading">("idle");

  async function handleBuy() {
    setStatus("loading");
    try {
      const res = await fetch("/api/paypal/credits/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      if (!res.ok) throw new Error("Failed to create order");
      const { approveUrl } = await res.json();
      window.location.href = approveUrl;
    } catch {
      setStatus("idle");
      alert("Something went wrong. Please try again.");
    }
  }

  return (
    <button
      onClick={handleBuy}
      disabled={status === "loading"}
      className="mt-auto w-full rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-bg transition hover:bg-white/90 disabled:opacity-60"
    >
      {status === "loading" ? "Redirecting…" : `Buy for £${price}`}
    </button>
  );
}
