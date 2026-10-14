"use client";
import { useEffect, useState } from "react";
export function ClientContextPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { let mounted = true; fetch("/api/clients").then(async response => { if (!response.ok) throw new Error("Client contexts could not be loaded"); return response.json(); }).then(body => { if (mounted) setClients(body.clients || []); }).catch(failure => { if (mounted) setError(failure.message); }); return () => { mounted = false; }; }, []);
  return <div className="space-y-1 text-xs"><label className="text-text-muted">Business context
    <select className="input mt-1" value={value} onChange={event => onChange(event.target.value)}>
      <option value="">My business — Company DNA</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
    </select></label><a className="underline text-text-muted" href="/dashboard/clients">Manage private client contexts</a>{error && <p className="text-red-300">{error}</p>}
  </div>;
}
