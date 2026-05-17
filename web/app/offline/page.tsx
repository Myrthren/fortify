export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl text-4xl"
          style={{ background: "linear-gradient(145deg,#111,#1c1c1c)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          📡
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">You're offline</h1>
        <p className="text-text-muted text-sm mb-6 leading-relaxed">
          No internet connection. Reconnect and refresh to get back into Fortify.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
