"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "fortify-cookie-consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      // Private browsing or localStorage unavailable — don't show
    }
  }, []);

  function accept() {
    try { localStorage.setItem(STORAGE_KEY, "accepted"); } catch {}
    setVisible(false);
  }

  function decline() {
    try { localStorage.setItem(STORAGE_KEY, "declined"); } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.08] bg-[#0a0a0a]/95 backdrop-blur-sm px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-text-muted">
          We use cookies to keep you signed in and improve your experience.{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-text transition">
            Privacy policy
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={decline}
            className="rounded-md border border-white/10 px-4 py-1.5 text-sm text-text-muted transition hover:border-white/20 hover:text-text"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="rounded-md bg-white px-4 py-1.5 text-sm font-medium text-bg transition hover:bg-white/90"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
