"use client";
import { useEffect, useState } from "react";
type Client = { id: string; name: string; entries: { content: string }[]; brandVoiceId: string | null };
export function ClientContextManager() {
  const [clients, setClients] = useState<Client[]>([]), [voices, setVoices] = useState<{ id: string; name: string }[]>([]);
  const [editing, setEditing] = useState(""), [name, setName] = useState(""), [context, setContext] = useState(""), [voice, setVoice] = useState("");
  const [error, setError] = useState(""), [pending, setPending] = useState(false);
  async function refresh() { const response = await fetch("/api/clients"); const body = await response.json(); if (!response.ok) throw new Error(body.error || "Client contexts unavailable"); setClients(body.clients); setVoices(body.voices); }
  useEffect(() => { refresh().catch(failure => setError(failure.message)); }, []);
  function clear() { setEditing(""); setName(""); setContext(""); setVoice(""); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setPending(true); setError("");
    try { const response = await fetch("/api/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing || undefined, name, context, brandVoiceId: voice || null }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Could not save client context"); clear(); await refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Save failed"); } finally { setPending(false); }
  }
  async function remove(id: string) {
    if (!confirm("Delete this private client context? Linked watches and workflows must be removed first.")) return;
    setError(""); setPending(true);
    try { const response = await fetch("/api/clients", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error || "Delete failed"); if (editing === id) clear(); await refresh(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Delete failed"); } finally { setPending(false); }
  }
  return <div className="space-y-6"><p className="text-sm text-text-muted">Private to your account. Each context has its own business facts and chosen voice. Selecting a client never falls back to your personal Company DNA. These contexts do not invite team members or grant access to another account.</p>
    <form onSubmit={save} className="card p-5 space-y-3"><h2>{editing ? "Edit client context" : "Add client context"}</h2>
      <input aria-label="Client name" className="input" placeholder="Client name" value={name} maxLength={100} onChange={event => setName(event.target.value)} required />
      <textarea aria-label="Client business context" className="input min-h-40" placeholder="Audience, offer, constraints and approved claims for this client" value={context} onChange={event => setContext(event.target.value)} required />
      <select aria-label="Client brand voice" className="input" value={voice} onChange={event => setVoice(event.target.value)}><option value="">No brand voice</option>{voices.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save context"}</button>{editing && <button type="button" className="btn-ghost" onClick={clear}>Cancel edit</button>}
    </form>{error && <p className="text-red-300">{error}</p>}
    {clients.map(client => <div key={client.id} className="card p-4 flex items-center justify-between"><span>{client.name}</span><div>
      <button className="btn-ghost" disabled={pending} onClick={() => { setEditing(client.id); setName(client.name); setContext(client.entries.map(entry => entry.content).join("\n")); setVoice(client.brandVoiceId || ""); }}>Edit</button>
      <button className="btn-ghost text-red-300" disabled={pending} onClick={() => remove(client.id)}>Delete</button></div></div>)}
  </div>;
}
