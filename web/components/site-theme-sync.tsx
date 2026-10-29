"use client";

import { useEffect } from "react";
import { isSiteTheme, type SiteTheme } from "@/lib/site-theme";
import { isWorkspaceLayout, type WorkspaceLayout } from "@/lib/workspace-layout";

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
        if (!disposed && !request.signal.aborted) {
          if (isSiteTheme(data.theme)) document.documentElement.dataset.theme = data.theme;
          if (isWorkspaceLayout(data.workspaceLayout)) document.documentElement.dataset.workspaceLayout = data.workspaceLayout;
        }
      } catch { /* Keep the last applied theme while offline. */ }
    };
    const onWorkspaceLayoutSaved = (event: Event) => {
      const workspaceLayout = (event as CustomEvent<WorkspaceLayout>).detail;
      if (!isWorkspaceLayout(workspaceLayout)) return;
      pending?.abort();
      document.documentElement.dataset.workspaceLayout = workspaceLayout;
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
    window.addEventListener("fortify-workspace-layout-saved", onWorkspaceLayoutSaved);
    return () => {
      disposed = true;
      pending?.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("fortify-theme-saved", onSaved);
      window.removeEventListener("fortify-workspace-layout-saved", onWorkspaceLayoutSaved);
    };
  }, []);
  return null;
}
