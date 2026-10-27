"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { SignalField } from "./signal-field";

export type FortifySceneKind = "signal" | "workflow";

type CanvasProps = { kind: FortifySceneKind; onReady: () => void; onError: () => void };

/** The marketing scenes are loaded only when their section enters the viewport. */
export function FortifyScene({ kind }: { kind: FortifySceneKind }) {
  const host = useRef<HTMLDivElement>(null);
  const [Canvas, setCanvas] = useState<ComponentType<CanvasProps> | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const markReady = useCallback(() => setReady(true), []);
  const markFailed = useCallback(() => { setReady(false); setFailed(true); }, []);

  useEffect(() => {
    if (!host.current || failed || Canvas) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData || (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cancelled = false;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      observer.disconnect();
      import("./fortify-scene-canvas")
        .then((module) => { if (!cancelled) setCanvas(() => module.FortifySceneCanvas); })
        .catch(() => { if (!cancelled) setFailed(true); });
    }, { rootMargin: "120px" });
    observer.observe(host.current);
    return () => { cancelled = true; observer.disconnect(); };
  }, [Canvas, failed]);

  return <div ref={host} className={`fortify-scene fortify-scene--${kind}`} data-ready={ready}
    role="img" aria-label={kind === "signal" ? "A connected business signal with orbiting paths." : "Fortify connects business context to a plan and then an action."}>
    <div className="fortify-scene-static" aria-hidden="true">
      {kind === "signal" ? <SignalField /> : <div className="fortify-stage-static"><i /><i /><i /></div>}
    </div>
    {Canvas && !failed && <Canvas kind={kind} onReady={markReady} onError={markFailed} />}
    {kind === "workflow" && <div className="fortify-stage-labels" aria-hidden="true"><span>Context</span><span>Plan</span><span>Action</span></div>}
  </div>;
}
