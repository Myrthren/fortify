"use client";

import { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";

export function TagInput({
  value,
  onChange,
  placeholder,
  maxTags = 12,
  maxLen = 40,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  maxLen?: number;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const t = draft.trim().slice(0, maxLen);
    if (!t) return;
    if (value.includes(t)) {
      setDraft("");
      return;
    }
    if (value.length >= maxTags) return;
    onChange([...value, t]);
    setDraft("");
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
    } else if (e.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 rounded-lg border border-bg-border bg-bg-elevated p-2">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md border border-bg-border bg-bg-panel px-2 py-0.5 text-xs"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="text-text-muted hover:text-text"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          className="flex-1 min-w-[120px] bg-transparent text-sm text-text outline-none placeholder:text-text-dim"
          placeholder={value.length === 0 ? placeholder : ""}
          value={draft}
          maxLength={maxLen}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={add}
        />
      </div>
      <p className="mt-1 text-xs text-text-muted">
        Press Enter or comma to add. {value.length}/{maxTags}.
      </p>
    </div>
  );
}
