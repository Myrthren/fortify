"use client";
import { useState } from "react";
import type { ContactResult } from "@/lib/contact-verification";

export function ContactChecker({ email, onChecked }: { email: string; onChecked?: (result: ContactResult) => void }) {
  const [result, setResult] = useState<ContactResult | null>(null);
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  async function check() {
    setPending(true); setError("");
    try {
      const response = await fetch("/api/leads/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emails: [email] }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Address check failed");
      const checked = body.results?.[0] as ContactResult | undefined;
      if (!checked) throw new Error("No verification result");
      setResult(checked); onChecked?.(checked);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Address check failed"); }
    finally { setPending(false); }
  }
  return <div className="space-y-1 text-xs">
    <button type="button" onClick={check} disabled={pending} className="btn-ghost text-xs">{pending ? "Checking address…" : "Check address"}</button>
    {result ? <p className={result.status === "deliverable" ? "text-green-400" : result.status === "invalid" || result.status === "restricted" ? "text-red-300" : "text-amber-300"}>
      {result.status === "deliverable" ? "Provider-checked mailbox" : result.status === "domain_only" ? "Domain only; mailbox unverified" : result.status.replaceAll("_", " ")} · {result.reason}
    </p> : <p className="text-text-dim">Found address; individual mailbox not checked.</p>}
    {error && <p className="text-red-300">{error}</p>}
  </div>;
}
