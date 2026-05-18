"use client";

import { useState, useRef } from "react";
import { Loader2, Download, ChevronDown, ChevronUp, Sparkles, Images, Upload, X } from "lucide-react";

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

type Mode = "ai" | "own";

export function AutoSlideshow({ credits }: { credits: number }) {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<Mode>("ai");
  const [description, setDescription] = useState("");
  const [font, setFont] = useState("Montserrat");
  const [slideCount, setSlideCount] = useState(5);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [slides, setSlides] = useState<SlideResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creditsUsed, setCreditsUsed] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const effectiveCount = mode === "own" ? uploadedImages.length : slideCount;
  const costPerSlide = mode === "own" ? 5 : 15;
  const cost = effectiveCount * costPerSlide;

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = 10 - uploadedImages.length;
    files.slice(0, remaining).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        if (dataUrl) setUploadedImages((prev) => [...prev, dataUrl]);
      };
      reader.readAsDataURL(file);
    });
    // Reset input so same file can be re-selected
    e.target.value = "";
  }

  function removeImage(index: number) {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function generate() {
    if (!description.trim()) { setError("Describe the context or theme of your slideshow"); return; }
    if (mode === "own" && uploadedImages.length === 0) { setError("Upload at least one image"); return; }
    if (credits < cost) { setError(`Need ${cost} credits`); return; }
    setError(null);
    setGenerating(true);
    setSlides([]);
    try {
      const body: Record<string, unknown> = { description, font, slideCount: effectiveCount };
      if (mode === "own") body.images = uploadedImages;

      const res = await fetch("/api/slideshow/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

  // For AI-generated slides: just download the image (text is baked in by DALL-E)
  // For own images: composite title/subtitle onto the image via Canvas
  function downloadSlide(slide: SlideResult, index: number, format: "png" | "jpg") {
    if (!slide.image) return;

    if (mode === "ai") {
      if (format === "png") {
        const a = document.createElement("a");
        a.href = slide.image;
        a.download = `slide-${index + 1}.png`;
        a.click();
        return;
      }
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
      img.src = slide.image;
      return;
    }

    // Own image: composite text overlay via Canvas
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;

      // Draw base image
      ctx.drawImage(img, 0, 0);

      // Dark gradient lower-third
      const grad = ctx.createLinearGradient(0, img.height * 0.5, 0, img.height);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.82)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, img.width, img.height);

      // Title
      const titleSize = Math.round(img.width * 0.052);
      ctx.font = `700 ${titleSize}px sans-serif`;
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      const titleY = img.height * 0.76;
      ctx.fillText(slide.title, img.width / 2, titleY, img.width * 0.88);

      // Subtitle
      const subtitleSize = Math.round(img.width * 0.028);
      ctx.font = `${subtitleSize}px sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.78)";
      ctx.fillText(slide.subtitle, img.width / 2, titleY + titleSize * 1.55, img.width * 0.88);

      const a = document.createElement("a");
      a.href = canvas.toDataURL(format === "png" ? "image/png" : "image/jpeg", 0.92);
      a.download = `slide-${index + 1}.${format}`;
      a.click();
    };
    img.src = slide.image;
  }

  function downloadAll(format: "png" | "jpg") {
    slides.forEach((s, i) => downloadSlide(s, i, format));
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
            <p className="text-xs text-text-muted">AI-generated slides — 15 credits/slide &nbsp;·&nbsp; Own images — 5 credits/slide</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
      </button>

      {expanded && (
        <div className="border-t border-bg-border p-5 space-y-5">

          {/* Mode toggle */}
          <div className="flex rounded-lg border border-bg-border overflow-hidden text-xs font-medium">
            <button
              onClick={() => { setMode("ai"); setSlides([]); }}
              className={`flex-1 py-2 transition ${mode === "ai" ? "bg-white/10 text-text" : "text-text-muted hover:text-text hover:bg-white/[0.03]"}`}
            >
              AI Backgrounds
            </button>
            <button
              onClick={() => { setMode("own"); setSlides([]); }}
              className={`flex-1 py-2 transition border-l border-bg-border ${mode === "own" ? "bg-white/10 text-text" : "text-text-muted hover:text-text hover:bg-white/[0.03]"}`}
            >
              My Images
            </button>
          </div>

          {/* Own image upload area */}
          {mode === "own" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-text-muted">
                  Your images <span className="text-text-dim">({uploadedImages.length}/10)</span>
                </label>
                {uploadedImages.length < 10 && (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-md border border-bg-border bg-bg px-3 py-1.5 text-xs text-text-muted hover:text-text hover:border-white/20 transition"
                    disabled={generating}
                  >
                    <Upload className="h-3 w-3" /> Add images
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>

              {uploadedImages.length === 0 ? (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-bg-border py-8 text-text-muted hover:border-white/20 hover:text-text transition"
                  disabled={generating}
                >
                  <Upload className="h-5 w-5" />
                  <span className="text-xs">Click to upload images (PNG, JPG, WebP)</span>
                  <span className="text-[11px] text-text-dim">Up to 10 images — one slide per image</span>
                </button>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {uploadedImages.map((src, i) => (
                    <div key={i} className="relative aspect-video rounded-lg overflow-hidden border border-bg-border bg-bg-panel group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`Upload ${i + 1}`} className="h-full w-full object-cover" />
                      <button
                        onClick={() => removeImage(i)}
                        className="absolute top-1 right-1 rounded-full bg-black/70 p-0.5 opacity-0 group-hover:opacity-100 transition hover:bg-red-900/80"
                        disabled={generating}
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 py-0.5 text-[9px] text-white">{i + 1}</span>
                    </div>
                  ))}
                  {uploadedImages.length < 10 && (
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="aspect-video rounded-lg border border-dashed border-bg-border flex items-center justify-center text-text-dim hover:text-text-muted hover:border-white/20 transition"
                      disabled={generating}
                    >
                      <Upload className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">
              {mode === "own" ? "Context / theme (used to generate slide titles)" : "Describe your slideshow"}
            </label>
            <textarea
              className="input w-full resize-none"
              rows={3}
              placeholder={
                mode === "own"
                  ? "e.g. A product launch for our new running shoe collection..."
                  : "e.g. A pitch deck for a SaaS startup that helps e-commerce brands automate their social media..."
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={generating}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Font */}
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">
                {mode === "own" ? "Overlay text font" : "Font"}
              </label>
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

            {/* Slide count — only shown in AI mode */}
            {mode === "ai" && (
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
            )}

            {/* Credit info for own mode */}
            {mode === "own" && uploadedImages.length > 0 && (
              <div className="flex items-end">
                <p className="text-xs text-text-muted">
                  {uploadedImages.length} slide{uploadedImages.length !== 1 ? "s" : ""} &times; 5 credits
                  {" = "}<span className="font-semibold text-text">{cost} credits</span>
                </p>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-300">{error}</p>}

          <button
            onClick={generate}
            disabled={generating || !description.trim() || (mode === "own" && uploadedImages.length === 0)}
            className="btn-primary w-full"
          >
            {generating
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating {effectiveCount} slide{effectiveCount !== 1 ? "s" : ""}&hellip;</>
              : <><Sparkles className="h-4 w-4" /> Generate Slideshow &mdash; {cost} credits</>
            }
          </button>

          {generating && (
            <div className="text-center py-4 text-xs text-text-muted space-y-1">
              <p>
                {mode === "own"
                  ? `Analysing ${effectiveCount} image${effectiveCount !== 1 ? "s" : ""} and generating titles…`
                  : `Generating ${effectiveCount} slides — this may take up to ${effectiveCount * 10} seconds`
                }
              </p>
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

              {mode === "own" && (
                <p className="text-[11px] text-text-dim">
                  Preview shows text overlay. Download composites the title and subtitle onto your image.
                </p>
              )}

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
                      {/* Text overlay for own-image slides */}
                      {mode === "own" && (
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-3">
                          <p className="text-white text-xs font-bold leading-tight line-clamp-2">{slide.title}</p>
                          {slide.subtitle && (
                            <p className="text-white/75 text-[10px] leading-tight mt-0.5 line-clamp-1">{slide.subtitle}</p>
                          )}
                        </div>
                      )}
                      <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                        {i + 1}
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-medium truncate">{slide.title}</p>
                      <p className="text-[11px] text-text-muted truncate">{slide.subtitle}</p>
                      <div className="mt-2 flex gap-1.5">
                        <button
                          onClick={() => downloadSlide(slide, i, "png")}
                          className="flex-1 rounded-md border border-bg-border bg-bg py-1 text-[11px] text-text-muted hover:text-text hover:border-white/20 transition"
                        >
                          PNG
                        </button>
                        <button
                          onClick={() => downloadSlide(slide, i, "jpg")}
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
