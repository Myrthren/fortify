"use client";

import { useState } from "react";

const SUBJECTS = [
  "Subscription / Billing",
  "Missing Discord Role",
  "Bot Command Not Working",
  "Account Issue",
  "Feature Request",
  "Other",
];

export function SupportForm() {
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    setStatus("sending");
    setErrorMsg("");

    try {
      const res = await fetch("/api/support/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong");
      }

      setStatus("sent");
      setMessage("");
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err.message ?? "Failed to send. Try again.");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-lg border border-green-500/20 bg-green-500/10 px-5 py-4 text-sm text-green-300">
        <p className="font-medium">Message received.</p>
        <p className="mt-1 text-green-400/80">
          You&apos;ll hear back via Discord DM once a ticket is opened. This usually takes a few hours.
        </p>
        <button
          onClick={() => setStatus("idle")}
          className="mt-3 text-xs text-green-400 underline underline-offset-2 hover:text-green-300"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Spam warning */}
      <div className="flex items-start gap-2.5 rounded-lg border border-red-500/15 bg-red-500/[0.06] px-4 py-3">
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-0.5 shrink-0 text-red-400"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span className="text-xs leading-relaxed text-text-muted">
          Only use this form for genuine support requests. Spam or abuse results in a{" "}
          <strong className="text-red-400">strike</strong> on your account.
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-text-muted">Subject</label>
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="rounded-lg border border-bg-border bg-bg-panel px-3 py-2 text-sm text-text outline-none focus:border-white/20"
        >
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-text-muted">Message</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          maxLength={1000}
          placeholder="Describe your issue in as much detail as possible. Include your Discord ID if relevant."
          required
          className="resize-none rounded-lg border border-bg-border bg-bg-panel px-3 py-2 text-sm text-text placeholder-text-muted/50 outline-none focus:border-white/20"
        />
        <span className="self-end text-xs text-text-muted/50">{message.length}/1000</span>
      </div>

      {status === "error" && (
        <p className="text-xs text-red-400">{errorMsg}</p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={status === "sending" || !message.trim()}
          className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-bg transition hover:bg-white/90 disabled:opacity-50"
        >
          {status === "sending" ? (
            "Sending…"
          ) : (
            <>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              Send Message
            </>
          )}
        </button>
      </div>
    </form>
  );
}
