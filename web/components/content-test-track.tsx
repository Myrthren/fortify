"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Clock, Trash2, Video } from "lucide-react";
import {
  contentId,
  contentUrl,
  contentHref,
  type TestDocument,
  type TestVersion,
} from "@/lib/content-workspace";
import { contentRequest } from "./content-workbench";
import { Field, Guide, Empty } from "./content-fields";
type Media = {
  id: string;
  title: string;
  videoUrl: string;
  thumbnailUrl: string | null;
};
const timestamp = (n: number) =>
  `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(n % 60)
    .toString()
    .padStart(2, "0")}`;
export function TestWorkspace({
  value,
  onChange,
}: {
  value: TestDocument;
  onChange: (d: TestDocument) => void;
}) {
  const [media, setMedia] = useState<Media[]>([]),
    [activeId, setActiveId] = useState(value.versions[0].id),
    [time, setTime] = useState(0),
    [duration, setDuration] = useState(0),
    [muted, setMuted] = useState(true),
    [note, setNote] = useState(""),
    [noteKind, setNoteKind] = useState<"observation" | "suggestion">(
      "observation",
    ),
    [error, setError] = useState(""),
    [local, setLocal] = useState<Record<string, string>>({}),
    [playUrl, setPlayUrl] = useState("");
  const player = useRef<HTMLVideoElement>(null),
    blobs = useRef<string[]>([]),
    pendingSeek = useRef<number | null>(null),
    active = value.versions.find((v) => v.id === activeId) || value.versions[0],
    selectedMedia = media.find((m) => m.id === active.mediaId);
  useEffect(() => {
    let alive = true;
    contentRequest("/api/content/media")
      .then((d) => {
        if (alive) setMedia(d.items);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(
    () => () => {
      blobs.current.forEach(URL.revokeObjectURL);
    },
    [],
  );
  useEffect(() => {
    const candidate =
      local[active.id] || selectedMedia?.videoUrl || active.videoUrl;
    try {
      setPlayUrl(
        candidate.startsWith("blob:") ? candidate : contentUrl(candidate),
      );
    } catch (e) {
      setPlayUrl("");
      setError((e as Error).message);
      return;
    }
    setTime(0);
    setDuration(0);
    setError("");
  }, [active.id, active.mediaId, selectedMedia, local]);
  function patch(partial: Partial<TestVersion>) {
    onChange({
      ...value,
      versions: value.versions.map((v) =>
        v.id === active.id ? { ...v, ...partial } : v,
      ),
    });
  }
  function seek(seconds: number) {
    if (player.current && duration) {
      player.current.currentTime = Math.max(0, Math.min(duration, seconds));
      setTime(player.current.currentTime);
    }
  }
  function device(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setError("Choose a video file.");
      return;
    }
    const url = URL.createObjectURL(file);
    blobs.current.push(url);
    patch({ mediaId: "", videoUrl: "" });
    setLocal({ ...local, [active.id]: url });
  }
  function addVersion() {
    const id = contentId();
    onChange({
      ...value,
      versions: [
        ...value.versions,
        {
          id,
          label: `Version ${value.versions.length + 1}`,
          mediaId: "",
          videoUrl: "",
          publication: "",
          publishedAt: "",
          audience: "",
          views: null,
          completions: null,
          responses: null,
        },
      ],
    });
    setActiveId(id);
  }
  function jump(versionId: string, seconds: number) {
    if (active.id === versionId) seek(seconds);
    else {
      pendingSeek.current = seconds;
      setActiveId(versionId);
    }
  }
  const activeNotes = value.notes
    .filter((n) => n.versionId === active.id)
    .sort((a, b) => a.seconds - b.seconds);
  return (
    <>
      <p className="cw-help">
        Need visual assets?{" "}
        <Link
          className="cw-link"
          href="/dashboard/content?view=test&assets=slideshow"
        >
          Open the slideshow creator
        </Link>
        .
      </p>
      <Guide
        steps={[
          "Add your video and name the change you want to test",
          "Play it and leave notes at specific moments",
          "Enter observed results and record what you learned",
        ]}
      />
      {value.storyId && (
        <Link className="cw-link" href={contentHref("story", value.storyId)}>
          Open the linked story
        </Link>
      )}
      <Field
        label="What exactly are you testing?"
        hint="One clear hypothesis, such as: showing the booking flow first makes the offer easier to understand."
      >
        <textarea
          className="input"
          rows={2}
          value={value.hypothesis}
          maxLength={2000}
          onChange={(e) => onChange({ ...value, hypothesis: e.target.value })}
        />
      </Field>
      <div className="cw-row cw-section-heading">
        <div className="cw-version-tabs" aria-label="Creative versions">
          {value.versions.map((v, i) => (
            <button
              type="button"
              key={v.id}
              aria-pressed={active.id === v.id}
              onClick={() => setActiveId(v.id)}
            >
              <span>{String.fromCharCode(65 + i)}</span>
              {v.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn-secondary"
          disabled={value.versions.length >= 4}
          onClick={addVersion}
        >
          <Plus size={14} /> Add a version
        </button>
      </div>
      <div className="cw-test-layout">
        <div className="cw-panel">
          <div className="cw-two">
            <Field label="Version name">
              <input
                className="input"
                value={active.label}
                maxLength={100}
                onChange={(e) => patch({ label: e.target.value })}
              />
            </Field>
            <Field label="Choose from saved media">
              <select
                className="input"
                value={active.mediaId}
                onChange={(e) => {
                  patch({ mediaId: e.target.value, videoUrl: "" });
                  setLocal((x) => {
                    const next = { ...x };
                    delete next[active.id];
                    return next;
                  });
                }}
              >
                <option value="">No saved media selected</option>
                {media.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field
            label="Or use a direct, hosted video URL"
            hint="A public MP4 or WebM address, not a YouTube or TikTok page. URLs are saved so the video can reopen later."
          >
            <input
              className="input"
              type="url"
              value={active.videoUrl}
              placeholder="https://…/my-video.mp4"
              onChange={(e) => patch({ videoUrl: e.target.value, mediaId: "" })}
            />
          </Field>
          <div className="cw-row">
            <button
              type="button"
              className="btn-secondary"
              disabled={!/^https?:\/\//i.test(active.videoUrl)}
              onClick={() => {
                try {
                  setPlayUrl(contentUrl(active.videoUrl));
                  setError("");
                } catch (e) {
                  setError((e as Error).message);
                  return;
                }
                setDuration(0);
                setTime(0);
                setLocal((x) => {
                  const next = { ...x };
                  delete next[active.id];
                  return next;
                });
              }}
            >
              Load hosted video
            </button>
            <Field label="Or preview a file from this device">
              <input
                type="file"
                accept="video/*"
                onChange={(e) => device(e.target.files?.[0])}
              />
            </Field>
          </div>
          {local[active.id] && (
            <p className="cw-help">
              Device preview only. The file is not uploaded or saved. Attach a
              hosted URL or saved media to reopen this video later.
            </p>
          )}
          <div className="cw-player-stage">
            {playUrl ? (
              <video
                key={playUrl}
                ref={player}
                src={playUrl}
                controls
                muted={muted}
                playsInline
                preload="metadata"
                poster={selectedMedia?.thumbnailUrl || undefined}
                onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => {
                  const d = e.currentTarget.duration;
                  setDuration(Number.isFinite(d) ? d : 0);
                  if (pendingSeek.current !== null) {
                    e.currentTarget.currentTime = Math.min(
                      d,
                      pendingSeek.current,
                    );
                    pendingSeek.current = null;
                  }
                }}
                onError={() =>
                  setError(
                    "This video could not be played. Check that the address is a direct, accessible video file in a browser-supported format.",
                  )
                }
                aria-label={`${active.label} video player`}
              />
            ) : (
              <Empty title="Bring your own creative">
                <Video size={32} />
                <p>
                  Select saved media, load a hosted video or choose a device
                  file above.
                </p>
              </Empty>
            )}
          </div>
          <div className="cw-row">
            <span className="cw-time">
              {timestamp(time)} / {timestamp(duration)}
            </span>
            <label className="cw-check">
              <input
                type="checkbox"
                checked={muted}
                onChange={(e) => setMuted(e.target.checked)}
              />{" "}
              Review with sound off
            </label>
          </div>
          <Field label="Timeline">
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={Math.min(time, duration || 1)}
              disabled={!duration}
              aria-valuetext={`${time.toFixed(1)} seconds`}
              onChange={(e) => seek(Number(e.target.value))}
            />
          </Field>
          <div className="cw-timeline-notes">
            {activeNotes.map((n) => (
              <button type="button" key={n.id} onClick={() => seek(n.seconds)}>
                <Clock size={13} />
                <strong>{timestamp(n.seconds)}</strong>
                <span>
                  {n.kind}: {n.text}
                </span>
              </button>
            ))}
          </div>
        </div>
        <aside className="cw-panel cw-test-notes">
          <h2>Notes at this moment</h2>
          <p className="cw-help">
            Play or scrub to a moment, then add an observation or a proposed
            edit.
          </p>
          <span className="cw-chip">At {timestamp(time)}</span>
          <Field label="Note type">
            <select
              className="input"
              value={noteKind}
              onChange={(e) =>
                setNoteKind(e.target.value as "observation" | "suggestion")
              }
            >
              <option value="observation">Observation: what I see</option>
              <option value="suggestion">
                Suggestion: what I would change
              </option>
            </select>
          </Field>
          <Field label="Your note">
            <textarea
              className="input"
              rows={4}
              value={note}
              maxLength={2000}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <button
            type="button"
            className="btn-secondary"
            disabled={!note.trim() || value.notes.length >= 100}
            onClick={() => {
              onChange({
                ...value,
                notes: [
                  ...value.notes,
                  {
                    id: contentId(),
                    versionId: active.id,
                    seconds: Math.round(time * 10) / 10,
                    text: note.trim(),
                    kind: noteKind,
                  },
                ],
              });
              setNote("");
            }}
          >
            Add note at {timestamp(time)}
          </button>
          <div className="cw-notes-list">
            {value.notes.map((n) => (
              <article key={n.id}>
                <button
                  type="button"
                  className="cw-text-button"
                  onClick={() => jump(n.versionId, n.seconds)}
                >
                  {value.versions.find((v) => v.id === n.versionId)?.label} ·{" "}
                  {timestamp(n.seconds)}
                </button>
                <p>{n.text}</p>
                <small>{n.kind}</small>
                <button
                  type="button"
                  className="cw-text-button"
                  aria-label={`Remove note: ${n.text.slice(0, 30)}`}
                  onClick={() =>
                    onChange({
                      ...value,
                      notes: value.notes.filter((x) => x.id !== n.id),
                    })
                  }
                >
                  <Trash2 size={12} /> Remove
                </button>
              </article>
            ))}
          </div>
        </aside>
      </div>
      {error && (
        <p className="cw-error" role="alert">
          {error}
        </p>
      )}
      <section className="cw-panel cw-section-heading">
        <h2>Record the actual results</h2>
        <p className="cw-help">
          Manual entry from your platform report. Empty means unknown. Different
          audiences, dates or distribution can explain differences; this
          comparison does not establish causation.
        </p>
        <div className="cw-two">
          <Field label="Published post URL">
            <input
              className="input"
              type="url"
              value={active.publication}
              onChange={(e) => patch({ publication: e.target.value })}
            />
          </Field>
          <Field label="Publication date">
            <input
              className="input"
              type="date"
              value={active.publishedAt}
              onChange={(e) => patch({ publishedAt: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Audience / distribution / timing differences">
          <textarea
            className="input"
            rows={2}
            maxLength={1000}
            value={active.audience}
            placeholder="e.g. Organic Instagram post to existing followers; posted on Friday at 18:00."
            onChange={(e) => patch({ audience: e.target.value })}
          />
        </Field>
        <div className="cw-three">
          {(["views", "completions", "responses"] as const).map((k) => (
            <Field
              label={
                k === "completions"
                  ? "Views that reached the end"
                  : k === "responses"
                    ? "Responses / enquiries"
                    : "Total video views"
              }
              key={k}
            >
              <input
                className="input"
                type="number"
                min={0}
                step={1}
                max={1e10}
                value={active[k] ?? ""}
                onChange={(e) =>
                  patch({
                    [k]: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </Field>
          ))}
        </div>
        <div className="cw-results-table">
          <table>
            <caption>Recorded results by version</caption>
            <thead>
              <tr>
                <th>Version</th>
                <th>Views</th>
                <th>Completed</th>
                <th>Completion rate</th>
                <th>Responses</th>
              </tr>
            </thead>
            <tbody>
              {value.versions.map((v) => (
                <tr key={v.id}>
                  <th>{v.label}</th>
                  <td>{v.views ?? "Unknown"}</td>
                  <td>{v.completions ?? "Unknown"}</td>
                  <td>
                    {v.views !== null && v.views > 0 && v.completions !== null
                      ? `${Math.round((1000 * v.completions) / v.views) / 10}%`
                      : "Unknown"}
                  </td>
                  <td>{v.responses ?? "Unknown"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Field label="What did you learn? What will you try next?">
          <textarea
            className="input"
            rows={3}
            maxLength={4000}
            value={value.conclusion}
            onChange={(e) => onChange({ ...value, conclusion: e.target.value })}
          />
        </Field>
        <p className="cw-help">
          Use Save changes above to keep the hypothesis, notes and result
          record. Automated video analysis and connected analytics are not part
          of this release.
        </p>
      </section>
    </>
  );
}
