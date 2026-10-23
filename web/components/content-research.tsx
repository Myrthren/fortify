"use client";
import { useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Search,
  Plus,
  Pin,
  Trash2,
  ExternalLink,
  Check,
  Loader2,
  List,
  Orbit,
} from "lucide-react";
import {
  topicGroups,
  contentId,
  parseContent,
  type ResearchDocument,
  type Observation,
  type Evidence,
} from "@/lib/content-workspace";
import { contentRequest } from "./content-workbench";
import { Field, Guide, Empty } from "./content-fields";
const today = () => new Date().toISOString().slice(0, 10);
const draft = (): Observation => ({
  id: contentId(),
  topic: "",
  excerpt: "",
  source: "",
  url: "",
  date: today(),
  type: "interview",
  pinned: false,
  covered: false,
});
export function ResearchWorkspace({
  value,
  onChange,
  onBuild,
}: {
  value: ResearchDocument;
  onChange: (d: ResearchDocument) => void;
  onBuild: (o: Observation) => Promise<void>;
}) {
  const [form, setForm] = useState(draft),
    [editing, setEditing] = useState(false),
    [selected, setSelected] = useState(""),
    [query, setQuery] = useState(""),
    [searching, setSearching] = useState(false),
    [results, setResults] = useState<Evidence[]>([]),
    [error, setError] = useState(""),
    [list, setList] = useState(false);
  const intake = useRef<HTMLDetailsElement>(null),
    groups = useMemo(() => topicGroups(value), [value]),
    active =
      value.observations.find((o) => o.id === selected) || groups[0]?.[0],
    cluster = groups.find((g) => g.some((o) => o.id === active?.id)) || [],
    showList = list || groups.length > 6;
  const patch = (patch: Partial<Observation>) => {
    if (active)
      onChange({
        ...value,
        observations: value.observations.map((o) =>
          o.id === active.id ? { ...o, ...patch } : o,
        ),
      });
  };
  function add() {
    try {
      const observations = editing
        ? value.observations.map((o) => (o.id === form.id ? form : o))
        : [...value.observations, form];
      const next = parseContent("research", {
        ...value,
        observations,
      }) as ResearchDocument;
      onChange(next);
      setSelected(form.id);
      setForm(draft());
      setEditing(false);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function search() {
    setSearching(true);
    setError("");
    try {
      const data = await contentRequest("/api/content/search", "POST", {
        query,
      });
      setResults(data.results);
      if (!data.results.length)
        setError(
          "No sources found. Try a broader question or add your own source.",
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  }
  function importSource(e: Evidence) {
    const o: Observation = {
      ...draft(),
      topic: query.trim().slice(0, 120),
      excerpt: e.excerpt,
      source: e.source.slice(0, 200),
      url: e.url,
      type: "search",
      date: e.date,
    };
    try {
      onChange(
        parseContent("research", {
          ...value,
          observations: [...value.observations, o],
        }) as ResearchDocument,
      );
      setSelected(o.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <Guide
        steps={[
          "Add a customer question or search for sources",
          "Select a topic and inspect its evidence",
          "Turn a useful observation into a story",
        ]}
      />
      <details
        ref={intake}
        open={!value.observations.length}
        className="cw-intake"
      >
        <summary>Add an observation or find more sources</summary>
        <div className="cw-two cw-research-start">
          <section className="cw-panel">
            <h2>
              {editing ? "Edit the observation" : "Add something you heard"}
            </h2>
            <p className="cw-help">
              Paste a real comment, an interview note or a question. Nothing is
              added automatically.
            </p>
            <Field label="Who is the audience?">
              <input
                className="input"
                value={value.audience}
                maxLength={300}
                placeholder="e.g. Local salon owners"
                onChange={(e) =>
                  onChange({ ...value, audience: e.target.value })
                }
              />
            </Field>
            <div className="cw-two">
              <Field label="Topic / question">
                <input
                  className="input"
                  value={form.topic}
                  maxLength={120}
                  placeholder="e.g. Customers cannot book after closing"
                  onChange={(e) => setForm({ ...form, topic: e.target.value })}
                />
              </Field>
              <Field label="Source type">
                <select
                  className="input"
                  value={form.type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      type: e.target.value as Observation["type"],
                    })
                  }
                >
                  <option value="interview">Customer interview</option>
                  <option value="comment">Customer comment</option>
                  <option value="note">My observation</option>
                  <option value="search">Search snippet</option>
                </select>
              </Field>
            </div>
            <Field label="What was said or observed?">
              <textarea
                className="input"
                rows={3}
                maxLength={4000}
                value={form.excerpt}
                onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
              />
            </Field>
            <Field label="Source / attribution">
              <input
                className="input"
                placeholder="e.g. Anonymous customer interview, 23 October"
                value={form.source}
                maxLength={200}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
              />
            </Field>
            <div className="cw-two">
              <Field label="Source URL (optional)">
                <input
                  className="input"
                  type="url"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                />
              </Field>
              <Field label="Observed / collected on">
                <input
                  className="input"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </Field>
            </div>
            <div className="cw-row">
              <button type="button" className="btn-secondary" onClick={add}>
                <Plus size={14} />
                {editing ? "Apply observation edit" : "Add to my research"}
              </button>
              {editing && (
                <button
                  type="button"
                  className="cw-text-button"
                  onClick={() => {
                    setEditing(false);
                    setForm(draft());
                  }}
                >
                  Cancel edit
                </button>
              )}
            </div>
          </section>
          <section className="cw-panel">
            <h2>Find supporting sources</h2>
            <p className="cw-help">
              Search the web, inspect the original page, then choose which
              snippets to keep. These are search excerpts, not verified
              full-page quotations.
            </p>
            <Field label="Research question">
              <input
                className="input"
                value={query}
                maxLength={200}
                placeholder="e.g. salon customers booking after hours"
                onChange={(e) => setQuery(e.target.value)}
              />
            </Field>
            <button
              type="button"
              className="btn-secondary"
              disabled={searching || query.trim().length < 3}
              onClick={() => void search()}
            >
              {searching ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Search size={14} />
              )}{" "}
              Search sources
            </button>
            {results.length > 0 && (
              <div className="cw-search-results">
                {results.map((e) => {
                  const added = value.observations.some(
                    (o) => o.url === e.url && o.excerpt === e.excerpt,
                  );
                  return (
                    <article key={e.url}>
                      <a
                        className="cw-link"
                        href={e.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {e.title} <ExternalLink size={12} />
                      </a>
                      <p>{e.excerpt}</p>
                      <small>
                        Collected {e.date} · {e.source}
                      </small>
                      <button
                        type="button"
                        className="cw-text-button"
                        disabled={added}
                        onClick={() => importSource(e)}
                      >
                        {added ? <Check size={13} /> : <Plus size={13} />}{" "}
                        {added ? "Added" : "Keep this source"}
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </details>
      {error && (
        <p className="cw-error" role="alert">
          {error}
        </p>
      )}
      <div className="cw-row cw-section-heading">
        <div>
          <h2>Your audience map</h2>
          <p className="cw-help">
            {value.observations.length} collected observations. Topic size shows
            collected mentions, not market demand.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          disabled={groups.length > 6}
          onClick={() => setList(!list)}
        >
          {list ? <Orbit size={14} /> : <List size={14} />}{" "}
          {groups.length > 6
            ? "List view · many topics"
            : list
              ? "Map view"
              : "List view"}
        </button>
      </div>
      {!groups.length ? (
        <Empty title="Your map starts with one observation">
          Add a real question or source above. Related topics will appear here.
        </Empty>
      ) : (
        <div className="cw-atlas-layout">
          <div
            className={showList ? "cw-topic-list" : "cw-atlas"}
            aria-label="Audience topics"
          >
            {!showList && <div className="cw-atlas-rings" aria-hidden="true" />}
            {(showList ? groups : groups.slice(0, 10)).map((g, i) => {
              const angle =
                  (i * 2 * Math.PI) / Math.min(groups.length, 10) - Math.PI / 2,
                center = groups.length === 1,
                x = center ? 50 : 50 + 33 * Math.cos(angle),
                y = center ? 48 : 47 + 32 * Math.sin(angle);
              return (
                <button
                  type="button"
                  key={g[0].topic.toLowerCase()}
                  className={`cw-topic ${cluster === g || g.some((o) => o.id === active?.id) ? "cw-selected" : ""}`}
                  style={showList ? undefined : { left: `${x}%`, top: `${y}%` }}
                  aria-pressed={g.some((o) => o.id === active?.id)}
                  onClick={() => setSelected(g[0].id)}
                >
                  <span
                    className="cw-topic-orb"
                    style={{
                      width: Math.min(80, 38 + Math.sqrt(g.length) * 8),
                      height: Math.min(80, 38 + Math.sqrt(g.length) * 8),
                    }}
                  >
                    {g.length}
                  </span>
                  <strong>{g[0].topic}</strong>
                  {g.some((o) => o.pinned) && (
                    <Pin size={12} aria-label="Pinned topic" />
                  )}
                </button>
              );
            })}
            {!showList && groups.length > 10 && (
              <p className="cw-map-footnote">
                Showing 10 largest topics. Open List view to see all{" "}
                {groups.length}.
              </p>
            )}
          </div>
          {active && (
            <aside className="cw-panel cw-evidence-dock">
              <span className="eyebrow">
                {active.type === "search"
                  ? "Search snippet"
                  : "Audience evidence"}{" "}
                / {cluster.length} in this topic
              </span>
              <h2>{active.topic}</h2>
              <p className="cw-quote">{active.excerpt}</p>
              <p className="cw-help">
                {active.source}
                <br />
                {active.date || "Date not recorded"}
              </p>
              {active.url && (
                <a
                  className="cw-link"
                  href={active.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Inspect original source <ExternalLink size={13} />
                </a>
              )}
              <div className="cw-observation-picker">
                {cluster.map((o, i) => (
                  <button
                    type="button"
                    key={o.id}
                    aria-pressed={active.id === o.id}
                    onClick={() => setSelected(o.id)}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <div className="cw-row">
                <label className="cw-check">
                  <input
                    type="checkbox"
                    checked={active.pinned}
                    onChange={(e) => patch({ pinned: e.target.checked })}
                  />{" "}
                  Pin this observation
                </label>
                <label className="cw-check">
                  <input
                    type="checkbox"
                    checked={active.covered}
                    onChange={(e) => patch({ covered: e.target.checked })}
                  />{" "}
                  Already covered
                </label>
              </div>
              <button
                type="button"
                className="cw-text-button"
                onClick={() => {
                  setForm({ ...active });
                  setEditing(true);
                  if (intake.current) {
                    intake.current.open = true;
                    intake.current.scrollIntoView({
                      block: "start",
                      behavior: "smooth",
                    });
                  }
                }}
              >
                Edit or regroup this observation
              </button>
              <button
                type="button"
                className="cw-text-button"
                onClick={() => {
                  onChange({
                    ...value,
                    observations: value.observations.filter(
                      (o) => o.id !== active.id,
                    ),
                  });
                  setSelected("");
                }}
              >
                <Trash2 size={13} /> Remove from this research
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void onBuild(active)}
              >
                Build a story from this <ArrowRight size={15} />
              </button>
              <small className="cw-help">
                Saves this research and creates a linked story with its source
                attached.
              </small>
            </aside>
          )}
        </div>
      )}
    </>
  );
}
