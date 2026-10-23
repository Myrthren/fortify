import { unsupportedFigures } from "./facts";
import type { PlanDocument, PlanNode } from "./future-plans";

export const CONTENT_KINDS = ["research", "story", "test", "decision"] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];
export const BEATS = [
  "opening",
  "problem",
  "proof",
  "payoff",
  "action",
] as const;
export type Beat = (typeof BEATS)[number];
export const CONTENT_VIEWS = {
  research: {
    name: "Signal Atlas",
    action: "Find a content idea",
    help: "Collect a question or source, inspect the evidence, then turn it into a story.",
    tier: "PRO",
  },
  story: {
    name: "Story Forge",
    action: "Build a video or post",
    help: "Start with one idea. Write each beat, compare openings and approve your script.",
    tier: null,
  },
  test: {
    name: "Content Test Track",
    action: "Review my content",
    help: "Choose your video, add timed notes, then record the results of a specific change.",
    tier: "ELITE",
  },
  decision: {
    name: "Decision Room",
    action: "Choose my next move",
    help: "Write a question, compare options and turn your choice into a linked plan.",
    tier: "APEX",
  },
} as const;
export type Observation = {
  id: string;
  topic: string;
  excerpt: string;
  source: string;
  url: string;
  date: string;
  type: "interview" | "comment" | "search" | "note";
  pinned: boolean;
  covered: boolean;
};
export type ResearchDocument = {
  audience: string;
  observations: Observation[];
};
export type Evidence = {
  title: string;
  excerpt: string;
  url: string;
  source: string;
  date: string;
};
export type StoryDocument = {
  idea: string;
  platform: string;
  evidence: Evidence[];
  researchId: string;
  beats: Record<Beat, string>;
  locks: Beat[];
  openings: string[];
  approved: boolean;
};
export type TestVersion = {
  id: string;
  label: string;
  mediaId: string;
  videoUrl: string;
  publication: string;
  audience: string;
  publishedAt: string;
  views: number | null;
  completions: number | null;
  responses: number | null;
};
export type TestDocument = {
  storyId: string;
  hypothesis: string;
  versions: TestVersion[];
  notes: {
    id: string;
    versionId: string;
    seconds: number;
    text: string;
    kind: "observation" | "suggestion";
  }[];
  conclusion: string;
};
export type DecisionOption = {
  id: string;
  title: string;
  cost: number;
  days: number;
  tradeoffs: string;
  requirements: string;
  tasks: string[];
};
export type DecisionDocument = {
  question: string;
  budget: number;
  currency: "GBP" | "USD" | "EUR";
  options: DecisionOption[];
  selected: string;
  evidence: Evidence[];
  reviewDate: string;
  outcome: string;
};
export type ContentDocument =
  | ResearchDocument
  | StoryDocument
  | TestDocument
  | DecisionDocument;
export type ContentSummary = {
  id: string;
  kind: ContentKind;
  title: string;
  version: number;
  planId: string | null;
  updatedAt: string;
};
export type ContentRecordView = ContentSummary & {
  document: ContentDocument;
  history: { version: number; at: string; detail: string }[];
};
export const isContentKind = (v: unknown): v is ContentKind =>
  CONTENT_KINDS.includes(v as ContentKind);
export const contentAccess = (kind: ContentKind, tier: string) =>
  (({ FREE: 0, PRO: 1, ELITE: 2, APEX: 3 })[tier] ?? -1) >=
  { research: 1, story: 0, test: 2, decision: 3 }[kind];
export const contentHref = (kind: ContentKind, id?: string) =>
  `${kind === "decision" ? "/dashboard/decisions" : `/dashboard/content?view=${kind}`}${id ? `${kind === "decision" ? "?" : "&"}id=${encodeURIComponent(id)}` : ""}`;
export const contentId = () => globalThis.crypto.randomUUID();
export function blankContent(kind: ContentKind): ContentDocument {
  if (kind === "research") return { audience: "", observations: [] };
  if (kind === "story")
    return {
      idea: "",
      platform: "Short video",
      evidence: [],
      researchId: "",
      beats: { opening: "", problem: "", proof: "", payoff: "", action: "" },
      openings: [],
      locks: [],
      approved: false,
    };
  if (kind === "test")
    return {
      storyId: "",
      hypothesis: "",
      versions: [
        {
          id: "version-a",
          label: "Original",
          mediaId: "",
          videoUrl: "",
          publication: "",
          audience: "",
          publishedAt: "",
          views: null,
          completions: null,
          responses: null,
        },
      ],
      notes: [],
      conclusion: "",
    };
  return {
    question: "",
    budget: 0,
    currency: "GBP",
    options: [
      {
        id: "option-a",
        title: "",
        cost: 0,
        days: 1,
        tradeoffs: "",
        requirements: "",
        tasks: [],
      },
      {
        id: "option-b",
        title: "",
        cost: 0,
        days: 1,
        tradeoffs: "",
        requirements: "",
        tasks: [],
      },
    ],
    selected: "",
    evidence: [],
    reviewDate: "",
    outcome: "",
  };
}
const object = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw Error("Invalid document.");
  return v as Record<string, unknown>;
};
function text(v: unknown, label: string, max = 2000, required = false) {
  if (typeof v !== "string" || v.length > max || (required && !v.trim()))
    throw Error(
      `${label}: ${required ? "enter text, " : ""}maximum ${max} characters.`,
    );
  return v.trim();
}
function number(v: unknown, label: string, max: number, integer = false) {
  if (
    typeof v !== "number" ||
    !Number.isFinite(v) ||
    v < 0 ||
    v > max ||
    (integer && !Number.isInteger(v))
  )
    throw Error(
      `${label} must be ${integer ? "a whole number " : ""}between 0 and ${max}.`,
    );
  return v;
}
function list(v: unknown, max: number) {
  if (!Array.isArray(v) || v.length > max)
    throw Error(`Use no more than ${max} items.`);
  return v;
}
function uid(v: unknown) {
  const t = text(v, "Identifier", 100, true);
  if (!/^[a-zA-Z0-9_-]+$/.test(t)) throw Error("Invalid identifier.");
  return t;
}
function date(v: unknown) {
  const t = text(v, "Date", 10);
  if (
    t &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(t) ||
      !Number.isFinite(new Date(t + "T00:00:00Z").getTime()) ||
      new Date(t + "T00:00:00Z").toISOString().slice(0, 10) !== t)
  )
    throw Error("Use a valid date.");
  return t;
}
export function contentUrl(v: unknown) {
  const t = text(v, "Source URL", 2048);
  if (!t) return "";
  let u;
  try {
    u = new URL(t);
  } catch {
    throw Error("Enter a complete http or https URL.");
  }
  if (!["https:", "http:"].includes(u.protocol) || u.username || u.password)
    throw Error("Use an http or https URL without login details.");
  return u.toString();
}
function boolean(v: unknown) {
  if (typeof v !== "boolean") throw Error("Invalid switch value.");
  return v;
}
function unique<T extends { id: string }>(rows: T[]) {
  if (new Set(rows.map((r) => r.id)).size !== rows.length)
    throw Error("Each item needs its own identifier.");
  return rows;
}
function evidence(v: unknown): Evidence[] {
  return list(v, 30).map((x) => {
    const e = object(x);
    return {
      title: text(e.title, "Evidence title", 200, true),
      excerpt: text(e.excerpt, "Evidence", 4000, true),
      url: contentUrl(e.url),
      source: text(e.source, "Source", 200, true),
      date: date(e.date),
    };
  });
}
export function contentTitle(v: unknown) {
  return text(v, "Title", 120, true);
}
export function parseContent(
  kind: ContentKind,
  value: unknown,
): ContentDocument {
  const d = object(value);
  if (kind === "research")
    return {
      audience: text(d.audience, "Audience", 300),
      observations: unique(
        list(d.observations, 100).map((v) => {
          const o = object(v);
          if (
            !["interview", "comment", "search", "note"].includes(
              o.type as string,
            )
          )
            throw Error("Choose a source type.");
          return {
            id: uid(o.id),
            topic: text(o.topic, "Topic", 120, true),
            excerpt: text(o.excerpt, "Source excerpt", 4000, true),
            source: text(o.source, "Source name", 200, true),
            url: contentUrl(o.url),
            date: date(o.date),
            type: o.type as Observation["type"],
            pinned: boolean(o.pinned),
            covered: boolean(o.covered),
          };
        }),
      ),
    };
  if (kind === "story") {
    const beats = object(d.beats);
    const result: StoryDocument = {
      idea: text(d.idea, "Idea", 2000),
      platform: text(d.platform, "Platform", 80, true),
      researchId: d.researchId ? uid(d.researchId) : "",
      evidence: evidence(d.evidence),
      beats: Object.fromEntries(
        BEATS.map((b) => [b, text(beats[b], b, 4000)]),
      ) as Record<Beat, string>,
      locks: [
        ...new Set(
          list(d.locks, 5).map((b) => {
            if (!BEATS.includes(b as Beat)) throw Error("Unknown story beat.");
            return b as Beat;
          }),
        ),
      ],
      openings: list(d.openings, 8).map((t) => text(t, "Opening", 1000, true)),
      approved: boolean(d.approved),
    };
    if (result.approved && BEATS.some((b) => !result.beats[b]))
      throw Error("Complete every story beat before approving.");
    if (result.approved && storyFigures(result).length)
      throw Error("Review unsupported figures before approving this story.");
    return result;
  }
  if (kind === "test") {
    const versions = unique(
      list(d.versions, 4).map((v) => {
        const x = object(v);
        const metric = (k: string) =>
          x[k] === null ? null : number(x[k], k, 1e10, true);
        const result: TestVersion = {
          id: uid(x.id),
          label: text(x.label, "Version name", 100, true),
          mediaId: x.mediaId ? uid(x.mediaId) : "",
          videoUrl: contentUrl(x.videoUrl),
          publication: contentUrl(x.publication),
          audience: text(x.audience, "Audience and timing context", 1000),
          publishedAt: date(x.publishedAt),
          views: metric("views"),
          completions: metric("completions"),
          responses: metric("responses"),
        };
        if (result.mediaId && result.videoUrl)
          throw Error(
            "Choose saved media or a hosted URL for each version, not both.",
          );
        if (
          result.completions !== null &&
          (result.views === null || result.completions > result.views)
        )
          throw Error(
            "Completed views require a view count and cannot exceed total views.",
          );
        return result;
      }),
    );
    if (!versions.length) throw Error("Keep at least one version.");
    return {
      storyId: d.storyId ? uid(d.storyId) : "",
      hypothesis: text(d.hypothesis, "Hypothesis", 2000),
      versions,
      notes: unique(
        list(d.notes, 100).map((v) => {
          const n = object(v);
          if (
            !versions.some((x) => x.id === n.versionId) ||
            !["observation", "suggestion"].includes(n.kind as string)
          )
            throw Error("A note needs a valid version and type.");
          return {
            id: uid(n.id),
            versionId: uid(n.versionId),
            seconds: number(n.seconds, "Timestamp", 86400),
            text: text(n.text, "Note", 2000, true),
            kind: n.kind as "observation" | "suggestion",
          };
        }),
      ),
      conclusion: text(d.conclusion, "Conclusion", 4000),
    };
  }
  const options = unique(
    list(d.options, 6).map((v) => {
      const o = object(v);
      return {
        id: uid(o.id),
        title: text(o.title, "Option title", 200),
        cost: number(o.cost, "Estimated cost", 1e9),
        days: number(o.days, "Workdays", 3650, true),
        tradeoffs: text(o.tradeoffs, "Tradeoffs", 3000),
        requirements: text(o.requirements, "Requirements", 3000),
        tasks: list(o.tasks, 20).map((t) => text(t, "Task", 200, true)),
      };
    }),
  );
  const selected = d.selected ? uid(d.selected) : "";
  if (selected && !options.some((o) => o.id === selected))
    throw Error("Choose an existing option.");
  return {
    question: text(d.question, "Decision question", 1000),
    budget: number(d.budget, "Budget", 1e9),
    currency: ["GBP", "USD", "EUR"].includes(d.currency as string)
      ? (d.currency as DecisionDocument["currency"])
      : (() => {
          throw Error("Choose a supported currency.");
        })(),
    options,
    selected,
    evidence: evidence(d.evidence),
    reviewDate: date(d.reviewDate),
    outcome: text(d.outcome, "Outcome review", 4000),
  };
}
export function storyFigures(d: StoryDocument) {
  return unsupportedFigures(
    BEATS.map((b) => d.beats[b]).join("\n"),
    d.idea,
    ...d.evidence.map((e) => e.excerpt),
  );
}
export function observationEvidence(o: Observation): Evidence {
  return {
    title: o.topic,
    excerpt: o.excerpt,
    url: o.url,
    source: o.source,
    date: o.date,
  };
}
export function storyFromEvidence(
  o: Observation,
  researchId: string,
): StoryDocument {
  return {
    ...(blankContent("story") as StoryDocument),
    idea: o.topic,
    researchId,
    evidence: [observationEvidence(o)],
  };
}
export function topicGroups(d: ResearchDocument) {
  const groups = new Map<string, Observation[]>();
  for (const o of d.observations) {
    const key = o.topic.toLocaleLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), o]);
  }
  return [...groups.values()].sort((a, b) => b.length - a.length);
}
export function decisionPlan(title: string, d: DecisionDocument): PlanDocument {
  if (d.options.filter((o) => o.title.trim()).length < 2)
    throw Error(
      "Name at least two alternatives before committing this decision.",
    );
  const o = d.options.find((o) => o.id === d.selected);
  if (!d.question || !o?.title || !o.tasks.length || !d.reviewDate)
    throw Error(
      "Add a question, select a named option, add tasks and set a review date first.",
    );
  if (o.cost > d.budget) throw Error("This option exceeds your stated budget.");
  const node = (
    id: string,
    kind: PlanNode["kind"],
    title: string,
    body: string,
    x: number,
    y: number,
  ): PlanNode => ({
    id,
    kind,
    title: title.length > 120 ? title.slice(0, 117) + "…" : title,
    body: title.length > 120 ? `${title}\n\n${body}` : body,
    x,
    y,
    width: 300,
    height: 180,
    status: "planned",
  });
  const nodes: PlanNode[] = [
    node(
      "decision",
      "decision",
      title,
      `${d.question}\n\nChosen: ${o.title}\nCost assumption: ${d.currency} ${o.cost}; ${o.days} workdays.\n\nFull evidence, requirements and tradeoffs remain in the linked decision.`,
      0,
      0,
    ),
    ...o.tasks.map((t, i) =>
      node(
        `task-${i}`,
        "task",
        t,
        "",
        350 + (i % 3) * 340,
        Math.floor(i / 3) * 230,
      ),
    ),
    {
      ...node(
        "review",
        "milestone",
        "Review the outcome",
        "Return to the linked decision and record what happened.",
        0,
        240,
      ),
      date: d.reviewDate,
    },
  ];
  return {
    nodes,
    edges: [
      ...o.tasks.map((_, i) => ({
        id: `edge-${i}`,
        from: i ? `task-${i - 1}` : "decision",
        to: `task-${i}`,
        relation: "blocks" as const,
        label: "Do next",
      })),
      {
        id: "review-edge",
        from: `task-${o.tasks.length - 1}`,
        to: "review",
        relation: "blocks",
        label: "Review after completion",
      },
    ],
    viewport: { x: 40, y: 45, zoom: 0.7 },
  };
}
