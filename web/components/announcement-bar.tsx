"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";

type Announcement = { id: string; message: string };

export function AnnouncementBar({ announcements }: { announcements: Announcement[] }) {
  const [visible, setVisible] = useState(true);
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (announcements.length <= 1) return;

    function cycle() {
      // Fade out
      setFading(true);
      timerRef.current = setTimeout(() => {
        setIndex((i) => (i + 1) % announcements.length);
        // Fade in
        setFading(false);
        // Schedule next cycle
        timerRef.current = setTimeout(cycle, 10000);
      }, 400); // fade duration
    }

    timerRef.current = setTimeout(cycle, 10000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [announcements.length]);

  if (!announcements.length || !visible) return null;

  const current = announcements[index];

  return (
    <div className="relative z-50 w-full bg-white/[0.06] border-b border-white/10 backdrop-blur-sm">
      <div
        className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6"
        style={{ transition: "opacity 0.4s ease", opacity: fading ? 0 : 1 }}
      >
        <div className="flex flex-1 items-center justify-center gap-2">
          {announcements.length > 1 && (
            <div className="flex shrink-0 gap-1">
              {announcements.map((_, i) => (
                <span
                  key={i}
                  className="h-1 w-1 rounded-full transition-colors duration-300"
                  style={{ background: i === index ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.25)" }}
                />
              ))}
            </div>
          )}
          <p className="text-center text-sm text-white/90">{current.message}</p>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="shrink-0 rounded p-0.5 text-white/50 transition hover:text-white/90"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
