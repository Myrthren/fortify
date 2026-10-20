"use client";

import { useEffect, useState } from "react";

export function AmbientMotionControl() {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("fortify-motion-paused") === "true";
      setPaused(saved);
      document.documentElement.dataset.motion = saved ? "paused" : "running";
    } catch { /* Motion preferences still work when storage is unavailable. */ }
    const visibility = () => {
      document.documentElement.dataset.pageHidden = String(document.visibilityState === "hidden");
    };
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);

  function toggle() {
    const next = !paused;
    setPaused(next);
    document.documentElement.dataset.motion = next ? "paused" : "running";
    try { localStorage.setItem("fortify-motion-paused", String(next)); } catch {}
  }

  return <button type="button" data-motion-toggle className="ambient-motion-toggle" aria-pressed={paused} onClick={toggle}>
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
      {paused ? <path d="M2 1 9 5 2 9Z" /> : <path d="M2 1H4V9H2ZM6 1H8V9H6Z" />}
    </svg>
    <span>{paused ? "Resume motion" : "Pause motion"}</span>
  </button>;
}
