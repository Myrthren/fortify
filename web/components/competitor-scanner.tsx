"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Plus, Trash2, RefreshCw, ExternalLink, Target, Youtube, Play, Star, TrendingUp,
  Instagram, Twitter, Search,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Report = {
  positioning: string;
  recentMoves: string[];
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  summary: string;
};

type YoutubeReport = {
  channelName?: string;
  subscriberCount?: string;
  postingFrequency?: string;
  topTopics?: string[];
  contentStyle?: string;
  topVideos?: { title: string; views: string; url: string }[];
  viralFormats?: string[];
  opportunities?: string[];
  summary?: string;
};

type TiktokReport = {
  username?: string;
  followerCount?: string;
  postingFrequency?: string;
  topTopics?: string[];
  contentStyle?: string;
  topPosts?: { description: string; likes: string; url: string }[];
  viralFormats?: string[];
  opportunities?: string[];
  summary?: string;
};

type InstagramReport = {
  username?: string;
  followerCount?: string;
  postingFrequency?: string;
  topTopics?: string[];
  contentStyle?: string;
  topPosts?: { caption: string; likes: string; type: string; url: string }[];
  viralFormats?: string[];
  opportunities?: string[];
  summary?: string;
};

type TwitterReport = {
  username?: string;
  followerCount?: string;
  postingFrequency?: string;
  topTopics?: string[];
  contentStyle?: string;
  topTweets?: { text: string; likes: string; retweets: string }[];
  viralFormats?: string[];
  opportunities?: string[];
  summary?: string;
};

type SerpReport = {
  organicPositions?: { position: number; title: string; url: string; description: string }[];
  paidAds?: { title: string; url: string; description: string }[];
  relatedQueries?: string[];
  isRanking?: boolean;
  highestPosition?: number | null;
  totalAds?: number;
  opportunities?: string[];
  summary?: string;
};

type Competitor = {
  id: string;
  name: string;
  url: string;
  lastReport: Report | null;
  lastScanned: string | null;
  youtubeHandle: string | null;
  tiktokHandle: string | null;
  instagramHandle: string | null;
  twitterHandle: string | null;
  youtubeReport: YoutubeReport | null;
  tiktokReport: TiktokReport | null;
  instagramReport: InstagramReport | null;
  twitterReport: TwitterReport | null;
  youtubeScanAt: string | null;
  tiktokScanAt: string | null;
  instagramScanAt: string | null;
  twitterScanAt: string | null;
  changeReport: ChangeReport | null;
  changeDetectedAt: string | null;
  reviewReport: ReviewReport | null;
  reviewScannedAt: string | null;
  metaAdReport: MetaAdReport | null;
  metaAdScanAt: string | null;
  serpReport: SerpReport | null;
  serpScanAt: string | null;
  createdAt: string;
};

type Tab = "website" | "youtube" | "tiktok" | "instagram" | "twitter" | "serp" | "reviews" | "metaads";

type ChangeReport = {
  changes: string[];
  brief: string;
};

type ReviewReport = {
  sentiment: "positive" | "mixed" | "negative";
  topComplaints: string[];
  topPraises: string[];
  opportunities: string[];
  summary: string;
};

type MetaAdReport = {
  totalAds?: number;
  activeAds?: number;
  adAngles?: string[];
  topCtaPatterns?: string[];
  offerFrameworks?: string[];
  spendLevel?: string;
  platforms?: string[];
  topAds?: { headline?: string; body?: string; format?: string; cta?: string; url?: string }[];
  summary?: string;
};

// ─── Main component ───────────────────────────────────────────────────────────

export function CompetitorScanner({
  initial,
  limit,
  userCredits,
}: {
  initial: Competitor[];
  limit: number; // -1 = unlimited
  userCredits: number;
}) {
  const router = useRouter();
  const [list, setList] = useState<Competitor[]>(initial);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(initial[0]?.id ?? null);
  const [credits, setCredits] = useState(userCredits);

  const atCapacity = limit !== -1 && list.length >= limit;
  const open = list.find((c) => c.id === openId) ?? null;

  function add() {
    setAddError(null);
    if (!name.trim()) { setAddError("Name required"); return; }
    if (url.trim().length < 4) { setAddError("URL required"); return; }
    startTransition(async () => {
      const res = await fetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url }),
      });
      if (!res.ok) {
        const data = await res.json().catch(async () => ({ error: await res.text() }));
        setAddError(data.error ?? "Failed");
        return;
      }
      const data = await res.json();
      const c: Competitor = {
        id: data.competitor.id,
        name: data.competitor.name,
        url: data.competitor.url,
        lastReport: null,
        lastScanned: null,
        youtubeHandle: null,
        tiktokHandle: null,
        instagramHandle: null,
        twitterHandle: null,
        youtubeReport: null,
        tiktokReport: null,
        instagramReport: null,
        twitterReport: null,
        youtubeScanAt: null,
        tiktokScanAt: null,
        instagramScanAt: null,
        twitterScanAt: null,
        changeReport: null,
        changeDetectedAt: null,
        reviewReport: null,
        reviewScannedAt: null,
        metaAdReport: null,
        metaAdScanAt: null,
        serpReport: null,
        serpScanAt: null,
        createdAt: new Date(data.competitor.createdAt).toISOString(),
      };
      setList((prev) => [c, ...prev]);
      setName("");
      setUrl("");
      setOpenId(c.id);
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("Remove this competitor?")) return;
    startTransition(async () => {
      await fetch(`/api/competitors/${id}`, { method: "DELETE" });
      setList((prev) => {
        const next = prev.filter((c) => c.id !== id);
        if (openId === id) setOpenId(next[0]?.id ?? null);
        return next;
      });
      router.refresh();
    });
  }

  function patchCompetitor(id: string, patch: Partial<Competitor>) {
    setList((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  return (
    <div className="space-y-6">
      {/* Add competitor */}
      <div className="card p-5">
        <label className="block text-xs font-medium uppercase tracking-wide text-text-muted">
          Track a competitor
        </label>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            className="input sm:w-1/3"
            placeholder="Name (e.g. Vercel)"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            disabled={pending || atCapacity}
          />
          <input
            className="input flex-1"
            placeholder="vercel.com"
            value={url}
            maxLength={300}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            disabled={pending || atCapacity}
          />
          <button onClick={add} disabled={pending || atCapacity} className="btn-primary">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {atCapacity ? "Limit reached" : "Track"}
          </button>
        </div>
        {addError && (
          <div className="mt-3 rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-300">
            {addError}
          </div>
        )}
      </div>

      {/* Competitor chips */}
      {list.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {list.map((c) => (
            <button
              key={c.id}
              onClick={() => setOpenId(c.id)}
              className={`group inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition ${
                openId === c.id
                  ? "border-white/40 bg-white/10 text-white"
                  : "border-bg-border bg-bg-elevated text-text-muted hover:text-text"
              }`}
            >
              {c.name}
              <span
                onClick={(e) => { e.stopPropagation(); remove(c.id); }}
                className="text-text-dim hover:text-red-300"
                role="button"
                aria-label="remove"
              >
                <Trash2 className="h-3 w-3" />
              </span>
            </button>
          ))}
        </div>
      )}

      {list.length === 0 && (
        <p className="text-center text-sm text-text-muted">
          Add your first competitor to start tracking.
        </p>
      )}

      {/* Detail panel — keyed so state fully resets when switching competitors */}
      {open && (
        <CompetitorDetail
          key={open.id}
          competitor={open}
          credits={credits}
          onPatch={(patch) => patchCompetitor(open.id, patch)}
          onCreditsSpent={(n) => setCredits((c) => c - n)}
        />
      )}
    </div>
  );
}

// ─── CompetitorDetail ─────────────────────────────────────────────────────────
// Keyed by competitor.id, so all state resets when a different competitor is opened.

function CompetitorDetail({
  competitor,
  credits,
  onPatch,
  onCreditsSpent,
}: {
  competitor: Competitor;
  credits: number;
  onPatch: (patch: Partial<Competitor>) => void;
  onCreditsSpent: (n: number) => void;
}) {
  const [tab, setTab] = useState<Tab>("website");

  // Website scan
  const [websiteScanning, setWebsiteScanning] = useState(false);
  const [websiteError, setWebsiteError] = useState<string | null>(null);

  // Reviews scan
  const [reviewScanning, setReviewScanning] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  async function doReviewScan() {
    setReviewScanning(true);
    setReviewError(null);
    try {
      const res = await fetch(`/api/competitors/${competitor.id}/reviews`, { method: "POST" });
      if (!res.ok) { setReviewError(await res.text()); return; }
      const data = await res.json();
      onPatch({
        reviewReport: data.report,
        reviewScannedAt: data.reviewScannedAt
          ? new Date(data.reviewScannedAt).toISOString()
          : new Date().toISOString(),
      });
    } catch (e: any) {
      setReviewError(e.message ?? "Review scan failed");
    } finally {
      setReviewScanning(false);
    }
  }

  // Meta Ads scan
  const [adsScanning, setAdsScanning] = useState(false);
  const [adsError, setAdsError] = useState<string | null>(null);
  const adsPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function doAdsScan() {
    setAdsScanning(true);
    setAdsError(null);
    try {
      const res = await fetch(`/api/competitors/${competitor.id}/scan-ads`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setAdsError(data.error ?? "Failed to start scan");
        setAdsScanning(false);
        return;
      }
      onCreditsSpent(50);
      const { runId } = data as { runId: string };

      if (adsPollRef.current) clearInterval(adsPollRef.current);
      adsPollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/competitors/${competitor.id}/scan-ads?runId=${runId}`);
          const pollData = await pollRes.json();

          if (pollData.status === "running") return;

          clearInterval(adsPollRef.current!);
          adsPollRef.current = null;
          setAdsScanning(false);

          if (pollData.status === "succeeded" && pollData.report) {
            onPatch({ metaAdReport: pollData.report, metaAdScanAt: new Date().toISOString() });
          } else {
            setAdsError(pollData.error ?? "Scan failed. Try again.");
          }
        } catch {
          clearInterval(adsPollRef.current!);
          adsPollRef.current = null;
          setAdsScanning(false);
          setAdsError("Lost connection while polling. Refresh and try again.");
        }
      }, 5000);
    } catch (e: any) {
      setAdsScanning(false);
      setAdsError(e.message ?? "Failed");
    }
  }

  // Social scan
  const [ytHandle, setYtHandle] = useState(competitor.youtubeHandle ?? "");
  const [ttHandle, setTtHandle] = useState(competitor.tiktokHandle ?? "");
  const [igHandle, setIgHandle] = useState(competitor.instagramHandle ?? "");
  const [twHandle, setTwHandle] = useState(competitor.twitterHandle ?? "");
  const [scanningPlatform, setScanningPlatform] = useState<"youtube" | "tiktok" | "instagram" | "twitter" | null>(null);
  const [socialError, setSocialError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // SERP scan
  const [serpScanning, setSerpScanning] = useState(false);
  const [serpError, setSerpError] = useState<string | null>(null);
  const serpPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function doSerpScan() {
    setSerpScanning(true);
    setSerpError(null);
    try {
      const res = await fetch(`/api/competitors/${competitor.id}/scan-serp`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSerpError(data.error ?? "Failed to start SERP scan");
        setSerpScanning(false);
        return;
      }
      onCreditsSpent(35);
      const { runId } = data as { runId: string };

      if (serpPollRef.current) clearInterval(serpPollRef.current);
      serpPollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/competitors/${competitor.id}/scan-serp?runId=${runId}`);
          const pollData = await pollRes.json();

          if (pollData.status === "running") return;

          clearInterval(serpPollRef.current!);
          serpPollRef.current = null;
          setSerpScanning(false);

          if (pollData.status === "succeeded" && pollData.report) {
            onPatch({ serpReport: pollData.report, serpScanAt: new Date().toISOString() });
          } else {
            setSerpError(pollData.error ?? "SERP scan failed. Try again.");
          }
        } catch {
          clearInterval(serpPollRef.current!);
          serpPollRef.current = null;
          setSerpScanning(false);
          setSerpError("Lost connection while polling. Refresh and try again.");
        }
      }, 5000);
    } catch (e: any) {
      setSerpScanning(false);
      setSerpError(e.message ?? "Failed");
    }
  }

  async function doWebsiteScan() {
    setWebsiteScanning(true);
    setWebsiteError(null);
    try {
      const res = await fetch(`/api/competitors/${competitor.id}/scan`, { method: "POST" });
      if (!res.ok) {
        setWebsiteError(await res.text());
        return;
      }
      const data = await res.json();
      onPatch({
        lastReport: data.competitor.lastReport,
        lastScanned: data.competitor.lastScanned
          ? new Date(data.competitor.lastScanned).toISOString()
          : null,
      });
    } catch (e: any) {
      setWebsiteError(e.message ?? "Scan failed");
    } finally {
      setWebsiteScanning(false);
    }
  }

  async function doSocialScan(platform: "youtube" | "tiktok" | "instagram" | "twitter") {
    const handleMap = { youtube: ytHandle, tiktok: ttHandle, instagram: igHandle, twitter: twHandle };
    const handle = handleMap[platform].trim().replace(/^@/, "");
    if (!handle) { setSocialError("Enter a handle first"); return; }

    setSocialError(null);
    setScanningPlatform(platform);

    try {
      const res = await fetch(`/api/competitors/${competitor.id}/scan-social`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, handle }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSocialError(data.error ?? "Failed to start scan");
        setScanningPlatform(null);
        return;
      }

      onCreditsSpent(50);
      const { runId } = data as { runId: string };

      // Clear any previous interval
      if (pollRef.current) clearInterval(pollRef.current);

      pollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(
            `/api/competitors/${competitor.id}/scan-social?runId=${runId}&platform=${platform}`
          );
          const pollData = await pollRes.json();

          if (pollData.status === "running") return;

          clearInterval(pollRef.current!);
          pollRef.current = null;
          setScanningPlatform(null);

          if (pollData.status === "succeeded" && pollData.report) {
            const now = new Date().toISOString();
            if (platform === "youtube") {
              onPatch({ youtubeReport: pollData.report, youtubeScanAt: now, youtubeHandle: handle });
            } else if (platform === "tiktok") {
              onPatch({ tiktokReport: pollData.report, tiktokScanAt: now, tiktokHandle: handle });
            } else if (platform === "instagram") {
              onPatch({ instagramReport: pollData.report, instagramScanAt: now, instagramHandle: handle });
            } else {
              onPatch({ twitterReport: pollData.report, twitterScanAt: now, twitterHandle: handle });
            }
          } else {
            setSocialError(pollData.error ?? "Scan failed. Check the handle and try again.");
          }
        } catch {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setScanningPlatform(null);
          setSocialError("Lost connection while polling. Refresh and try again.");
        }
      }, 5000);
    } catch (e: any) {
      setScanningPlatform(null);
      setSocialError(e.message ?? "Failed");
    }
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "website",   label: "Website",   icon: <Target className="h-3.5 w-3.5" /> },
    { key: "youtube",   label: "YouTube",   icon: <Youtube className="h-3.5 w-3.5" /> },
    { key: "tiktok",    label: "TikTok",    icon: <Play className="h-3.5 w-3.5" /> },
    { key: "instagram", label: "Instagram", icon: <Instagram className="h-3.5 w-3.5" /> },
    { key: "twitter",   label: "X / Twitter", icon: <Twitter className="h-3.5 w-3.5" /> },
    { key: "serp",      label: "SERP",      icon: <Search className="h-3.5 w-3.5" /> },
    { key: "reviews",   label: "Reviews",   icon: <Star className="h-3.5 w-3.5" /> },
    { key: "metaads",   label: "Meta Ads",  icon: <TrendingUp className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-5">
      {/* Competitor header */}
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="font-semibold">{competitor.name}</p>
          <a
            href={competitor.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text"
          >
            {competitor.url}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <span className="rounded-md border border-bg-border bg-bg-panel px-2 py-1 text-xs tabular-nums text-text-muted">
          {credits.toLocaleString()} credits
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-bg-border bg-bg-panel p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm transition ${
              tab === t.key
                ? "bg-white/10 font-medium text-text"
                : "text-text-muted hover:text-text"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Website tab ── */}
      {tab === "website" && (
        <div className="space-y-4">
          {/* Change detection alert */}
          {competitor.changeDetectedAt &&
            Date.now() - new Date(competitor.changeDetectedAt).getTime() < 7 * 24 * 60 * 60 * 1000 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
              <p className="font-medium text-amber-300">New activity detected this week</p>
              {(competitor.changeReport?.changes ?? []).slice(0, 3).map((c, i) => (
                <p key={i} className="mt-1 text-xs text-amber-200/80">· {c}</p>
              ))}
              {competitor.changeReport?.brief && (
                <p className="mt-2 text-xs text-amber-200/70 italic">{competitor.changeReport.brief}</p>
              )}
              <p className="mt-2 text-xs text-text-muted">Re-scan for a fresh full report.</p>
            </div>
          )}
          <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              {competitor.lastScanned && (
                <p className="text-xs text-text-muted">
                  Last scanned {new Date(competitor.lastScanned).toLocaleString()}
                </p>
              )}
            </div>
            <button
              onClick={doWebsiteScan}
              disabled={websiteScanning}
              className="btn-secondary text-xs"
            >
              {websiteScanning
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5" />}
              {competitor.lastReport ? "Re-scan" : "Scan now"}
            </button>
          </div>

          {websiteError && (
            <div className="rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-300">
              {websiteError}
            </div>
          )}

          {websiteScanning && (
            <div className="flex flex-col items-center gap-2 py-6 text-sm text-text-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Fetching site + news + analysing — usually 10-25 seconds…</span>
            </div>
          )}

          {competitor.lastReport && !websiteScanning && (
            <ReportView report={competitor.lastReport} />
          )}

          {!competitor.lastReport && !websiteScanning && !websiteError && (
            <div className="card p-8 text-center text-sm text-text-muted">
              <Target className="mx-auto h-5 w-5" />
              <p className="mt-3">Click "Scan now" to generate the first intel report.</p>
            </div>
          )}
        </div>
      )}

      {/* ── YouTube tab ── */}
      {tab === "youtube" && (
        <SocialTab
          platform="youtube"
          handle={ytHandle}
          setHandle={setYtHandle}
          report={competitor.youtubeReport}
          scanAt={competitor.youtubeScanAt}
          scanning={scanningPlatform === "youtube"}
          credits={credits}
          error={socialError}
          onScan={() => doSocialScan("youtube")}
          renderReport={(r) => <YoutubeReportView report={r as YoutubeReport} />}
          placeholder="e.g. mkbhd  (with or without @)"
          creditCost={50}
        />
      )}

      {/* ── TikTok tab ── */}
      {tab === "tiktok" && (
        <SocialTab
          platform="tiktok"
          handle={ttHandle}
          setHandle={setTtHandle}
          report={competitor.tiktokReport}
          scanAt={competitor.tiktokScanAt}
          scanning={scanningPlatform === "tiktok"}
          credits={credits}
          error={socialError}
          onScan={() => doSocialScan("tiktok")}
          renderReport={(r) => <TiktokReportView report={r as TiktokReport} />}
          placeholder="e.g. nike  (no @)"
          creditCost={50}
        />
      )}

      {/* ── Instagram tab ── */}
      {tab === "instagram" && (
        <SocialTab
          platform="instagram"
          handle={igHandle}
          setHandle={setIgHandle}
          report={competitor.instagramReport}
          scanAt={competitor.instagramScanAt}
          scanning={scanningPlatform === "instagram"}
          credits={credits}
          error={socialError}
          onScan={() => doSocialScan("instagram")}
          renderReport={(r) => <InstagramReportView report={r as InstagramReport} />}
          placeholder="e.g. nike  (no @)"
          creditCost={50}
        />
      )}

      {/* ── Twitter tab ── */}
      {tab === "twitter" && (
        <SocialTab
          platform="twitter"
          handle={twHandle}
          setHandle={setTwHandle}
          report={competitor.twitterReport}
          scanAt={competitor.twitterScanAt}
          scanning={scanningPlatform === "twitter"}
          credits={credits}
          error={socialError}
          onScan={() => doSocialScan("twitter")}
          renderReport={(r) => <TwitterReportView report={r as TwitterReport} />}
          placeholder="e.g. elonmusk  (no @)"
          creditCost={50}
        />
      )}

      {/* ── SERP tab ── */}
      {tab === "serp" && (
        <div className="space-y-4">
          <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              {competitor.serpScanAt && (
                <p className="text-xs text-text-muted">
                  Last scanned {new Date(competitor.serpScanAt).toLocaleString()}
                </p>
              )}
              <p className="text-xs text-text-muted mt-0.5">
                Google rankings, paid ads, and SEO opportunities
              </p>
              <p className="text-xs text-text-dim mt-0.5">
                Costs 35 credits · You have {credits.toLocaleString()}
              </p>
            </div>
            <button
              onClick={doSerpScan}
              disabled={serpScanning || credits < 35}
              className="btn-secondary text-xs"
            >
              {serpScanning
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5" />}
              {competitor.serpReport ? "Re-scan" : "Scan SERP"}
            </button>
          </div>

          {serpError && (
            <div className="rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-300">
              {serpError}
            </div>
          )}

          {serpScanning && (
            <div className="flex flex-col items-center gap-2 py-6 text-sm text-text-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Scanning Google — usually 20-40 seconds…</span>
            </div>
          )}

          {competitor.serpReport && !serpScanning && (
            <SerpReportView report={competitor.serpReport} />
          )}

          {!competitor.serpReport && !serpScanning && !serpError && (
            <div className="card p-8 text-center text-sm text-text-muted">
              <Search className="mx-auto h-5 w-5" />
              <p className="mt-3">Click "Scan SERP" to see how this competitor ranks on Google and what keywords they target.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Reviews tab ── */}
      {tab === "reviews" && (
        <div className="space-y-4">
          <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              {competitor.reviewScannedAt && (
                <p className="text-xs text-text-muted">
                  Last scanned {new Date(competitor.reviewScannedAt).toLocaleString()}
                </p>
              )}
              <p className="text-xs text-text-muted mt-0.5">
                Pulls from G2, Trustpilot, and Capterra
              </p>
            </div>
            <button
              onClick={doReviewScan}
              disabled={reviewScanning}
              className="btn-secondary text-xs"
            >
              {reviewScanning
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5" />}
              {competitor.reviewReport ? "Re-scan" : "Scan reviews"}
            </button>
          </div>

          {reviewError && (
            <div className="rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-300">
              {reviewError}
            </div>
          )}

          {reviewScanning && (
            <div className="flex flex-col items-center gap-2 py-6 text-sm text-text-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Searching review sites — usually 10-20 seconds…</span>
            </div>
          )}

          {competitor.reviewReport && !reviewScanning && (
            <ReviewReportView report={competitor.reviewReport} />
          )}

          {!competitor.reviewReport && !reviewScanning && !reviewError && (
            <div className="card p-8 text-center text-sm text-text-muted">
              <Star className="mx-auto h-5 w-5" />
              <p className="mt-3">Click "Scan reviews" to pull customer sentiment from review sites.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Meta Ads tab ── */}
      {tab === "metaads" && (
        <div className="space-y-4">
          <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              {competitor.metaAdScanAt && (
                <p className="text-xs text-text-muted">
                  Last scanned {new Date(competitor.metaAdScanAt).toLocaleString()}
                </p>
              )}
              <p className="text-xs text-text-muted mt-0.5">
                Pulls active ads from Meta Ad Library — AI-analysed
              </p>
              <p className="text-xs text-text-dim mt-0.5">
                Costs 50 credits · You have {credits.toLocaleString()}
              </p>
            </div>
            <button
              onClick={doAdsScan}
              disabled={adsScanning || credits < 50}
              className="btn-secondary text-xs"
            >
              {adsScanning
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5" />}
              {competitor.metaAdReport ? "Re-scan" : "Scan ads"}
            </button>
          </div>

          {adsError && (
            <div className="rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-300">
              {adsError}
            </div>
          )}

          {adsScanning && (
            <div className="flex flex-col items-center gap-2 py-6 text-sm text-text-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Scraping Meta Ad Library — usually 30-60 seconds…</span>
            </div>
          )}

          {competitor.metaAdReport && !adsScanning && (
            <MetaAdReportView report={competitor.metaAdReport} />
          )}

          {!competitor.metaAdReport && !adsScanning && !adsError && (
            <div className="card p-8 text-center text-sm text-text-muted">
              <TrendingUp className="mx-auto h-5 w-5" />
              <p className="mt-3">Click "Scan ads" to analyse your competitor's active Meta ad campaigns.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Social tab shell ─────────────────────────────────────────────────────────

function SocialTab({
  platform,
  handle,
  setHandle,
  report,
  scanAt,
  scanning,
  credits,
  error,
  onScan,
  renderReport,
  placeholder,
  creditCost,
}: {
  platform: string;
  handle: string;
  setHandle: (v: string) => void;
  report: unknown;
  scanAt: string | null;
  scanning: boolean;
  credits: number;
  error: string | null;
  onScan: () => void;
  renderReport: (r: unknown) => React.JSX.Element | null;
  placeholder: string;
  creditCost: number;
}) {
  return (
    <div className="space-y-4">
      <div className="card p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
          {{ youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram", twitter: "X / Twitter" }[platform] ?? platform} handle
        </p>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder={placeholder}
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !scanning && credits >= creditCost && onScan()}
            disabled={scanning}
          />
          <button
            onClick={onScan}
            disabled={scanning || credits < creditCost}
            className="btn-primary text-sm"
          >
            {scanning ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Scanning…</>
            ) : (
              <><RefreshCw className="h-3.5 w-3.5" /> {report ? "Re-scan" : "Scan"}</>
            )}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-text-muted">
          Costs {creditCost} credits · You have {credits.toLocaleString()} credits
        </p>
        {credits < creditCost && !scanning && (
          <p className="mt-2 text-xs text-amber-300">
            Not enough credits.{" "}
            <a href="/dashboard/credits" className="underline">Top up here</a>.
          </p>
        )}
        {error && (
          <div className="mt-3 rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
      </div>

      {scanning && (
        <div className="flex flex-col items-center gap-2 py-8 text-sm text-text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>
            Scraping {{ youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram", twitter: "X / Twitter" }[platform] ?? platform} — usually 30-90 seconds…
          </span>
        </div>
      )}

      {!!report && !scanning && (
        <div>
          {scanAt && (
            <p className="mb-3 text-xs text-text-muted">
              Last scanned {new Date(scanAt).toLocaleString()}
            </p>
          )}
          {renderReport(report)}
        </div>
      )}

      {!report && !scanning && (
        <div className="card p-8 text-center text-sm text-text-muted">
          <Play className="mx-auto h-5 w-5" />
          <p className="mt-3">
            Enter the handle and click Scan to generate an AI analysis.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Website report ───────────────────────────────────────────────────────────

function ReportView({ report }: { report: Report }) {
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <p className="text-xs uppercase tracking-wide text-text-muted">Positioning</p>
        <p className="mt-1 text-sm leading-relaxed">{report.positioning}</p>
      </div>
      <div className="card p-5">
        <p className="text-xs uppercase tracking-wide text-text-muted">Bottom line</p>
        <p className="mt-1 text-sm leading-relaxed">{report.summary}</p>
      </div>
      <Section title="Recent moves" items={report.recentMoves} accent="text-blue-300" />
      <Section title="Strengths" items={report.strengths} accent="text-green-400" />
      <Section title="Weaknesses" items={report.weaknesses} accent="text-orange-300" />
      <div className="card-elevated ring-1 ring-white/10 p-5">
        <p className="text-xs uppercase tracking-wide text-text-muted">Opportunities for you</p>
        <ol className="mt-2 space-y-2 text-sm">
          {report.opportunities.map((o, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium">
                {i + 1}
              </span>
              <span>{o}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ─── YouTube report ───────────────────────────────────────────────────────────

function YoutubeReportView({ report }: { report: YoutubeReport }) {
  return (
    <div className="space-y-4">
      {(report.channelName || report.subscriberCount || report.postingFrequency) && (
        <div className="card flex flex-wrap items-center gap-6 p-5">
          {report.channelName && (
            <div>
              <p className="text-xs text-text-muted">Channel</p>
              <p className="font-semibold">{report.channelName}</p>
            </div>
          )}
          {report.subscriberCount && (
            <div>
              <p className="text-xs text-text-muted">Subscribers</p>
              <p className="font-semibold">{report.subscriberCount}</p>
            </div>
          )}
          {report.postingFrequency && (
            <div>
              <p className="text-xs text-text-muted">Posting frequency</p>
              <p className="font-semibold">{report.postingFrequency}</p>
            </div>
          )}
        </div>
      )}
      {report.summary && (
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-text-muted">Summary</p>
          <p className="mt-1 text-sm leading-relaxed">{report.summary}</p>
        </div>
      )}
      {report.contentStyle && (
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-text-muted">Content style</p>
          <p className="mt-1 text-sm leading-relaxed">{report.contentStyle}</p>
        </div>
      )}
      <Section title="Top Topics" items={report.topTopics ?? []} accent="text-blue-300" />
      <Section title="Viral Formats" items={report.viralFormats ?? []} accent="text-purple-300" />
      {(report.topVideos ?? []).length > 0 && (
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-text-muted">Top Videos</p>
          <div className="mt-2 space-y-2">
            {report.topVideos!.map((v, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate">{v.title}</p>
                  <p className="text-xs text-text-muted">{v.views} views</p>
                </div>
                {v.url && (
                  <a href={v.url} target="_blank" rel="noreferrer" className="shrink-0 text-text-muted hover:text-text">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {(report.opportunities ?? []).length > 0 && (
        <div className="card-elevated ring-1 ring-white/10 p-5">
          <p className="text-xs uppercase tracking-wide text-text-muted">Opportunities for you</p>
          <ol className="mt-2 space-y-2 text-sm">
            {report.opportunities!.map((o, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium">
                  {i + 1}
                </span>
                <span>{o}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// ─── TikTok report ────────────────────────────────────────────────────────────

function TiktokReportView({ report }: { report: TiktokReport }) {
  return (
    <div className="space-y-4">
      {(report.username || report.followerCount || report.postingFrequency) && (
        <div className="card flex flex-wrap items-center gap-6 p-5">
          {report.username && (
            <div>
              <p className="text-xs text-text-muted">Username</p>
              <p className="font-semibold">@{report.username}</p>
            </div>
          )}
          {report.followerCount && (
            <div>
              <p className="text-xs text-text-muted">Followers</p>
              <p className="font-semibold">{report.followerCount}</p>
            </div>
          )}
          {report.postingFrequency && (
            <div>
              <p className="text-xs text-text-muted">Posting frequency</p>
              <p className="font-semibold">{report.postingFrequency}</p>
            </div>
          )}
        </div>
      )}
      {report.summary && (
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-text-muted">Summary</p>
          <p className="mt-1 text-sm leading-relaxed">{report.summary}</p>
        </div>
      )}
      {report.contentStyle && (
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-text-muted">Content style</p>
          <p className="mt-1 text-sm leading-relaxed">{report.contentStyle}</p>
        </div>
      )}
      <Section title="Top Topics" items={report.topTopics ?? []} accent="text-pink-300" />
      <Section title="Viral Formats" items={report.viralFormats ?? []} accent="text-purple-300" />
      {(report.topPosts ?? []).length > 0 && (
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-text-muted">Top Posts</p>
          <div className="mt-2 space-y-2">
            {report.topPosts!.map((p, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2">{p.description}</p>
                  <p className="text-xs text-text-muted">{p.likes} likes</p>
                </div>
                {p.url && (
                  <a href={p.url} target="_blank" rel="noreferrer" className="shrink-0 text-text-muted hover:text-text">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {(report.opportunities ?? []).length > 0 && (
        <div className="card-elevated ring-1 ring-white/10 p-5">
          <p className="text-xs uppercase tracking-wide text-text-muted">Opportunities for you</p>
          <ol className="mt-2 space-y-2 text-sm">
            {report.opportunities!.map((o, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium">
                  {i + 1}
                </span>
                <span>{o}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// ─── Review report ────────────────────────────────────────────────────────────

function ReviewReportView({ report }: { report: ReviewReport }) {
  const sentimentColor = {
    positive: "text-green-400",
    mixed: "text-amber-300",
    negative: "text-red-400",
  }[report.sentiment];

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <p className="text-xs uppercase tracking-wide text-text-muted">Overall sentiment</p>
        <p className={`mt-1 text-base font-semibold capitalize ${sentimentColor}`}>
          {report.sentiment}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">{report.summary}</p>
      </div>
      <Section title="What customers complain about" items={report.topComplaints} accent="text-red-400" />
      <Section title="What customers praise" items={report.topPraises} accent="text-green-400" />
      <div className="card-elevated ring-1 ring-white/10 p-5">
        <p className="text-xs uppercase tracking-wide text-text-muted">Positioning opportunities for you</p>
        <ol className="mt-2 space-y-2 text-sm">
          {report.opportunities.map((o, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium">
                {i + 1}
              </span>
              <span>{o}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ─── Meta Ads report ──────────────────────────────────────────────────────────

function MetaAdReportView({ report }: { report: MetaAdReport }) {
  return (
    <div className="space-y-4">
      {/* Stats row */}
      {(report.totalAds != null || report.spendLevel) && (
        <div className="card flex flex-wrap items-center gap-6 p-5">
          {report.totalAds != null && (
            <div>
              <p className="text-xs text-text-muted">Total ads found</p>
              <p className="font-semibold">{report.totalAds}</p>
            </div>
          )}
          {report.activeAds != null && (
            <div>
              <p className="text-xs text-text-muted">Active ads</p>
              <p className="font-semibold">{report.activeAds}</p>
            </div>
          )}
          {report.spendLevel && (
            <div>
              <p className="text-xs text-text-muted">Estimated spend level</p>
              <p className="font-semibold capitalize">{report.spendLevel}</p>
            </div>
          )}
          {(report.platforms ?? []).length > 0 && (
            <div>
              <p className="text-xs text-text-muted">Platforms</p>
              <p className="font-semibold">{report.platforms!.join(", ")}</p>
            </div>
          )}
        </div>
      )}

      {report.summary && (
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-text-muted">Summary</p>
          <p className="mt-1 text-sm leading-relaxed">{report.summary}</p>
        </div>
      )}

      <Section title="Ad angles being used" items={report.adAngles ?? []} accent="text-blue-300" />
      <Section title="Top CTA patterns" items={report.topCtaPatterns ?? []} accent="text-purple-300" />
      <Section title="Offer frameworks" items={report.offerFrameworks ?? []} accent="text-amber-300" />

      {(report.topAds ?? []).length > 0 && (
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-text-muted">Top ads</p>
          <div className="mt-3 space-y-4">
            {report.topAds!.map((ad, i) => (
              <div key={i} className="rounded-lg border border-bg-border bg-bg-elevated p-4 space-y-1.5">
                {ad.headline && (
                  <p className="text-sm font-semibold">{ad.headline}</p>
                )}
                {ad.body && (
                  <p className="text-xs text-text-muted leading-relaxed line-clamp-3">{ad.body}</p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  {ad.format && (
                    <span className="rounded border border-bg-border bg-bg px-2 py-0.5 text-[10px] text-text-muted">
                      {ad.format}
                    </span>
                  )}
                  {ad.cta && (
                    <span className="rounded border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[10px] text-purple-300">
                      {ad.cta}
                    </span>
                  )}
                </div>
                {ad.url && (
                  <a
                    href={ad.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-[11px] text-text-dim hover:text-text-muted transition pt-0.5"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View ad
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Instagram report ─────────────────────────────────────────────────────────

function InstagramReportView({ report }: { report: InstagramReport }) {
  return (
    <div className="space-y-4">
      {(report.username || report.followerCount || report.postingFrequency) && (
        <div className="card flex flex-wrap items-center gap-6 p-5">
          {report.username && (
            <div>
              <p className="text-xs text-text-muted">Username</p>
              <p className="font-semibold">@{report.username}</p>
            </div>
          )}
          {report.followerCount && (
            <div>
              <p className="text-xs text-text-muted">Followers</p>
              <p className="font-semibold">{report.followerCount}</p>
            </div>
          )}
          {report.postingFrequency && (
            <div>
              <p className="text-xs text-text-muted">Posting frequency</p>
              <p className="font-semibold">{report.postingFrequency}</p>
            </div>
          )}
        </div>
      )}
      {report.summary && (
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-text-muted">Summary</p>
          <p className="mt-1 text-sm leading-relaxed">{report.summary}</p>
        </div>
      )}
      {report.contentStyle && (
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-text-muted">Content style</p>
          <p className="mt-1 text-sm leading-relaxed">{report.contentStyle}</p>
        </div>
      )}
      <Section title="Top Topics" items={report.topTopics ?? []} accent="text-pink-300" />
      <Section title="Viral Formats" items={report.viralFormats ?? []} accent="text-purple-300" />
      {(report.topPosts ?? []).length > 0 && (
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-text-muted">Top Posts</p>
          <div className="mt-2 space-y-2">
            {report.topPosts!.map((p, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2">{p.caption}</p>
                  <p className="text-xs text-text-muted">{p.likes} likes · {p.type}</p>
                </div>
                {p.url && (
                  <a href={p.url} target="_blank" rel="noreferrer" className="shrink-0 text-text-muted hover:text-text">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {(report.opportunities ?? []).length > 0 && (
        <div className="card-elevated ring-1 ring-white/10 p-5">
          <p className="text-xs uppercase tracking-wide text-text-muted">Opportunities for you</p>
          <ol className="mt-2 space-y-2 text-sm">
            {report.opportunities!.map((o, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium">
                  {i + 1}
                </span>
                <span>{o}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// ─── Twitter report ───────────────────────────────────────────────────────────

function TwitterReportView({ report }: { report: TwitterReport }) {
  return (
    <div className="space-y-4">
      {(report.username || report.followerCount || report.postingFrequency) && (
        <div className="card flex flex-wrap items-center gap-6 p-5">
          {report.username && (
            <div>
              <p className="text-xs text-text-muted">Username</p>
              <p className="font-semibold">@{report.username}</p>
            </div>
          )}
          {report.followerCount && (
            <div>
              <p className="text-xs text-text-muted">Followers</p>
              <p className="font-semibold">{report.followerCount}</p>
            </div>
          )}
          {report.postingFrequency && (
            <div>
              <p className="text-xs text-text-muted">Posting frequency</p>
              <p className="font-semibold">{report.postingFrequency}</p>
            </div>
          )}
        </div>
      )}
      {report.summary && (
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-text-muted">Summary</p>
          <p className="mt-1 text-sm leading-relaxed">{report.summary}</p>
        </div>
      )}
      {report.contentStyle && (
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-text-muted">Content style</p>
          <p className="mt-1 text-sm leading-relaxed">{report.contentStyle}</p>
        </div>
      )}
      <Section title="Top Topics" items={report.topTopics ?? []} accent="text-sky-300" />
      <Section title="Viral Formats" items={report.viralFormats ?? []} accent="text-purple-300" />
      {(report.topTweets ?? []).length > 0 && (
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-text-muted">Top Tweets</p>
          <div className="mt-2 space-y-3">
            {report.topTweets!.map((t, i) => (
              <div key={i} className="rounded-lg border border-bg-border bg-bg-elevated p-3 text-sm">
                <p className="leading-relaxed">{t.text}</p>
                <p className="mt-1.5 text-xs text-text-muted">{t.likes} likes · {t.retweets} retweets</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {(report.opportunities ?? []).length > 0 && (
        <div className="card-elevated ring-1 ring-white/10 p-5">
          <p className="text-xs uppercase tracking-wide text-text-muted">Opportunities for you</p>
          <ol className="mt-2 space-y-2 text-sm">
            {report.opportunities!.map((o, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium">
                  {i + 1}
                </span>
                <span>{o}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// ─── SERP report ──────────────────────────────────────────────────────────────

function SerpReportView({ report }: { report: SerpReport }) {
  return (
    <div className="space-y-4">
      {/* Overview */}
      <div className="card flex flex-wrap items-center gap-6 p-5">
        <div>
          <p className="text-xs text-text-muted">Ranking on Google?</p>
          <p className={`font-semibold ${report.isRanking ? "text-green-400" : "text-red-400"}`}>
            {report.isRanking ? "Yes" : "No"}
          </p>
        </div>
        {report.highestPosition != null && (
          <div>
            <p className="text-xs text-text-muted">Highest position</p>
            <p className="font-semibold">#{report.highestPosition}</p>
          </div>
        )}
        {report.totalAds != null && (
          <div>
            <p className="text-xs text-text-muted">Paid ads running</p>
            <p className="font-semibold">{report.totalAds}</p>
          </div>
        )}
      </div>

      {report.summary && (
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-text-muted">Summary</p>
          <p className="mt-1 text-sm leading-relaxed">{report.summary}</p>
        </div>
      )}

      {(report.organicPositions ?? []).length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-bg-border">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Organic results</p>
          </div>
          <div className="divide-y divide-bg-border">
            {report.organicPositions!.map((r, i) => (
              <div key={i} className="px-5 py-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white/10 text-xs font-medium">
                    {r.position}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{r.title}</p>
                    <p className="text-xs text-text-muted truncate">{r.url}</p>
                    {r.description && (
                      <p className="mt-1 text-xs text-text-muted line-clamp-2">{r.description}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(report.paidAds ?? []).length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-bg-border">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-300">Paid ads</p>
          </div>
          <div className="divide-y divide-bg-border">
            {report.paidAds!.map((ad, i) => (
              <div key={i} className="px-5 py-3">
                <p className="text-sm font-medium">{ad.title}</p>
                <p className="text-xs text-text-muted truncate">{ad.url}</p>
                {ad.description && (
                  <p className="mt-1 text-xs text-text-muted">{ad.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Section title="Related queries" items={report.relatedQueries ?? []} accent="text-blue-300" />

      {(report.opportunities ?? []).length > 0 && (
        <div className="card-elevated ring-1 ring-white/10 p-5">
          <p className="text-xs uppercase tracking-wide text-text-muted">SEO opportunities for you</p>
          <ol className="mt-2 space-y-2 text-sm">
            {report.opportunities!.map((o, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium">
                  {i + 1}
                </span>
                <span>{o}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// ─── Shared Section ───────────────────────────────────────────────────────────

function Section({ title, items, accent }: { title: string; items: string[]; accent: string }) {
  if (!items?.length) return null;
  return (
    <div className="card p-5">
      <p className={`text-xs uppercase tracking-wide ${accent}`}>{title}</p>
      <ul className="mt-2 space-y-1.5 text-sm">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-text-muted">·</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
