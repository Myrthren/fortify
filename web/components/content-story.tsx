"use client";
import { useState } from "react";
import Link from "next/link";
import {
  BEATS,
  storyFigures,
  type StoryDocument,
  type ContentRecordView,
  type ContentDocument,
  type Beat,
  contentHref,
} from "@/lib/content-workspace";
import {
  Lock,
  Unlock,
  Sparkles,
  Download,
  ArrowRight,
  Check,
  Smartphone,
} from "lucide-react";
import { Field, Guide, EvidenceEditor } from "./content-fields";
import { contentRequest } from "./content-workbench";
const labels: Record<Beat, { title: string; hint: string }> = {
  opening: {
    title: "Opening",
    hint: "Give the viewer a reason to pay attention.",
  },
  problem: {
    title: "Problem",
    hint: "Explain the situation your audience recognises.",
  },
  proof: {
    title: "Evidence or demonstration",
    hint: "Show how it works. Use facts you can support.",
  },
  payoff: {
    title: "Payoff",
    hint: "What does the audience understand or gain?",
  },
  action: { title: "Next step", hint: "Ask for one clear action." },
};
export function StoryWorkspace({
  value,
  onChange,
  record,
  dirty,
  save,
  onTest,
}: {
  value: StoryDocument;
  onChange: (d: StoryDocument) => void;
  record: ContentRecordView | null;
  dirty: boolean;
  save: (d?: ContentDocument) => Promise<ContentRecordView | null>;
  onTest: () => Promise<void>;
}) {
  const [preview, setPreview] = useState(false),
    [selected, setSelected] = useState<Beat>("opening"),
    [suggestion, setSuggestion] = useState<{
      beat: Beat;
      text: string;
      voice: string | null;
    } | null>(null),
    [working, setWorking] = useState(false),
    [error, setError] = useState("");
  const flags = storyFigures(value),
    complete = BEATS.every((b) => !!value.beats[b].trim());
  function beat(b: Beat, text: string) {
    onChange({
      ...value,
      approved: false,
      beats: { ...value.beats, [b]: text },
    });
  }
  function jumpToBeat(b: Beat) {
    setPreview(false);
    setSelected(b);
    requestAnimationFrame(() => {
      const input = document.getElementById(`story-${b}`);
      input?.focus({ preventScroll: true });
      input?.scrollIntoView({
        block: "center",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    });
  }
  async function rewrite() {
    setWorking(true);
    setError("");
    try {
      const saved = dirty || !record ? await save() : record;
      if (!saved) return;
      const data = await contentRequest(
        `/api/content/${saved.id}/rewrite`,
        "POST",
        { version: saved.version, beat: selected },
      );
      setSuggestion({
        beat: selected,
        text: data.suggestion,
        voice: data.voice,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  function exportScript() {
    const text = [
      record?.title || "Story draft",
      `Platform: ${value.platform}`,
      `Status: ${value.approved ? "Approved" : "Draft"}`,
      "",
      ...BEATS.flatMap((b) => [
        labels[b].title.toUpperCase(),
        value.beats[b],
        "",
      ]),
      "SOURCES",
      ...value.evidence.map(
        (e) => `${e.title}\n${e.excerpt}\n${e.source} ${e.date}\n${e.url}`,
      ),
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "fortify-story.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <Guide
        targets={["story-brief", "story-draft", "story-review"]}
        complete={[!!value.idea.trim(), complete, value.approved]}
        steps={[
          "Write the idea and attach supporting facts",
          "Fill the five beats and compare openings",
          "Approve, export or open a content test",
        ]}
      />
      <div className="cw-two cw-brief" id="story-brief" tabIndex={-1}>
        <Field label="What is this piece about?">
          <textarea
            className="input"
            value={value.idea}
            rows={3}
            maxLength={2000}
            placeholder="e.g. Show salon owners how customers can book after closing."
            onChange={(e) =>
              onChange({ ...value, idea: e.target.value, approved: false })
            }
          />
        </Field>
        <div>
          <Field label="Format">
            <select
              className="input"
              value={value.platform}
              onChange={(e) =>
                onChange({
                  ...value,
                  platform: e.target.value,
                  approved: false,
                })
              }
            >
              <option>Short video</option>
              <option>YouTube video</option>
              <option>LinkedIn post</option>
              <option>Instagram caption</option>
              <option>Email</option>
            </select>
          </Field>
          {value.researchId && (
            <Link
              className="cw-link"
              href={contentHref("research", value.researchId)}
            >
              Open the source research <ArrowRight size={13} />
            </Link>
          )}
          <p className="cw-help">
            Manual editing and export use no AI. Writing suggestions use your
            active brand voice when available.
          </p>
        </div>
      </div>
      <div className="cw-row cw-section-heading">
        <div><h2>Your story</h2><p className="cw-help">{BEATS.filter(b => value.beats[b].trim()).length} of 5 beats written. Select a beat to work on it.</p></div>
        <div className="cw-row">
          <span className="cw-chip">
            {value.approved ? "Approved" : "Draft"}
          </span>
          <button
            type="button"
            className="btn-secondary cw-mobile-toggle"
            onClick={() => setPreview(!preview)}
          >
            <Smartphone size={14} />
            {preview ? "Edit story" : "Feed preview"}
          </button>
        </div>
      </div>
      <nav className="cw-beat-nav" aria-label="Jump to a story beat">
        {BEATS.map((b, i) => (
          <button type="button" key={b} aria-pressed={selected === b} onClick={() => jumpToBeat(b)}>
            <span>{value.beats[b].trim() ? <Check size={13} /> : i + 1}</span>
            {labels[b].title}
          </button>
        ))}
      </nav>
      <div className={`cw-forge-layout ${preview ? "cw-show-preview" : ""}`}>
        <div className="cw-story-editor" id="story-draft" tabIndex={-1}>
          {BEATS.map((b, i) => (
            <section
              key={b}
              className={`cw-beat ${selected === b ? "cw-active-beat" : ""}`}
            >
              <span className="cw-beat-number">0{i + 1}</span>
              <div>
                <div className="cw-row">
                  <label htmlFor={`story-${b}`}>{labels[b].title}</label>
                  <button
                    type="button"
                    className="cw-text-button"
                    aria-pressed={value.locks.includes(b)}
                    onClick={() =>
                      onChange({
                        ...value,
                        locks: value.locks.includes(b)
                          ? value.locks.filter((x) => x !== b)
                          : [...value.locks, b],
                      })
                    }
                  >
                    {value.locks.includes(b) ? (
                      <Lock size={13} />
                    ) : (
                      <Unlock size={13} />
                    )}{" "}
                    {value.locks.includes(b) ? "Locked" : "Lock wording"}
                  </button>
                </div>
                <p className="cw-help">{labels[b].hint}</p>
                <textarea
                  id={`story-${b}`}
                  className="input"
                  value={value.beats[b]}
                  maxLength={4000}
                  rows={b === "proof" ? 4 : 3}
                  readOnly={value.locks.includes(b)}
                  onFocus={() => setSelected(b)}
                  onChange={(e) => beat(b, e.target.value)}
                />
                {b === "opening" && (
                  <div className="cw-openings">
                    <button
                      type="button"
                      className="cw-text-button"
                      disabled={
                        !value.beats.opening.trim() ||
                        value.openings.length >= 8
                      }
                      onClick={() =>
                        onChange({
                          ...value,
                          openings: [...value.openings, value.beats.opening],
                        })
                      }
                    >
                      <PlusOpening /> Keep this opening as an alternative
                    </button>
                    {value.openings.map((o, j) => (
                      <div className="cw-opening-choice" key={j}>
                        <button
                          type="button"
                          disabled={value.locks.includes("opening")}
                          onClick={() => beat("opening", o)}
                        >
                          <span>Alternative {j + 1}</span>
                          {o}
                        </button>
                        <button
                          type="button"
                          className="cw-text-button"
                          onClick={() =>
                            onChange({
                              ...value,
                              openings: value.openings.filter(
                                (_, i) => i !== j,
                              ),
                            })
                          }
                          aria-label={`Remove alternative ${j + 1}`}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ))}
          <div className="cw-writing-assist">
            <Field label="Beat to improve">
              <select
                className="input"
                value={selected}
                onChange={(e) => setSelected(e.target.value as Beat)}
              >
                {BEATS.map((b) => (
                  <option key={b} value={b}>
                    {labels[b].title}
                  </option>
                ))}
              </select>
            </Field>
            <button
              type="button"
              className="btn-secondary"
              disabled={
                working || value.locks.includes(selected) || !value.idea.trim()
              }
              onClick={() => void rewrite()}
            >
              <Sparkles size={14} />
              {working
                ? "Preparing suggestion…"
                : "Suggest wording for this beat"}
            </button>
            <p className="cw-help">
              Saves your draft first. Suggestions stay separate until you accept
              them.
            </p>
          </div>
          {error && (
            <p className="cw-error" role="alert">
              {error}
            </p>
          )}
          {suggestion && (
            <section className="cw-suggestion">
              <h3>
                Suggested {labels[suggestion.beat].title} ·{" "}
                {suggestion.voice || "General voice"}
              </h3>
              <div className="cw-two">
                <div>
                  <h3>Current wording</h3>
                  <p>{value.beats[suggestion.beat] || "Empty beat"}</p>
                </div>
                <div>
                  <h3>Suggested wording</h3>
                  <p>{suggestion.text}</p>
                </div>
              </div>
              <div className="cw-row">
                <button
                  type="button"
                  disabled={value.locks.includes(suggestion.beat)}
                  className="btn-secondary"
                  onClick={() => {
                    beat(suggestion.beat, suggestion.text);
                    setSuggestion(null);
                  }}
                >
                  Use this suggestion
                </button>
                <button
                  type="button"
                  className="cw-text-button"
                  onClick={() => setSuggestion(null)}
                >
                  Discard suggestion
                </button>
              </div>
            </section>
          )}
        </div>
        <aside className="cw-story-preview">
          <h3>Live text preview</h3><p className="cw-meta">{value.platform}</p>
          <div
            className={`cw-feed ${value.platform.includes("video") ? "cw-feed-video" : ""}`}
          >
            <div className="cw-feed-author">
              <span className="cw-avatar">F</span>
              <span>
                Your brand
                <br />
                <small>Creative preview · Text only</small>
              </span>
            </div>
            {BEATS.map((b) => (
              <p className={`cw-feed-${b}`} key={b}>
                {value.beats[b] || `[${labels[b].title}]`}
              </p>
            ))}
          </div>
          <p className="cw-help">
            The full script appears here. It does not render a finished video or
            publish anything.
          </p>
        </aside>
      </div>
      <EvidenceEditor
        value={value.evidence}
        onChange={(e) => onChange({ ...value, evidence: e, approved: false })}
      />
      {flags.length > 0 && (
        <p className="cw-error" role="alert">
          Figures need evidence: {flags.join(", ")}. Add their source above or
          revise the wording before approving.
        </p>
      )}
      <section className="cw-review" id="story-review" tabIndex={-1}>
      <div><h2>Review and finish</h2><p className="cw-help">{!complete ? "Complete all five beats to approve this story." : flags.length ? "Support the flagged figures with evidence before approval." : value.approved ? "Story approved. Export your script or take it into a content test." : "All five beats are written. Review the wording and sources, then approve your story."}</p></div>
      <div className="cw-bottom-actions">
        <button
          type="button"
          className="btn-primary"
          disabled={!complete || !!flags.length}
          onClick={() => void save({ ...value, approved: true })}
        >
          <Check size={14} /> Approve & save story
        </button>
        <button type="button" className="btn-secondary" onClick={exportScript}>
          <Download size={14} /> Export script
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => void onTest()}
        >
          Review in Test Track <ArrowRight size={14} />
        </button>
      </div>
      </section>
    </>
  );
}
function PlusOpening() {
  return <span aria-hidden="true">+</span>;
}
