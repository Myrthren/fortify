"use client";

import { useState } from "react";

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className={className ?? "rounded-md border border-bg-border bg-bg px-3 py-1.5 text-xs text-text-muted transition hover:bg-white/[0.04] hover:text-text"}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}
