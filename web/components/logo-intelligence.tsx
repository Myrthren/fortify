"use client";

import { useState, useRef } from "react";
import {
  Loader2, Download, Sparkles, Upload, ImageIcon,
  CheckCircle, XCircle, RefreshCw, Wand2, Plus, X
} from "lucide-react";

type Tab = "generate" | "enhance";

const ASPECT_RATIOS = [
  { label: "500 × 500", value: "500x500", desc: "Square logo" },
  { label: "160 × 600", value: "160x600", desc: "Skyscraper" },
  { label: "728 × 90",  value: "728x90",  desc: "Leaderboard" },
  { label: "325 × 250", value: "325x250", desc: "Rectangle" },
];

export function LogoIntelligence({ credits }: { credits: number }) {
  const [tab, setTab] = useState<Tab>("generate");

  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg border border-bg-border bg-bg-panel p-1 w-fit">
        {(["generate", "enhance"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              tab === t
                ? "bg-white/[0.08] text-text"
                : "text-text-muted hover:text-text"
            }`}
          >
            {t === "generate" ? "Logo Generator" : "Logo Enhancer"}
          </button>
        ))}
      </div>

      {tab === "generate" ? (
        <LogoGenerator credits={credits} />
      ) : (
        <LogoEnhancer credits={credits} />
      )}
    </div>
  );
}

// ── Logo Generator ────────────────────────────────────────────────────────────

function LogoGenerator({ credits }: { credits: number }) {
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("500x500");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [criteria, setCriteria] = useState("");
  const [generatingCriteria, setGeneratingCriteria] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refFileRef = useRef<HTMLInputElement>(null);

  async function addReferenceImage(file: File) {
    if (referenceImages.length >= 3) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setReferenceImages((prev) => [...prev, dataUrl]);
    };
    reader.readAsDataURL(file);
  }

  async function generateCriteria() {
    if (!referenceImages.length) return;
    setGeneratingCriteria(true);
    try {
      const res = await fetch("/api/logo/criteria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: referenceImages, description: prompt }),
      });
      const d = await res.json();
      if (res.ok) setCriteria(d.criteria ?? "");
      else setError(d.error ?? "Failed to analyse references");
    } finally {
      setGeneratingCriteria(false);
    }
  }

  async function generate() {
    if (!prompt.trim()) { setError("Describe what you want"); return; }
    if (credits < 150) { setError("Need 150 credits"); return; }
    setError(null);
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch("/api/logo/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, aspectRatio, criteria }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Generation failed"); return; }
      setResult(d.image);
    } finally {
      setGenerating(false);
    }
  }

  function downloadImage() {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result;
    a.download = `logo-${aspectRatio}.png`;
    a.click();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left: form */}
      <div className="space-y-5">
        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1.5">
            Describe your logo <span className="text-text-dim">(what it represents, your brand)</span>
          </label>
          <textarea
            className="input w-full resize-none"
            rows={3}
            placeholder="e.g. A minimalist tech startup logo for a company called Fortify that builds business tools. Modern, bold, black and white."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        {/* Aspect ratio */}
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1.5">Size preset</label>
          <div className="grid grid-cols-2 gap-2">
            {ASPECT_RATIOS.map((ar) => (
              <button
                key={ar.value}
                onClick={() => setAspectRatio(ar.value)}
                className={`rounded-lg border p-2.5 text-left transition ${
                  aspectRatio === ar.value
                    ? "border-white/20 bg-white/[0.06]"
                    : "border-bg-border hover:border-white/10 hover:bg-white/[0.03]"
                }`}
              >
                <p className="text-xs font-semibold">{ar.label}</p>
                <p className="text-[11px] text-text-muted">{ar.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Reference images */}
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1.5">
            Reference images <span className="text-text-dim">(up to 3, optional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {referenceImages.map((img, i) => (
              <div key={i} className="relative h-16 w-16 rounded-lg overflow-hidden border border-bg-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt="" className="h-full w-full object-cover" />
                <button
                  onClick={() => setReferenceImages((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute right-0.5 top-0.5 rounded-full bg-black/70 p-0.5 text-white"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
            {referenceImages.length < 3 && (
              <button
                onClick={() => refFileRef.current?.click()}
                className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-bg-border text-text-muted hover:border-white/20 hover:text-text transition"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
          <input
            type="file"
            ref={refFileRef}
            className="hidden"
            accept="image/*"
            onChange={(e) => { if (e.target.files?.[0]) addReferenceImage(e.target.files[0]); e.target.value = ""; }}
          />

          {referenceImages.length > 0 && (
            <button
              onClick={generateCriteria}
              disabled={generatingCriteria}
              className="mt-2 flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition"
            >
              {generatingCriteria ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Analyse references &rarr; generate criteria
            </button>
          )}
        </div>

        {/* Criteria (editable) */}
        {criteria && (
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">
              AI-generated criteria <span className="text-text-dim">(editable)</span>
            </label>
            <textarea
              className="input w-full resize-none text-xs"
              rows={4}
              value={criteria}
              onChange={(e) => setCriteria(e.target.value)}
            />
          </div>
        )}

        {error && (
          <p className="text-xs text-red-300 flex items-center gap-1.5">
            <XCircle className="h-3.5 w-3.5" /> {error}
          </p>
        )}

        <button
          onClick={generate}
          disabled={generating || !prompt.trim()}
          className="btn-primary w-full"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {generating ? "Generating…" : "Generate Logo — 150 credits"}
        </button>
      </div>

      {/* Right: result */}
      <div className="flex flex-col items-center justify-center rounded-xl border border-bg-border bg-bg-panel p-6 min-h-64">
        {generating ? (
          <div className="text-center space-y-3 text-text-muted">
            <Loader2 className="mx-auto h-8 w-8 animate-spin" />
            <p className="text-sm">Creating your logo…</p>
            <p className="text-xs">This usually takes 15–30 seconds</p>
          </div>
        ) : result ? (
          <div className="space-y-4 w-full">
            <div className="rounded-lg overflow-hidden border border-bg-border bg-white/[0.02] flex items-center justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result} alt="Generated logo" className="max-h-64 max-w-full object-contain" />
            </div>
            <div className="flex gap-2">
              <button onClick={downloadImage} className="btn-secondary flex-1 text-sm">
                <Download className="h-3.5 w-3.5" /> Download
              </button>
              <button onClick={generate} disabled={generating} className="btn-ghost text-sm">
                <RefreshCw className="h-3.5 w-3.5" /> Regenerate
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center text-text-muted space-y-2">
            <ImageIcon className="mx-auto h-8 w-8 opacity-30" />
            <p className="text-sm">Your logo will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Logo Enhancer ─────────────────────────────────────────────────────────────

type Analysis = {
  strengths: string[];
  weaknesses: string[];
  overallScore: number;
  summary: string;
};

function LogoEnhancer({ credits }: { credits: number }) {
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [aspectRatio, setAspectRatio] = useState("500x500");
  const [enhancing, setEnhancing] = useState(false);
  const [enhanced, setEnhanced] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileUpload(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      setLogoImage(e.target?.result as string);
      setAnalysis(null);
      setEnhanced(null);
    };
    reader.readAsDataURL(file);
  }

  async function analyse() {
    if (!logoImage) return;
    setAnalysing(true);
    setError(null);
    try {
      const res = await fetch("/api/logo/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: logoImage }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Analysis failed"); return; }
      setAnalysis(d);
    } finally {
      setAnalysing(false);
    }
  }

  async function enhance() {
    if (!logoImage) return;
    if (credits < 100) { setError("Need 100 credits"); return; }
    setEnhancing(true);
    setError(null);
    setEnhanced(null);
    try {
      const res = await fetch("/api/logo/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: logoImage, instructions, aspectRatio }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Enhancement failed"); return; }
      setEnhanced(d.image);
    } finally {
      setEnhancing(false);
    }
  }

  function downloadImage(img: string, suffix: string) {
    const a = document.createElement("a");
    a.href = img;
    a.download = `logo-${suffix}.png`;
    a.click();
  }

  const scoreColor = (s: number) => s >= 7 ? "text-green-400" : s >= 5 ? "text-amber-400" : "text-red-400";

  return (
    <div className="space-y-5">
      {/* Upload */}
      {!logoImage ? (
        <div
          onClick={() => fileRef.current?.click()}
          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-bg-border p-12 cursor-pointer hover:border-white/20 hover:bg-white/[0.02] transition text-center"
        >
          <Upload className="mb-3 h-8 w-8 text-text-muted" />
          <p className="text-sm font-medium">Upload your existing logo</p>
          <p className="text-xs text-text-muted mt-1">PNG, JPG, SVG — up to 10MB</p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Uploaded logo + analysis */}
          <div className="space-y-4">
            <div className="relative">
              <div className="rounded-xl border border-bg-border bg-bg-panel p-4 flex items-center justify-center min-h-40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoImage} alt="Your logo" className="max-h-48 max-w-full object-contain" />
              </div>
              <button
                onClick={() => { setLogoImage(null); setAnalysis(null); setEnhanced(null); }}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <button onClick={analyse} disabled={analysing} className="btn-secondary w-full text-sm">
              {analysing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {analysis ? "Re-analyse" : "Analyse logo"}
            </button>

            {analysis && (
              <div className="card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Analysis</p>
                  <span className={`text-lg font-bold tabular-nums ${scoreColor(analysis.overallScore)}`}>
                    {analysis.overallScore}<span className="text-xs font-normal text-text-muted">/10</span>
                  </span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">{analysis.summary}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-green-400 mb-1.5">Strengths</p>
                    <ul className="space-y-1">
                      {analysis.strengths.map((s, i) => (
                        <li key={i} className="flex gap-1.5 text-xs">
                          <CheckCircle className="h-3 w-3 text-green-400 shrink-0 mt-0.5" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-red-400 mb-1.5">Weaknesses</p>
                    <ul className="space-y-1">
                      {analysis.weaknesses.map((s, i) => (
                        <li key={i} className="flex gap-1.5 text-xs">
                          <XCircle className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Enhancement form */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">
                Additional instructions <span className="text-text-dim">(optional)</span>
              </label>
              <textarea
                className="input w-full resize-none text-sm"
                rows={4}
                placeholder="e.g. Make the colours more vibrant, simplify the icon, increase contrast for dark backgrounds…"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </div>

            {/* Size preset */}
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Output size</label>
              <div className="grid grid-cols-2 gap-2">
                {ASPECT_RATIOS.map((ar) => (
                  <button
                    key={ar.value}
                    onClick={() => setAspectRatio(ar.value)}
                    className={`rounded-lg border p-2 text-left transition text-xs ${
                      aspectRatio === ar.value
                        ? "border-white/20 bg-white/[0.06]"
                        : "border-bg-border hover:border-white/10"
                    }`}
                  >
                    <p className="font-semibold">{ar.label}</p>
                    <p className="text-text-muted text-[10px]">{ar.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-xs text-red-300">{error}</p>}

            <button
              onClick={enhance}
              disabled={enhancing}
              className="btn-primary w-full"
            >
              {enhancing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {enhancing ? "Enhancing…" : "Enhance Logo — 100 credits"}
            </button>

            {enhanced && (
              <div className="space-y-3">
                <div className="rounded-xl border border-bg-border bg-bg-panel p-4 flex items-center justify-center min-h-40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={enhanced} alt="Enhanced logo" className="max-h-48 max-w-full object-contain" />
                </div>
                <button onClick={() => downloadImage(enhanced, "enhanced")} className="btn-secondary w-full text-sm">
                  <Download className="h-3.5 w-3.5" /> Download enhanced logo
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <input
        type="file"
        ref={fileRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); e.target.value = ""; }}
      />
    </div>
  );
}
