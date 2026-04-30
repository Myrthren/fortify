"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function DealForm() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("HIRING");
  const [budget, setBudget] = useState("");
  const [link, setLink] = useState("");
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, type, budget: budget || undefined, link: link || undefined }),
    });
    setLoading(false);
    if (res.ok) {
      setOpen(false);
      setTitle(""); setDescription(""); setBudget(""); setLink("");
      router.refresh();
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary text-sm">
        Post a deal
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card w-full max-w-md p-5">
      <h3 className="mb-4 font-semibold">Post a deal</h3>
      <div className="space-y-3">
        <input
          className="input w-full"
          placeholder="Title (max 100 chars)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          required
        />
        <textarea
          className="input w-full resize-none"
          rows={4}
          placeholder="Description (max 1000 chars)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
          required
        />
        <select className="input w-full" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="HIRING">Hiring</option>
          <option value="COLLAB">Collab</option>
          <option value="OPPORTUNITY">Opportunity</option>
        </select>
        <input className="input w-full" placeholder="Budget (optional)" value={budget} onChange={(e) => setBudget(e.target.value)} />
        <input className="input w-full" placeholder="Link (optional)" value={link} onChange={(e) => setLink(e.target.value)} />
        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="btn-primary flex-1 text-sm">
            {loading ? "Posting…" : "Post"}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1 text-sm">
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
