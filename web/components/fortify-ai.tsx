"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Paperclip, X, ShoppingCart, CheckCircle2, XCircle } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type ActionResult = { description: string; success: boolean };

type Msg = {
  role: "user" | "assistant";
  content: string;
  hasFile?: boolean;
  actions?: ActionResult[];
};

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
  { id: 1, label: "Starter Pack",  price: "£4.99",  est: "~40 minutes",   value: "£2 credit" },
  { id: 2, label: "Standard Pack", price: "£9.99",  est: "~1.5 hours",    value: "£5 credit" },
  { id: 3, label: "Power Pack",    price: "£24.99", est: "~5 hours",       value: "£15 credit" },
];

// ── Markdown + link renderer ───────────────────────────────────────────────────

function renderContent(text: string): React.ReactNode {
  // Split on markdown links [text](url) first
  const segments = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  const nodes: React.ReactNode[] = [];

  segments.forEach((seg, si) => {
    const linkMatch = seg.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      const isInternal = href.startsWith("/");
      nodes.push(
        <a
          key={si}
          href={href}
          target={isInternal ? "_self" : "_blank"}
          rel={isInternal ? undefined : "noopener noreferrer"}
          className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] font-medium bg-white/[0.08] border border-white/[0.12] text-white hover:bg-white/[0.14] transition-colors no-underline"
          onClick={isInternal ? (e) => { e.stopPropagation(); } : undefined}
        >
          {label} ↗
        </a>
      );
      return;
    }

    // Within plain text, handle **bold** and newlines
    const boldSplit = seg.split(/(\*\*[^*]+\*\*)/g);
    boldSplit.forEach((part, bi) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        nodes.push(<strong key={`${si}-${bi}`}>{part.slice(2, -2)}</strong>);
      } else {
        part.split("\n").forEach((line, li, arr) => {
          nodes.push(<span key={`${si}-${bi}-${li}`}>{line}</span>);
          if (li < arr.length - 1) nodes.push(<br key={`${si}-${bi}-br-${li}`} />);
        });
      }
    });
  });

  return <>{nodes}</>;
}

// ── Main component ─────────────────────────────────────────────────────────────

export function FortifyAI() {
  const [open,       setOpen]       = useState(false);
  const [launching,  setLaunching]  = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);
  const [messages,   setMessages]   = useState<Msg[]>([]);
  const [input,      setInput]      = useState("");
  const [file,       setFile]       = useState<File | null>(null);
  const [sending,    setSending]    = useState(false);
  const [usage,      setUsage]      = useState<Usage | null>(null);
  const [showPacks,  setShowPacks]  = useState(false);
  const [buyingPack, setBuyingPack] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef   = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open && !usage) fetchUsage(); }, [open]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function handleOpen() {
    if (open || launching) return;
    setLaunching(true);
    setTimeout(() => { setOpen(true); setLaunching(false); }, 210);
  }

  async function fetchUsage() {
    const r = await fetch("/api/ai/chat/usage");
    setUsage(await r.json());
  }

  async function send() {
    if (!input.trim() && !file) return;
    if (usage?.sessionExhausted && !usage.hasPackCredits) { setShowPacks(true); return; }

    const userMsg: Msg = { role: "user", content: input, hasFile: !!file };
    setMessages((p) => [...p, userMsg]);
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
          body: JSON.stringify({ messages: [...history, { role: "user", content: input }] }),
        });
      }

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        if (d.error === "SESSION_LIMIT_REACHED") { setShowPacks(true); }
        else { setMessages((p) => [...p, { role: "assistant", content: `Error: ${d.error ?? "Something went wrong."}` }]); }
        return;
      }

      const d = await res.json();
      setMessages((p) => [
        ...p,
        { role: "assistant", content: d.message, actions: d.actions?.length ? d.actions : undefined },
      ]);
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

  const barColor = (p: number) => p > 90 ? "bg-red-500" : p > 70 ? "bg-amber-400" : "bg-green-500";

  return (
    <>
      {/* ── Styles ── */}
      <style>{`
        /* ── Button idle glow on hover ── */
        @keyframes fortifyBtnGlow {
          0%,100% { box-shadow: 0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.12); }
          50%      { box-shadow: 0 4px 24px rgba(0,0,0,0.5), 0 0 0 2px rgba(255,255,255,0.55), 0 0 20px rgba(255,255,255,0.12); }
        }
        @keyframes fortifyTextGlow {
          0%,100% { text-shadow: none; }
          50%      { text-shadow: 0 0 10px rgba(255,255,255,0.95), 0 0 20px rgba(255,255,255,0.4); }
        }
        /* ── Button launch (click) ── */
        @keyframes fortifyBtnLaunch {
          0%   { transform: scale(1);    opacity: 1; box-shadow: 0 4px 24px rgba(0,0,0,0.5); }
          35%  { transform: scale(1.13); opacity: 1; box-shadow: 0 0 0 10px rgba(255,255,255,0.14), 0 0 36px rgba(255,255,255,0.12); }
          100% { transform: scale(0.82); opacity: 0; box-shadow: 0 0 0 0 transparent; }
        }
        /* ── Chat panel slide in ── */
        @keyframes fortifyPanelIn {
          from { opacity: 0; transform: translateY(22px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        .fortify-btn-hovered  { animation: fortifyBtnGlow 1.6s ease infinite !important; }
        .fortify-btn-hovered .fortify-btn-text { animation: fortifyTextGlow 1.6s ease infinite; }
        .fortify-btn-launching { animation: fortifyBtnLaunch 0.21s ease-out forwards !important; pointer-events: none; }
        .fortify-panel-in      { animation: fortifyPanelIn 0.26s cubic-bezier(0.34,1.56,0.64,1) both; }
      `}</style>

      {/* ── Floating button ── */}
      {!open && (
        <button
          onClick={handleOpen}
          onMouseEnter={() => !launching && setBtnHovered(true)}
          onMouseLeave={() => setBtnHovered(false)}
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-transform ${
            launching  ? "fortify-btn-launching" :
            btnHovered ? "fortify-btn-hovered"   : ""
          }`}
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

      {/* ── Chat panel ── */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:p-6 pointer-events-none">
          <div className="fortify-panel-in pointer-events-auto flex flex-col w-full max-w-md h-[620px] rounded-2xl border border-bg-border bg-bg shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-bg-border bg-bg-panel">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block rounded-full w-2 h-2"
                  style={{ background: "linear-gradient(135deg,#111,#333)", border: "1px solid rgba(255,255,255,0.25)" }}
                />
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
              <button onClick={() => setOpen(false)} className="text-text-muted hover:text-text transition">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-10">
                  <div
                    className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full text-base"
                    style={{ background: "linear-gradient(135deg,#0a0a0a,#222)", border: "1px solid rgba(255,255,255,0.15)" }}
                  >
                    ✦
                  </div>
                  <p className="text-base font-semibold mb-1">Hey, I&apos;m Fortify AI.</p>
                  <p className="text-sm text-text-muted">
                    Ask me anything — or tell me to do something,<br />
                    like &ldquo;change my niche to e-commerce&rdquo;.
                  </p>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-white/10 text-text"
                        : "bg-bg-panel border border-bg-border text-text"
                    }`}
                  >
                    {m.hasFile && <p className="text-[10px] text-text-muted mb-1">📎 File attached</p>}
                    <div className="whitespace-pre-wrap">{renderContent(m.content)}</div>

                    {/* Action result chips */}
                    {m.actions && m.actions.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {m.actions.map((a, ai) => (
                          <div
                            key={ai}
                            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${
                              a.success
                                ? "bg-green-500/10 border border-green-500/20 text-green-300"
                                : "bg-red-500/10 border border-red-500/20 text-red-300"
                            }`}
                          >
                            {a.success
                              ? <CheckCircle2 className="h-3 w-3 shrink-0" />
                              : <XCircle     className="h-3 w-3 shrink-0" />}
                            {a.description}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {sending && (
                <div className="flex justify-start">
                  <div className="bg-bg-panel border border-bg-border rounded-2xl px-4 py-3 flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: "120ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: "240ms" }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Session exhausted banner */}
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
                <div className="flex gap-2 items-center">
                  <input
                    type="file"
                    ref={fileRef}
                    className="hidden"
                    accept="image/*,.pdf,.txt"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="text-text-muted hover:text-text transition p-2 shrink-0"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <input
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-text-dim"
                    placeholder="Ask or say what to do…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
                    disabled={sending}
                  />
                  <button
                    onClick={send}
                    disabled={sending || (!input.trim() && !file)}
                    className="text-text-muted hover:text-text disabled:opacity-30 transition p-2 shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Pack purchase modal ── */}
      {showPacks && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="card-elevated w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Buy extra usage</h3>
              <button onClick={() => setShowPacks(false)} className="text-text-muted hover:text-text">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-text-muted mb-5">
              Your daily allowance is used up. Buy extra usage that carries over until spent.
            </p>
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
