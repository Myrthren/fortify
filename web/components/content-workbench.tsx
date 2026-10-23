"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Save,
  Plus,
  Orbit,
  Clapperboard,
  ScanLine,
  GitFork,
  Loader2,
  Lock,
  RotateCcw,
} from "lucide-react";
import {
  CONTENT_KINDS,
  CONTENT_VIEWS,
  blankContent,
  contentAccess,
  contentHref,
  parseContent,
  storyFromEvidence,
  type ContentKind,
  type ContentDocument,
  type ContentSummary,
  type ContentRecordView,
  type ResearchDocument,
  type StoryDocument,
  type TestDocument,
  type DecisionDocument,
  type Observation,
} from "@/lib/content-workspace";
import { responseError } from "@/lib/response-error";
import { ResearchWorkspace } from "./content-research";
import { StoryWorkspace } from "./content-story";
import { TestWorkspace } from "./content-test-track";
import { DecisionWorkspace } from "./content-decision";
import "./content-workspace.css";
const icons = {
  research: Orbit,
  story: Clapperboard,
  test: ScanLine,
  decision: GitFork,
};
export async function contentRequest(
  url: string,
  method = "GET",
  body?: unknown,
) {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!response.ok) throw Error(await responseError(response));
  return response.json();
}
export function ContentWorkbench({
  kind,
  initialId,
  tier,
}: {
  kind: ContentKind;
  initialId?: string;
  tier: string;
}) {
  const router = useRouter(),
    [records, setRecords] = useState<ContentSummary[]>([]),
    [record, setRecord] = useState<ContentRecordView | null>(null),
    [title, setTitle] = useState(""),
    [document, setDocument] = useState<ContentDocument>(() =>
      blankContent(kind),
    ),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const editing = useRef(0),
    sequence = useRef(0),
    pending = useRef(false);
  const [instance, setInstance] = useState(0);
  const apply = useCallback((r: ContentRecordView) => {
    setRecord(r);
    setTitle(r.title);
    setDocument(r.document);
    setDirty(false);
    editing.current++;
    setInstance((i) => i + 1);
  }, []);
  const reset = () => {
    setRecord(null);
    setTitle("");
    setDocument(blankContent(kind));
    setDirty(false);
    setNotice(
      "Start with the steps below. Nothing is generated or sent automatically.",
    );
    setError("");
    editing.current++;
    setInstance((i) => i + 1);
    window.history.replaceState(window.history.state, "", contentHref(kind));
  };
  const load = useCallback(
    async (id: string) => {
      const seq = ++sequence.current;
      setLoading(true);
      setError("");
      try {
        const data = await contentRequest(
          `/api/content/${encodeURIComponent(id)}`,
        );
        if (data.record.kind !== kind)
          throw Error("This record belongs to another workspace.");
        if (seq === sequence.current) {
          apply(data.record);
          window.history.replaceState(
            window.history.state,
            "",
            contentHref(kind, data.record.id),
          );
        }
      } catch (e) {
        if (seq === sequence.current) setError((e as Error).message);
      } finally {
        if (seq === sequence.current) setLoading(false);
      }
    },
    [kind, apply],
  );
  useEffect(() => {
    let alive = true;
    setLoading(true);
    contentRequest(`/api/content?kind=${kind}`)
      .then((data) => {
        if (alive) {
          setRecords(data.records);
          if (!initialId) setLoading(false);
        }
      })
      .catch((e) => {
        if (alive) {
          setError(e.message);
          setLoading(false);
        }
      });
    if (initialId) void load(initialId);
    return () => {
      alive = false;
      sequence.current++;
    };
  }, [kind, initialId, load]);
  useEffect(() => {
    const prevent = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  const canLeave = () =>
    !dirty || window.confirm("Discard your unsaved edits?");
  function change(d: ContentDocument) {
    setDocument(d);
    setDirty(true);
    editing.current++;
    setNotice("");
  }
  async function save(
    override?: ContentDocument,
  ): Promise<ContentRecordView | null> {
    if (pending.current) return null;
    pending.current = true;
    setBusy(true);
    setError("");
    const stamp = editing.current;
    try {
      const doc = parseContent(kind, override ?? document);
      if (!title.trim()) throw Error("Give this work a title before saving.");
      const data = await contentRequest(
        record ? `/api/content/${record.id}` : "/api/content",
        record ? "PATCH" : "POST",
        {
          title,
          kind,
          document: doc,
          ...(record ? { version: record.version } : {}),
        },
      );
      const r = data.record as ContentRecordView;
      setRecord(r);
      window.history.replaceState(
        window.history.state,
        "",
        contentHref(kind, r.id),
      );
      if (stamp === editing.current) {
        setDocument(r.document);
        setTitle(r.title);
        setDirty(false);
      }
      setRecords((rows) =>
        [r, ...rows.filter((x) => x.id !== r.id)].slice(0, 100),
      );
      setNotice(
        stamp === editing.current
          ? "Saved to your account."
          : "Saved the earlier version. Save again to include your latest edits.",
      );
      return r;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function buildStory(o: Observation) {
    const saved = await save();
    if (!saved) return;
    setBusy(true);
    try {
      const data = await contentRequest("/api/content", "POST", {
        kind: "story",
        title: o.topic,
        document: storyFromEvidence(o, saved.id),
      });
      router.push(contentHref("story", data.record.id));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function buildTest() {
    if (!contentAccess("test", tier)) {
      router.push(contentHref("test"));
      return;
    }
    const saved = await save();
    if (!saved) return;
    setBusy(true);
    try {
      const doc = blankContent("test") as TestDocument;
      doc.storyId = saved.id;
      const data = await contentRequest("/api/content", "POST", {
        kind: "test",
        title: `${title.slice(0, 105)} / test`,
        document: doc,
      });
      router.push(contentHref("test", data.record.id));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  const v = CONTENT_VIEWS[kind];
  return (
    <div className="cw-workbench">
      <nav className="cw-nav" aria-label="Content and decisions">
        {CONTENT_KINDS.map((k) => {
          const Icon = icons[k],
            locked = !contentAccess(k, tier);
          return (
            <Link
              key={k}
              href={contentHref(k)}
              aria-current={kind === k ? "page" : undefined}
              onClick={(e) => {
                if (!canLeave()) e.preventDefault();
              }}
            >
              <Icon size={17} />
              <span>
                <strong>{CONTENT_VIEWS[k].action}</strong>
                <small>
                  {CONTENT_VIEWS[k].name}
                  {locked && (
                    <>
                      {" "}
                      · {CONTENT_VIEWS[k].tier} <Lock size={10} />
                    </>
                  )}
                </small>
              </span>
            </Link>
          );
        })}
      </nav>
      <header className="cw-heading">
        <div>
          <span className="eyebrow">
            {kind === "decision" ? "Plans" : "Content"} / {v.name}
          </span>
          <h1>{v.action}</h1>
          <p>{v.help}</p>
        </div>
        <Link href="/dashboard/activity" className="cw-link">
          Earlier tool results <ArrowRight size={14} />
        </Link>
      </header>
      <div className="cw-record-bar">
        <label>
          <span>Recent saved work</span>
          <select
            className="input"
            aria-label="Open saved work"
            value={record?.id || ""}
            disabled={busy || loading}
            onChange={(e) => {
              if (!canLeave()) return;
              if (e.target.value) void load(e.target.value);
              else reset();
            }}
          >
            <option value="">New {v.name.toLowerCase()} record</option>
            {records.map((r) => (
              <option value={r.id} key={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy || loading}
          onClick={() => {
            if (canLeave()) reset();
          }}
        >
          <Plus size={15} /> New
        </button>
        {record && (
          <button
            type="button"
            className="cw-text-button"
            disabled={busy || loading}
            onClick={() => {
              if (canLeave()) void load(record.id);
            }}
          >
            <RotateCcw size={14} /> Reload saved
          </button>
        )}
      </div>
      <div className="cw-save-bar">
        <label>
          <span>Title</span>
          <input
            className="input"
            aria-label="Title for this work"
            placeholder={
              kind === "research"
                ? "e.g. Questions from salon customers"
                : kind === "story"
                  ? "e.g. Book an appointment after closing"
                  : kind === "test"
                    ? "e.g. Show the result in the first three seconds"
                    : "e.g. Where should we focus next month?"
            }
            maxLength={120}
            value={title}
            disabled={loading}
            onChange={(e) => {
              setTitle(e.target.value);
              setDirty(true);
              editing.current++;
            }}
          />
        </label>
        <button
          type="button"
          className="btn-primary"
          disabled={busy || loading || !title.trim()}
          onClick={() => void save()}
        >
          {busy ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Save size={15} />
          )}{" "}
          Save {dirty ? "changes" : "work"}
        </button>
        <span className="cw-save-state">
          {record ? `Version ${record.version}` : "Not saved"}
          {dirty ? " · Unsaved edits" : ""}
        </span>
      </div>
      {error && (
        <div className="cw-error" role="alert">
          {error}
        </div>
      )}
      <p className="cw-notice" role="status">
        {notice}
      </p>
      {loading ? (
        <div className="cw-empty">
          <Loader2 className="animate-spin" size={24} />
          <p>Opening your saved work…</p>
        </div>
      ) : (
        <fieldset disabled={busy} className="cw-module" key={instance}>
          {kind === "research" && (
            <ResearchWorkspace
              value={document as ResearchDocument}
              onChange={change}
              onBuild={buildStory}
            />
          )}
          {kind === "story" && (
            <StoryWorkspace
              value={document as StoryDocument}
              onChange={change}
              record={record}
              dirty={dirty}
              save={save}
              onTest={buildTest}
            />
          )}
          {kind === "test" && (
            <TestWorkspace value={document as TestDocument} onChange={change} />
          )}
          {kind === "decision" && (
            <DecisionWorkspace
              value={document as DecisionDocument}
              onChange={change}
              record={record}
              save={save}
              onCommitted={(r) => {
                apply(r);
                setNotice(
                  "Decision committed. Your linked plan contains the selected tasks.",
                );
              }}
            />
          )}
        </fieldset>
      )}
      {kind === "decision" && (
        <Link className="cw-link" href="/dashboard/decisions/archive">
          Read earlier strategy sessions and Growth Briefs{" "}
          <ArrowRight size={14} />
        </Link>
      )}
      {record && record.history.length > 0 && (
        <details className="cw-history">
          <summary>
            Saved history · {record.history.length} recent changes
          </summary>
          <ol>
            {record.history
              .slice()
              .reverse()
              .map((h) => (
                <li key={h.version}>
                  <strong>v{h.version}</strong>
                  <span>{h.detail}</span>
                  <time dateTime={h.at}>{new Date(h.at).toLocaleString()}</time>
                </li>
              ))}
          </ol>
        </details>
      )}
    </div>
  );
}
