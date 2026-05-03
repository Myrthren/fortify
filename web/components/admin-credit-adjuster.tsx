"use client";

import { useState } from "react";
import { Loader2, Plus, Minus } from "lucide-react";

type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  credits: number;
};

export function AdminCreditAdjuster({ users: initial }: { users: UserRow[] }) {
  const [users, setUsers]   = useState<UserRow[]>(initial);
  const [selected, setSelected] = useState<string>(initial[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [note, setNote]     = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [msg, setMsg]       = useState<{ ok: boolean; text: string } | null>(null);

  const selectedUser = users.find((u) => u.id === selected);

  async function submit(sign: 1 | -1) {
    const n = parseInt(amount, 10);
    if (!n || n <= 0) { setMsg({ ok: false, text: "Enter a positive number" }); return; }
    setStatus("loading");
    setMsg(null);
    const res = await fetch("/api/admin/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selected, amount: sign * n, note: note.trim() || undefined }),
    });
    const data = await res.json();
    setStatus("idle");
    if (!res.ok) {
      setMsg({ ok: false, text: data.error ?? "Failed" });
    } else {
      setMsg({ ok: true, text: `Done — new balance: ${data.newBalance.toLocaleString()} credits` });
      setUsers((prev) =>
        prev.map((u) => (u.id === selected ? { ...u, credits: data.newBalance } : u))
      );
      setAmount("");
      setNote("");
    }
  }

  return (
    <div className="space-y-4">
      {/* User select */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          className="input flex-1"
          value={selected}
          onChange={(e) => { setSelected(e.target.value); setMsg(null); }}
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name ?? u.email ?? u.id} — {u.credits.toLocaleString()} credits
            </option>
          ))}
        </select>
        {selectedUser && (
          <span className="flex items-center rounded-md border border-bg-border bg-bg-panel px-3 py-2 text-sm tabular-nums text-text-muted whitespace-nowrap">
            {selectedUser.credits.toLocaleString()} credits
          </span>
        )}
      </div>

      {/* Amount + note */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="input w-36"
          placeholder="Amount"
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input
          className="input flex-1"
          placeholder="Note (optional)"
          value={note}
          maxLength={80}
          onChange={(e) => setNote(e.target.value)}
        />
        <button
          onClick={() => submit(1)}
          disabled={status === "loading"}
          className="btn-primary gap-1.5 text-sm"
        >
          {status === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Add
        </button>
        <button
          onClick={() => submit(-1)}
          disabled={status === "loading"}
          className="btn-secondary gap-1.5 text-sm"
        >
          {status === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Minus className="h-3.5 w-3.5" />}
          Deduct
        </button>
      </div>

      {msg && (
        <p className={`text-sm ${msg.ok ? "text-green-400" : "text-red-400"}`}>{msg.text}</p>
      )}
    </div>
  );
}
