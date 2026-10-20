"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookmarkPlus, Loader2 } from "lucide-react";
import type { LeadInput } from "@/lib/pipeline";
import { responseError } from "@/lib/response-error";

export function SavePipelineLead({ lead }: { lead: LeadInput }) {
  const [id, setId] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function save() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/pipeline", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lead) });
      if (!response.ok) throw new Error(await responseError(response));
      setId((await response.json()).lead.id);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <span className="pipeline-save-action">{id ? <Link href={`/dashboard/pipeline?lead=${encodeURIComponent(id)}`} className="btn-ghost text-xs">Saved · Open pipeline <ArrowUpRight size={13}/></Link> : <button type="button" onClick={save} disabled={busy} className="btn-ghost text-xs">{busy ? <Loader2 size={13} className="animate-spin"/> : <BookmarkPlus size={13}/>} {busy ? "Saving…" : "Save to pipeline"}</button>}{error && <span role="alert" className="workspace-error">{error}</span>}</span>;
}
