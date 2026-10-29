"use client";

import { useState } from "react";
import { isSiteTheme, type SiteTheme } from "@/lib/site-theme";
import { isWorkspaceLayout, type WorkspaceLayout } from "@/lib/workspace-layout";

const OPTIONS = [
  { value: "original", label: "Classic", description: "Inter Tight headings, layered monochrome panels and a focused workspace." },
  { value: "scifi", label: "Sci-fi", description: "Chakra Petch headings, the dot globe and sharper monochrome panels." },
] as const;

const WORKSPACE_OPTIONS = [
  { value: "classic", label: "Classic workspace", description: "The familiar header and dashboard flow already used across Fortify." },
  { value: "command-centre", label: "Command Centre", description: "A persistent sidebar, a central next action and a live Business Pulse rail." },
] as const;

export function AdminSiteAppearance({ initialTheme, initialWorkspaceLayout }: { initialTheme: SiteTheme; initialWorkspaceLayout: WorkspaceLayout }) {
  const [selected, setSelected] = useState(initialTheme);
  const [saved, setSaved] = useState(initialTheme);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedWorkspaceLayout, setSelectedWorkspaceLayout] = useState(initialWorkspaceLayout);
  const [savedWorkspaceLayout, setSavedWorkspaceLayout] = useState(initialWorkspaceLayout);
  const [layoutBusy, setLayoutBusy] = useState(false);
  const [layoutMessage, setLayoutMessage] = useState("");
  const [layoutError, setLayoutError] = useState("");

  async function save() {
    setBusy(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/admin/site-theme", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: selected }),
      });
      const data = await response.json();
      if (!response.ok || !isSiteTheme(data.theme)) throw new Error(data.error || "Could not save the site theme.");
      setSaved(data.theme);
      window.dispatchEvent(new CustomEvent("fortify-theme-saved", { detail: data.theme }));
      setMessage("Saved for everyone. Open pages update within 30 seconds or when revisited.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Please try again.");
    } finally { setBusy(false); }
  }

  async function saveWorkspaceLayout() {
    setLayoutBusy(true); setLayoutMessage(""); setLayoutError("");
    try {
      const response = await fetch("/api/admin/workspace-layout", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceLayout: selectedWorkspaceLayout }),
      });
      const data = await response.json();
      if (!response.ok || !isWorkspaceLayout(data.workspaceLayout)) throw new Error(data.error || "Could not save the workspace layout.");
      setSavedWorkspaceLayout(data.workspaceLayout);
      window.dispatchEvent(new CustomEvent("fortify-workspace-layout-saved", { detail: data.workspaceLayout }));
      setLayoutMessage("Saved for everyone. Open dashboard pages update within 30 seconds or when revisited.");
    } catch (err) {
      setLayoutError(err instanceof Error ? err.message : "Could not save. Please try again.");
    } finally { setLayoutBusy(false); }
  }

  return <div className="card p-5">
    <fieldset disabled={busy}>
      <legend className="text-sm font-medium">Universal site theme</legend>
      <p className="mt-1 text-xs text-text-muted">Applies to the public site, dashboard and admin panel for every visitor.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {OPTIONS.map(option => <label key={option.value} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${selected === option.value ? "border-white/60 bg-white/[0.06]" : "border-bg-border"}`}>
          <input type="radio" name="site-theme" value={option.value} checked={selected === option.value}
            onChange={() => { setSelected(option.value); setMessage(""); setError(""); }} className="mt-1 accent-white" />
          <span><span className="block text-sm font-medium">{option.label}{saved === option.value && <span className="ml-2 text-xs text-text-muted">Active</span>}</span><span className="mt-1 block text-xs leading-relaxed text-text-muted">{option.description}</span></span>
        </label>)}
      </div>
    </fieldset>
    <div className="mt-4 flex items-center gap-3"><button type="button" className="btn-primary" onClick={save} disabled={busy || selected === saved}>{busy ? "Saving…" : "Apply site theme"}</button><span className="text-xs text-text-muted">Changes affect everyone.</span></div>
    {message && <p role="status" className="mt-3 text-sm text-text-muted">{message}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    <div className="mt-8 border-t border-bg-border pt-6">
      <fieldset disabled={layoutBusy}>
        <legend className="text-sm font-medium">Universal workspace layout</legend>
        <p className="mt-1 text-xs text-text-muted">Applies to every member dashboard. Mobile navigation stays compact in both modes.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {WORKSPACE_OPTIONS.map(option => <label key={option.value} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${selectedWorkspaceLayout === option.value ? "border-white/60 bg-white/[0.06]" : "border-bg-border"}`}>
            <input type="radio" name="workspace-layout" value={option.value} checked={selectedWorkspaceLayout === option.value}
              onChange={() => { setSelectedWorkspaceLayout(option.value); setLayoutMessage(""); setLayoutError(""); }} className="mt-1 accent-white" />
            <span><span className="block text-sm font-medium">{option.label}{savedWorkspaceLayout === option.value && <span className="ml-2 text-xs text-text-muted">Active</span>}</span><span className="mt-1 block text-xs leading-relaxed text-text-muted">{option.description}</span></span>
          </label>)}
        </div>
      </fieldset>
      <div className="mt-4 flex items-center gap-3"><button type="button" className="btn-primary" onClick={saveWorkspaceLayout} disabled={layoutBusy || selectedWorkspaceLayout === savedWorkspaceLayout}>{layoutBusy ? "Saving…" : "Apply workspace layout"}</button><span className="text-xs text-text-muted">Changes affect everyone.</span></div>
      {layoutMessage && <p role="status" className="mt-3 text-sm text-text-muted">{layoutMessage}</p>}
      {layoutError && <p role="alert" className="mt-3 text-sm text-red-300">{layoutError}</p>}
    </div>
  </div>;
}
