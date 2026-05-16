"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Paperclip, X, ShoppingCart } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; hasFile?: boolean };

type Usage = {
  tier: string;
  canUse: boolean;
  isApex: boolean;
  pct: number;
  sessionExhausted: boolean;
  expiresAt: string;
  packRemainingGbp: number;
  hasPackCredits: boolean;
};

const PACKS = [
  { id: 1, label: "Starter Pack", price: "£4.99", est: "~40 minutes of use", value: "£2 credit" },
  { id: 2, label: "Standard Pack", price: "£9.99", est: "~1.5 hours of use", value: "£5 credit" },
  { id: 3, label: "Power Pack", price: "£24.99", est: "~5 hours of use", value: "£15 credit" },
];

export function FortifyAI() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [showPacks, setShowPacks] = useState(false);
  const [buyingPack, setBuyingPack] = useState<number | null>(null);
  const [btnHovered, setBtnHovered] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && !usage) fetchUsage();
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fetchUsage() {
    const r = await fetch("/api/ai/chat/usage");
    const d = await r.json();
    setUsage(d);
  }

  async function send() {
    if (!input.trim() && !file) return;
    if (usage?.sessionExhausted && !usage.hasPackCredits) { setShowPacks(true); return; }

    const userMsg: Msg = { role: "user", content: input, hasFile: !!file };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      let res: Response;
      const history = messages.map((m) => ({ role: m.role, content: m.content }));

      if (file) {
        const fd = new FormData();
        fd.append("message", input);
        fd.append("history", JSON.stringify(history));
        fd.append("file", file);
        res = await fetch("/api/ai/chat", { method: "POST", body: fd });
        setFile(null);
      } else {
        res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...history, { role: "user", content: input }],
          }),
        });
      }

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        if (d.error === "SESSION_LIMIT_REACHED") { setShowPacks(true); }
        else { setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${d.error ?? "Something went wrong."}` }]); }
        return;
      }

      const d = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: d.message }]);
      fetchUsage();
    } finally {
      setSending(false);
    }
  }

  async function buyPack(pack: number) {
    setBuyingPack(pack);
    await fetch("/api/ai/chat/buy-pack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pack }),
    });
    await fetchUsage();
    setBuyingPack(null);
    setShowPacks(false);
  }

  function getTimeUntilReset() {
    if (!usage?.expiresAt) return "";
    const diff = new Date(usage.expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Resetting soon";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `Resets in ${h}h ${m}m`;
  }

  const barColor = (pct: number) => pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-400" : "bg-green-500";

  return (
    <>
      <style>{`
        @keyframes fortifyBtnGlow {
          0%, 100% {
            box-shadow: 0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.12);
          }
          50% {
            box-shadow: 0 4px 24px rgba(0,0,0,0.5), 0 0 0 2px rgba(255,255,255,0.55), 0 0 20px rgba(255,255,255,0.12);
          }
        }
        @keyframes fortifyTextGlow {
          0%, 100% { text-shadow: none; }
          50% { text-shadow: 0 0 10px rgba(255,255,255,0.95), 0 0 20px rgba(255,255,255,0.4); }
        }
        .fortify-btn-hovered {
          animation: fortifyBtnGlow 1.6s ease infinite !important;
        }
        .fortify-btn-hovered .fortify-btn-text {
          animation: fortifyTextGlow 1.6s ease infinite;
        }
      `}</style>

      {/* Floating button — hidden while panel is open */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          onMouseEnter={() => setBtnHovered(true)}
          onMouseLeave={() => setBtnHovered(false)}
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-transform hover:scale-105 ${btnHovered ? "fortify-btn-hovered" : ""}`}
          style={{
            background: "linear-gradient(135deg, #0a0a0a 0%, #1e1e1e 50%, #111111 100%)",
            color: "#ffffff",
            border: "1px solid rgba(255,255,255,0.14)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
          }}
        >
          <span className="fortify-btn-text">✦</span>
          <span className="fortify-btn-text">Fortify AI</span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:p-6 pointer-events-none">
          <div className="pointer-events-auto flex flex-col w-full max-w-md h-[600px] rounded-2xl border border-bg-border bg-bg shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-bg-border bg-bg-panel">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Fortify AI</span>
                {usage?.tier && usage.tier !== "FREE" && !usage.isApex && (
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-bg-elevated">
                      <div className={`h-full rounded-full ${barColor(usage.pct)}`} style={{ width: `${usage.pct}%` }} />
                    </div>
                    <span className="text-[10px] text-text-muted">{usage.pct}%</span>
                  </div>
                )}
                {usage?.sessionExhausted && !usage.hasPackCredits && (
                  <span className="text-[10px] text-amber-300">{getTimeUntilReset()}</span>
                )}
              </div>
              <button onClick={() => setOpen(false)} className="text-text-muted hover:text-text">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-lg font-semibold mb-1">Hey, I&apos;m Fortify AI.</p>
                  <p className="text-sm text-text-muted">Ask me anything about your business or how to use Fortify.</p>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-white/10 text-text"
                      : "bg-bg-panel border border-bg-border text-text"
                  }`}>
                    {m.hasFile && <p className="text-[10px] text-text-muted mb-1">📎 File attached</p>}
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-bg-panel border border-bg-border rounded-2xl px-4 py-2.5">
                    <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Limit reached */}
            {usage?.sessionExhausted && !usage.hasPackCredits && (
              <div className="px-4 py-3 border-t border-bg-border bg-bg-panel text-center">
                <p className="text-xs text-text-muted mb-2">{getTimeUntilReset()} · Or buy extra usage</p>
                <button onClick={() => setShowPacks(true)} className="btn-primary text-xs">
                  <ShoppingCart className="h-3.5 w-3.5" /> Buy usage
                </button>
              </div>
            )}

            {/* Input */}
            {(!usage?.sessionExhausted || usage.hasPackCredits) && (
              <div className="border-t border-bg-border p-3">
                {file && (
                  <div className="mb-2 flex items-center gap-2 text-xs text-text-muted">
                    <Paperclip className="h-3 w-3" />
                    {file.name}
                    <button onClick={() => setFile(null)} className="hover:text-text"><X className="h-3 w-3" /></button>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="file"
                    ref={fileRef}
                    className="hidden"
                    accept="image/*,.pdf,.txt"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <button onClick={() => fileRef.current?.click()} className="text-text-muted hover:text-text transition p-2">
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <input
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-text-dim"
                    placeholder="Ask anything…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
                    disabled={sending}
                  />
                  <button
                    onClick={send}
                    disabled={sending || (!input.trim() && !file)}
                    className="text-text-muted hover:text-text disabled:opacity-30 transition p-2"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pack purchase modal */}
      {showPacks && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="card-elevated w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Buy extra usage</h3>
              <button onClick={() => setShowPacks(false)} className="text-text-muted hover:text-text"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-sm text-text-muted mb-5">Your daily allowance is used up. Buy extra usage that carries over until spent.</p>
            <div className="space-y-3">
              {PACKS.map((p) => (
                <div key={p.id} className="card p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-sm">{p.label}</p>
                    <p className="text-xs text-text-muted">{p.value} · {p.est}</p>
                  </div>
                  <button
                    onClick={() => buyPack(p.id)}
                    disabled={buyingPack !== null}
                    className="btn-primary text-sm shrink-0"
                  >
                    {buyingPack === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : p.price}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
