"use client";

import { useEffect } from "react";
import { isSiteTheme, type SiteTheme } from "@/lib/site-theme";

export function SiteThemeSync() {
  useEffect(() => {
    let pending: AbortController | undefined;
    let disposed = false;
    const sync = async () => {
      if (document.visibilityState === "hidden") return;
      pending?.abort();
      const request = new AbortController();
      pending = request;
      try {
        const response = await fetch("/api/site-theme", { cache: "no-store", signal: request.signal });
        if (!response.ok) return;
        const data = await response.json();
        if (!disposed && !request.signal.aborted && isSiteTheme(data.theme)) {
          document.documentElement.dataset.theme = data.theme;
        }
      } catch { /* Keep the last applied theme while offline. */ }
    };
    const onSaved = (event: Event) => {
      const theme = (event as CustomEvent<SiteTheme>).detail;
      if (!isSiteTheme(theme)) return;
      pending?.abort();
      document.documentElement.dataset.theme = theme;
    };
    void sync();
    const interval = window.setInterval(sync, 30_000);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("fortify-theme-saved", onSaved);
    return () => {
      disposed = true;
      pending?.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("fortify-theme-saved", onSaved);
    };
  }, []);
  return null;
}
