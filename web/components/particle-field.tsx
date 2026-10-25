/** Deterministic SVG fields: no per-particle JavaScript or random hydration. */
export function ParticleField({ shape = "wave", className = "" }: {
  shape?: "wave" | "halo"; className?: string;
}) {
  const layers = Array.from({ length: 3 }, (_, layer) => {
    const points = Array.from({ length: 144 }, (_, i) => {
      const row = Math.floor(i / 36) * 3 + layer;
      const column = i % 36;
      const phase = column / 35;
      const angle = phase * Math.PI * 2 + row * .07;
      const x = shape === "halo" ? 500 + Math.cos(angle) * (100 + row * 27) : phase * 1000;
      const y = shape === "halo" ? 250 + Math.sin(angle) * (48 + row * 15) : 170 + row * 16 + Math.sin(phase * 7 + row * .19) * 72;
      // Math.sin/cos can differ in the final bit between server/browser engines.
      return <circle key={i} cx={x.toFixed(3)} cy={y.toFixed(3)} r={i % 17 === 0 ? 2 : 1.1} opacity={(.18 + ((i * 7 + layer) % 11) / 17).toFixed(3)} />;
    });
    return <g key={layer} className={`particle-layer particle-layer-${layer}`}>{points}</g>;
  });
  return <div className={`particle-field particle-${shape} ${className}`} aria-hidden="true">
    <svg viewBox="0 0 1000 500" fill="currentColor" focusable="false">
      {layers}
      <path className="particle-trace" d="M0 310 Q250 70 500 270 T1000 250" fill="none" stroke="currentColor" strokeWidth=".6" strokeOpacity=".22" strokeDasharray="3 14" />
    </svg>
  </div>;
}

export function SiteAtmosphere() {
  return <div className="site-atmosphere" aria-hidden="true">
    <div className="ambient-stars ambient-stars-near" />
    <div className="ambient-stars ambient-stars-far" />
    <div className="ambient-horizon" />
    <ParticleField className="ambient-field-left" />
    <ParticleField shape="halo" className="ambient-field-right" />
    <span className="ambient-reticle reticle-top">+</span>
    <span className="ambient-reticle reticle-bottom">+</span>
  </div>;
}
