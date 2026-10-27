export function WorkspaceLoading({ shell = false, label = "workspace" }: { shell?: boolean; label?: string }) {
  return <div className="workspace-loading" role="status" aria-label={`Loading ${label}`} aria-busy="true">
    {shell && <div className="workspace-loading-header" aria-hidden="true" />}
    <main className="workspace-loading-main">
      <p>Loading {label}…</p>
      <div className="workspace-skeleton workspace-skeleton-title" aria-hidden="true" />
      <div className="workspace-skeleton workspace-skeleton-description" aria-hidden="true" />
      <div className="workspace-skeleton workspace-skeleton-content" aria-hidden="true" />
    </main>
  </div>;
}
