"use client";

import { useState, KeyboardEvent, useRef } from "react";
import { X } from "lucide-react";

export function TagInput({
  value,
  onChange,
  placeholder,
  maxTags = 12,
  maxLen = 40,
  suggestions = [],
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  maxLen?: number;
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function add(tag?: string) {
    const t = (tag ?? draft).trim().slice(0, maxLen);
    if (!t || value.includes(t) || value.length >= maxTags) {
      setDraft("");
      setOpen(false);
      return;
    }
    onChange([...value, t]);
    setDraft("");
    setOpen(false);
  }

  const filtered = draft.trim()
    ? suggestions.filter(
        (s) =>
          s.toLowerCase().includes(draft.trim().toLowerCase()) &&
          !value.includes(s)
      )
    : [];

  const showCustomAdd =
    draft.trim() &&
    !suggestions.some((s) => s.toLowerCase() === draft.trim().toLowerCase()) &&
    !value.includes(draft.trim());

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
    } else if (e.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <div
        className="flex flex-wrap gap-1.5 rounded-lg border border-bg-border bg-bg-elevated p-2 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
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
          ref={inputRef}
          type="text"
          className="flex-1 min-w-[120px] bg-transparent text-sm text-text outline-none placeholder:text-text-dim"
          placeholder={value.length === 0 ? placeholder : ""}
          value={draft}
          maxLength={maxLen}
          onChange={(e) => { setDraft(e.target.value); setOpen(true); }}
          onKeyDown={onKey}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>
      <p className="mt-1 text-xs text-text-muted">
        Press Enter or comma to add. {value.length}/{maxTags}.
      </p>

      {open && (filtered.length > 0 || showCustomAdd) && (
        <div className="absolute z-20 top-full mt-1 w-full rounded-lg border border-bg-border bg-bg-panel shadow-xl max-h-48 overflow-y-auto">
          {filtered.slice(0, 10).map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={() => add(s)}
              className="flex w-full items-center px-3 py-2 text-sm text-text hover:bg-white/[0.06] transition"
            >
              {s}
            </button>
          ))}
          {showCustomAdd && (
            <button
              type="button"
              onMouseDown={() => add(draft.trim())}
              className="flex w-full items-center px-3 py-2 text-sm text-text-muted hover:bg-white/[0.06] transition border-t border-bg-border"
            >
              Add "{draft.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}
