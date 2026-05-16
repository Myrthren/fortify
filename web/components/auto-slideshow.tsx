"use client";

import { useState } from "react";
import { Loader2, Download, ChevronDown, ChevronUp, Sparkles, Images } from "lucide-react";

const FONTS = [
  "Inter", "Montserrat", "Playfair Display", "Bebas Neue", "Poppins",
  "Oswald", "Lato", "Raleway", "Roboto Mono", "Merriweather",
  "Space Grotesk", "Outfit",
];

type SlideResult = {
  image: string;
  title: string;
  subtitle: string;
};

export function AutoSlideshow({ credits }: { credits: number }) {
  const [expanded, setExpanded] = useState(false);
  const [description, setDescription] = useState("");
  const [font, setFont] = useState("Montserrat");
  const [slideCount, setSlideCount] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [slides, setSlides] = useState<SlideResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creditsUsed, setCreditsUsed] = useState(0);

  const cost = slideCount * 15;

  async function generate() {
    if (!description.trim()) { setError("Describe your slideshow"); return; }
    if (credits < cost) { setError(`Need ${cost} credits`); return; }
    setError(null);
    setGenerating(true);
    setSlides([]);
    try {
      const res = await fetch("/api/slideshow/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, font, slideCount }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Generation failed"); return; }
      const results: SlideResult[] = data.images.map((img: string, i: number) => ({
        image: img,
        title: data.slideContent[i]?.title ?? `Slide ${i + 1}`,
        subtitle: data.slideContent[i]?.subtitle ?? "",
      })).filter((s: SlideResult) => s.image);
      setSlides(results);
      setCreditsUsed(data.creditsUsed);
    } finally {
      setGenerating(false);
    }
  }

  function downloadSlide(image: string, index: number, format: "png" | "jpg") {
    if (!image) return;
    if (format === "png") {
      const a = document.createElement("a");
      a.href = image;
      a.download = `slide-${index + 1}.png`;
      a.click();
      return;
    }
    // Convert to JPG via canvas
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/jpeg", 0.92);
      a.download = `slide-${index + 1}.jpg`;
      a.click();
    };
    img.src = image;
  }

  function downloadAll(format: "png" | "jpg") {
    slides.forEach((s, i) => downloadSlide(s.image, i, format));
  }

  return (
    <div className="card overflow-hidden">
      {/* Header / toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-5 text-left transition hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-3">
          <Images className="h-4 w-4 text-text-muted" />
          <div>
            <p className="font-semibold text-sm">AutoSlideshow</p>
            <p className="text-xs text-text-muted">AI-generated presentation slides — 15 credits/slide</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
      </button>

      {expanded && (
        <div className="border-t border-bg-border p-5 space-y-5">
          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">
              Describe your slideshow
            </label>
            <textarea
              className="input w-full resize-none"
              rows={3}
              placeholder="e.g. A pitch deck for a SaaS startup that helps e-commerce brands automate their social media..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={generating}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Font */}
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Font</label>
              <select
                className="input w-full"
                value={font}
                onChange={(e) => setFont(e.target.value)}
                disabled={generating}
              >
                {FONTS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* Slide count */}
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">
                Slides <span className="text-text-dim">({slideCount} × 15 = {cost} credits)</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={slideCount}
                  onChange={(e) => setSlideCount(parseInt(e.target.value))}
                  disabled={generating}
                  className="flex-1 accent-white"
                />
                <span className="tabular-nums text-sm font-semibold w-4">{slideCount}</span>
              </div>
            </div>
          </div>

          {error && <p className="text-xs text-red-300">{error}</p>}

          <button
            onClick={generate}
            disabled={generating || !description.trim()}
            className="btn-primary w-full"
          >
            {generating
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating {slideCount} slides&hellip;</>
              : <><Sparkles className="h-4 w-4" /> Generate Slideshow &mdash; {cost} credits</>
            }
          </button>

          {generating && (
            <div className="text-center py-4 text-xs text-text-muted space-y-1">
              <p>Generating {slideCount} slides — this may take up to {slideCount * 10} seconds</p>
            </div>
          )}

          {/* Results */}
          {slides.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">
                  {slides.length} slides generated
                  <span className="ml-2 text-xs font-normal text-text-muted">({creditsUsed} credits used)</span>
                </p>
                <div className="flex gap-2">
                  <button onClick={() => downloadAll("png")} className="btn-secondary text-xs py-1.5 px-3">
                    <Download className="h-3 w-3" /> All PNG
                  </button>
                  <button onClick={() => downloadAll("jpg")} className="btn-secondary text-xs py-1.5 px-3">
                    <Download className="h-3 w-3" /> All JPG
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {slides.map((slide, i) => (
                  <div key={i} className="rounded-xl overflow-hidden border border-bg-border bg-bg-panel">
                    <div className="relative aspect-video bg-bg-elevated">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={slide.image}
                        alt={`Slide ${i + 1}: ${slide.title}`}
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                        {i + 1}
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-medium truncate">{slide.title}</p>
                      <p className="text-[11px] text-text-muted truncate">{slide.subtitle}</p>
                      <div className="mt-2 flex gap-1.5">
                        <button
                          onClick={() => downloadSlide(slide.image, i, "png")}
                          className="flex-1 rounded-md border border-bg-border bg-bg py-1 text-[11px] text-text-muted hover:text-text hover:border-white/20 transition"
                        >
                          PNG
                        </button>
                        <button
                          onClick={() => downloadSlide(slide.image, i, "jpg")}
                          className="flex-1 rounded-md border border-bg-border bg-bg py-1 text-[11px] text-text-muted hover:text-text hover:border-white/20 transition"
                        >
                          JPG
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
