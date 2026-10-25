/** Decorative point cloud; deterministic so server and client render identically. */
export function SignalField({ compact = false }: { compact?: boolean }) {
  const points = Array.from({ length: 780 }, (_, i) => {
    const y = 1 - (i / 779) * 2;
    const radius = Math.sqrt(1 - y * y);
    const angle = i * Math.PI * (3 - Math.sqrt(5));
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    return <circle key={i} cx={(250 + x * 174).toFixed(3)} cy={(250 + y * 174).toFixed(3)} r={z > 0 ? 1.65 : 1.1} opacity={(0.14 + (z + 1) * 0.35).toFixed(3)} />;
  });
  return (
    <div className={`signal-field ${compact ? "signal-compact" : ""}`} aria-hidden="true">
      <div className="signal-axis axis-x" /><div className="signal-axis axis-y" />
      <svg viewBox="0 0 500 500" fill="currentColor">
        <g className="signal-orbit-outer"><circle cx="250" cy="250" r="218" fill="none" stroke="currentColor" strokeOpacity=".3" strokeDasharray="2 9" /><circle cx="250" cy="32" r="3" /></g>
        <g className="signal-orbit-inner"><ellipse cx="250" cy="250" rx="207" ry="71" fill="none" stroke="currentColor" strokeOpacity=".35" transform="rotate(-24 250 250)" /><circle cx="61" cy="334" r="2.5" /></g>
        <g className="signal-cloud">{points}</g>
        <circle className="signal-scan" cx="250" cy="250" r="175" fill="none" stroke="currentColor" strokeOpacity=".4" strokeWidth=".8" strokeDasharray="90 1010" />
      </svg>
      <span className="signal-coordinate coordinate-top">F / INTELLIGENCE LAYER</span>
      <span className="signal-coordinate coordinate-bottom">CONTEXT → CLARITY → ACTION</span>
      <span className="signal-cross cross-top">+</span><span className="signal-cross cross-bottom">+</span>
    </div>
  );
}
