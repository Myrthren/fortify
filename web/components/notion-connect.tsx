"use client";

import { useState, useEffect } from "react";
import { CheckCircle, Unplug, FileText, Loader2, ChevronDown } from "lucide-react";

type NotionPage = { id: string; title: string };

export function NotionConnectSection({
  connected,
  workspaceName,
  rootPageId,
}: {
  connected: boolean;
  workspaceName: string | null;
  rootPageId: string | null;
}) {
  const [disconnecting, setDisconnecting] = useState(false);
  const [pages, setPages] = useState<NotionPage[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [selectedPage, setSelectedPage] = useState(rootPageId ?? "");
  const [savingPage, setSavingPage] = useState(false);
  const [pagesSaved, setPagesSaved] = useState(false);

  useEffect(() => {
    if (connected) loadPages();
  }, [connected]); // eslint-disable-line

  async function loadPages() {
    setLoadingPages(true);
    try {
      const res = await fetch("/api/notion/pages");
      const data = await res.json();
      setPages(data.pages ?? []);
    } catch {}
    finally { setLoadingPages(false); }
  }

  async function saveRootPage(id: string) {
    setSelectedPage(id);
    setSavingPage(true);
    await fetch("/api/notion/pages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rootPageId: id }),
    });
    setSavingPage(false);
    setPagesSaved(true);
    setTimeout(() => setPagesSaved(false), 2000);
  }

  async function disconnect() {
    if (!confirm("Disconnect Notion?")) return;
    setDisconnecting(true);
    await fetch("/api/notion/disconnect", { method: "POST" });
    window.location.reload();
  }

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
        Notion
      </h2>
      <div className="card divide-y divide-bg-border">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-sm font-medium">Notion workspace</p>
            {connected ? (
              <p className="mt-0.5 text-xs text-text-muted flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-400" />
                {workspaceName ? `Connected — ${workspaceName}` : "Connected"}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-text-muted">
                Export competitor reports, content ideas, and virality analyses to Notion.
              </p>
            )}
          </div>
          {connected ? (
            <button onClick={disconnect} disabled={disconnecting} className="btn-secondary text-xs flex items-center gap-1.5">
              <Unplug className="h-3.5 w-3.5" />
              Disconnect
            </button>
          ) : (
            <span className="rounded-md bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-text-muted">
              Coming soon
            </span>
          )}
        </div>

        {connected && (
          <div className="px-5 py-4 space-y-2">
            <label className="block text-xs text-text-muted mb-1">
              Export destination page
            </label>
            {loadingPages ? (
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading pages…
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <select
                    value={selectedPage}
                    onChange={(e) => saveRootPage(e.target.value)}
                    className="input w-full appearance-none pr-8"
                    disabled={savingPage}
                  >
                    <option value="">— Select a page —</option>
                    {pages.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
                </div>
                {savingPage && <Loader2 className="h-3.5 w-3.5 animate-spin text-text-muted shrink-0" />}
                {pagesSaved && <span className="text-xs text-green-400 shrink-0">Saved</span>}
              </div>
            )}
            <p className="text-xs text-text-muted">
              Fortify will create subpages inside this page when you export.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
