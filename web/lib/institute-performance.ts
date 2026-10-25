export type GraphicsQuality = "auto" | "balanced" | "high";

// Resolution changes need sustained evidence, not a single shader-compilation spike.
export function resolutionAfterWindow(scale: number, frameMs: number): number {
  if (frameMs > 25) return Math.max(.7, Math.round((scale - .1) * 100) / 100);
  if (frameMs < 18) return Math.min(1.25, Math.round((scale + .05) * 100) / 100);
  return scale;
}

export function graphicsPixelRatio(deviceRatio: number, quality: GraphicsQuality, adaptiveScale: number): number {
  return Math.min(deviceRatio || 1, quality === "high" ? 1.5 : quality === "balanced" ? 1 : adaptiveScale);
}
