"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";

export default function WorkflowsConfirmPage() {
  const params   = useSearchParams();
  const router   = useRouter();
  const orderId  = params.get("token");     // PayPal passes ?token=ORDER_ID
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [units,  setUnits]  = useState(0);
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    if (!orderId) { setStatus("error"); setErrMsg("No order ID found."); return; }

    fetch("/api/workflows/capacity/capture-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) { setUnits(d.units); setStatus("success"); }
        else { setErrMsg(d.error ?? "Something went wrong."); setStatus("error"); }
      })
      .catch(() => { setErrMsg("Network error."); setStatus("error"); });
  }, [orderId]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="card-elevated w-full max-w-sm p-8 text-center">
        {status === "loading" && (
          <>
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-text-muted" />
            <p className="text-sm text-text-muted">Processing your purchase…</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-green-400" />
            <h2 className="text-xl font-bold mb-2">Capacity added!</h2>
            <p className="text-text-muted text-sm mb-6">
              {units.toLocaleString()} workflow capacity units have been added to your account.
            </p>
            <Link href="/dashboard/workflows" className="btn-primary w-full justify-center">
              Back to Workflows
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="mx-auto mb-4 h-10 w-10 text-red-400" />
            <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
            <p className="text-text-muted text-sm mb-6">{errMsg}</p>
            <Link href="/dashboard/workflows" className="btn-secondary w-full justify-center">
              Back to Workflows
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
