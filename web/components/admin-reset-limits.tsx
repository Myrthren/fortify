"use client";
import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

export function AdminResetLimits({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function reset() {
    if (!confirm("Reset all usage limits and restore 99,999 credits for your account?")) return;
    setLoading(true);
    setDone(false);
    try {
      const res = await fetch("/api/admin/reset-limits", { method: "POST" });
      if (res.ok) setDone(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={reset}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-medium text-green-300 hover:bg-green-500/20 transition disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        Reset all my limits
      </button>
      {done && <span className="text-xs text-green-400">✓ Limits cleared, 99,999 credits restored</span>}
    </div>
  );
}
