"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Check, Loader2, Plus, RefreshCw } from "lucide-react";
import { responseError } from "@/lib/response-error";

type BusinessOption = { id: string; name: string; industry: string; active: boolean };
export function BusinessSwitcher({ tier }: { tier: string }) {
  const router = useRouter(), root = useRef<HTMLElement>(null), flight = useRef(false), switching = useRef(false);
  const [businesses, setBusinesses] = useState<BusinessOption[]>([]), [limit, setLimit] = useState<number | null>(0), [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [pendingId, setPendingId] = useState<string | null>(null), [error, setError] = useState("");
  async function load() {
    if (flight.current || switching.current || tier === "FREE") return;
    flight.current = true; setBusy(true); setError("");
    try {
      const response = await fetch("/api/businesses", { cache: "no-store" });
      if (!response.ok) throw new Error(await responseError(response));
      const data = await response.json(); setBusinesses(data.businesses); setLimit(data.limit); setLoaded(true);
    } catch { setError("Businesses could not load. Try again."); }
    finally { flight.current = false; setBusy(false); }
  }
  useEffect(() => {
    const onOpen = () => {
      const panel = root.current?.closest<HTMLElement>(".workspace-disclosure-panel");
      if ((panel && !panel.hidden) || root.current?.closest(".command-business")) void load();
    };
    window.addEventListener("fortify:navigation-open", onOpen);
    window.addEventListener("fortify:businesses-changed", onOpen);
    if (root.current?.closest(".command-business")) void load();
    return () => { window.removeEventListener("fortify:navigation-open", onOpen); window.removeEventListener("fortify:businesses-changed", onOpen); };
  }, [tier]);
  async function activate(business: BusinessOption) {
    if (business.active || switching.current || busy) return;
    switching.current = true; setPendingId(business.id); setError("");
    try {
      const response = await fetch("/api/businesses", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: business.id }) });
      if (!response.ok) throw new Error(await responseError(response));
      setBusinesses(current => current.map(item => ({ ...item, active: item.id === business.id })));
      window.dispatchEvent(new CustomEvent("fortify:business-changed", { detail: { id: business.id, name: business.name } }));
      router.refresh();
    } catch (cause) { setError((cause as Error).message); }
    finally { switching.current = false; setPendingId(null); }
  }
  const overLimit = limit !== null && businesses.length > limit, atLimit = limit !== null && businesses.length >= limit;
  return <section ref={root} className="workspace-business-switcher" aria-label="Business context" aria-busy={busy || !!pendingId}>
    <div className="workspace-business-heading"><h2>Business</h2>{loaded && <span>{businesses.length} / {limit === null ? "Unlimited" : limit}</span>}</div>
    {tier === "FREE" ? <><p>Set up a business on Pro or above.</p><Link href="/dashboard/setup" className="workspace-business-add"><Plus size={14}/> Set up a business</Link></> : <>
      {busy && !loaded && <p role="status"><Loader2 size={13} className="workspace-business-spinner"/> Loading businesses…</p>}
      {loaded && !businesses.length && <p>No business set up yet.</p>}
      <ul>{businesses.map(business => <li key={business.id}><button type="button" onClick={() => void activate(business)} aria-pressed={business.active} disabled={busy || !!pendingId || (overLimit && !business.active)}><Building2 size={15}/><span><strong>{business.name}</strong><small>{business.active ? "Active business" : business.industry}</small></span>{pendingId === business.id ? <Loader2 size={14} className="workspace-business-spinner"/> : business.active ? <Check size={15}/> : null}</button></li>)}</ul>
      {error && <div className="workspace-business-error" role="alert"><p>{error}</p><button type="button" onClick={() => void load()} disabled={busy || !!pendingId}><RefreshCw size={12}/> Retry</button></div>}
      {overLimit && <p>Remove saved businesses to fit your current plan before switching.</p>}
      {loaded && <Link href={atLimit ? "/dashboard/setup" : "/dashboard/setup?new=1"} className="workspace-business-add"><Plus size={14}/>{atLimit ? "Manage business capacity" : "Set up a new business"}</Link>}
      {loaded && businesses.length > 0 && !atLimit && <Link href="/dashboard/setup" className="workspace-business-manage">Manage businesses</Link>}
    </>}
    <span className="workspace-business-announcement" role="status">{pendingId ? "Switching business…" : loaded ? `${businesses.find(item => item.active)?.name ?? "Personal workspace"} selected` : ""}</span>
  </section>;
}
