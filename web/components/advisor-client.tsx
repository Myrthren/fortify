"use client";

import { useState } from "react";
import { Loader2, Send, ChevronDown, ChevronRight, Zap } from "lucide-react";

type AdvisorSession = {
  id: string;
  title: string;
  messages: { role: "user" | "assistant"; content: string }[];
  createdAt: string;
};

type Props = {
  pastSessions: AdvisorSession[];
};

const PROMPTS = [
  "I want to grow revenue by 30% in the next 90 days. What's the most leveraged approach given what you know about my business?",
  "I'm about to launch a new product. What should I focus on for the first 30 days?",
  "My outreach isn't converting. Analyse what I'm doing and tell me what to change.",
  "Which Fortify tools am I underusing that would have the most impact for someone in my niche?",
  "Where are my biggest competitive vulnerabilities right now, and how do I address them?",
];

export function AdvisorClient({ pastSessions: initial }: Props) {
  const [sessions, setSessions] = useState<AdvisorSession[]>(initial);
  const [challenge, setChallenge] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentSession, setCurrentSession] = useState<AdvisorSession | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function runAdvisor() {
    if (!challenge.trim() || loading) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/ai/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge: challenge.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Error ${res.status}`);
      }

      const data = await res.json();
      const newSession: AdvisorSession = {
        id: data.sessionId,
        title: data.title,
        messages: [
          { role: "user", content: challenge.trim() },
          { role: "assistant", content: data.response },
        ],
        createdAt: new Date().toISOString(),
      };

      setSessions((prev) => [newSession, ...prev]);
      setCurrentSession(newSession);
      setChallenge("");
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* ── Left: New session + past sessions ── */}
      <div className="lg:col-span-1 space-y-4">
        {/* New session card */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold mb-1">New Strategy Session</h2>
          <p className="text-xs text-text-muted mb-4">
            Describe any business challenge, decision, or goal. The Advisor reads all your Fortify data — DNA, competitors, trends, tools — before responding.
          </p>

          <textarea
            value={challenge}
            onChange={(e) => setChallenge(e.target.value)}
            placeholder="What challenge or decision do you want strategic advice on?"
            className="w-full resize-none rounded-md border border-bg-border bg-bg px-3 py-2 text-sm placeholder:text-text-dim focus:outline-none focus:ring-1 focus:ring-white/20 min-h-[120px]"
            disabled={loading}
          />

          {error && (
            <p className="mt-2 text-xs text-red-400">{error}</p>
          )}

          <button
            onClick={runAdvisor}
            disabled={!challenge.trim() || loading}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analysing your business…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Get Strategic Advice
              </>
            )}
          </button>

          {/* Prompt suggestions */}
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-wider text-text-dim mb-2">Suggested prompts</p>
            <div className="space-y-1.5">
              {PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setChallenge(p)}
                  className="w-full text-left rounded-md px-2.5 py-2 text-xs text-text-muted hover:bg-white/[0.04] hover:text-text transition"
                  disabled={loading}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Past sessions list */}
        {sessions.length > 0 && (
          <div className="card p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-3">Past Sessions</h3>
            <div className="space-y-1">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setCurrentSession(s);
                    setExpandedId(s.id);
                  }}
                  className={`w-full text-left rounded-md px-2.5 py-2 text-xs transition ${
                    currentSession?.id === s.id
                      ? "bg-white/[0.06] text-text"
                      : "text-text-muted hover:bg-white/[0.04] hover:text-text"
                  }`}
                >
                  <div className="font-medium truncate">
                    {s.title.replace(/^Strategy: /, "")}
                  </div>
                  <div className="text-text-dim mt-0.5">
                    {new Date(s.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Right: Current session output ── */}
      <div className="lg:col-span-2">
        {currentSession ? (
          <div className="card p-6 sm:p-8">
            <div className="mb-6 pb-5 border-b border-bg-border">
              <p className="text-xs text-text-dim uppercase tracking-wider mb-1">Strategy Session</p>
              <h2 className="text-lg font-semibold">{currentSession.title.replace(/^Strategy: /, "")}</h2>
              <p className="text-xs text-text-muted mt-1">
                {new Date(currentSession.createdAt).toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>

            <div className="space-y-6">
              {currentSession.messages.map((msg, i) => (
                <div key={i}>
                  {msg.role === "user" ? (
                    <div className="rounded-md bg-white/[0.04] border border-bg-border px-4 py-3">
                      <p className="text-xs font-semibold text-text-dim uppercase tracking-wider mb-1.5">Your challenge</p>
                      <p className="text-sm text-text">{msg.content}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-semibold text-text-dim uppercase tracking-wider mb-3">Advisor response</p>
                      <div className="prose prose-sm prose-invert max-w-none text-text-muted
                        [&>h1]:text-text [&>h1]:text-lg [&>h1]:font-semibold [&>h1]:mb-3
                        [&>h2]:text-text [&>h2]:text-base [&>h2]:font-semibold [&>h2]:mb-2 [&>h2]:mt-5
                        [&>h3]:text-text [&>h3]:text-sm [&>h3]:font-semibold [&>h3]:mb-1.5 [&>h3]:mt-4
                        [&>p]:text-sm [&>p]:leading-relaxed [&>p]:mb-3
                        [&>ul]:text-sm [&>ul]:space-y-1 [&>ul]:mb-3 [&>ul]:list-disc [&>ul]:pl-4
                        [&>ol]:text-sm [&>ol]:space-y-1.5 [&>ol]:mb-3 [&>ol]:list-decimal [&>ol]:pl-4
                        [&>li]:leading-relaxed
                        [&>strong]:text-text [&>b]:text-text
                        [&_strong]:text-text [&_b]:text-text
                        [&>blockquote]:border-l-2 [&>blockquote]:border-white/20 [&>blockquote]:pl-3 [&>blockquote]:italic [&>blockquote]:text-text-dim
                        [&>hr]:border-bg-border [&>hr]:my-4">
                        <MarkdownRenderer content={msg.content} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card p-10 flex flex-col items-center justify-center text-center min-h-[400px]">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-bg-border bg-bg-elevated shadow-[0_0_24px_-6px_var(--accent-glow)]">
              <Zap className="h-6 w-6 text-[var(--accent)]" />
            </div>
            <h3 className="text-base font-semibold mb-2">AI Advisor</h3>
            <p className="text-sm text-text-muted max-w-sm">
              Describe a challenge on the left and your Advisor will synthesise everything it knows about your business — competitors, trends, DNA, tool usage, platform data — into a strategic response.
            </p>
            <p className="mt-4 text-xs text-text-dim">
              Running on Claude Opus · Apex exclusive
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Simple markdown renderer (avoids needing react-markdown dep)
function MarkdownRenderer({ content }: { content: string }) {
  // Convert markdown to simple HTML
  const html = content
    // Headers
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Horizontal rules
    .replace(/^---$/gm, "<hr>")
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    // Bullet lists
    .replace(/^[-•] (.+)$/gm, "<li>$1</li>")
    // Wrap consecutive <li> in <ol> or <ul>
    .replace(/(<li>.*<\/li>\n?)+/gs, (match) => `<ul>${match}</ul>`)
    // Paragraphs — double newline becomes paragraph break
    .replace(/\n\n(?!<[huo])/g, "</p><p>")
    // Wrap remaining text in paragraph if not already wrapped
    .replace(/^(?!<[huo])(.*\S.*)$/gm, (line) => {
      if (line.startsWith("<") || !line.trim()) return line;
      return line;
    });

  return (
    <div
      dangerouslySetInnerHTML={{
        __html: `<p>${html}</p>`
          .replace(/<p><\/p>/g, "")
          .replace(/<p>(<[huo])/g, "$1")
          .replace(/(<\/[huo][^>]*>)<\/p>/g, "$1"),
      }}
    />
  );
}
