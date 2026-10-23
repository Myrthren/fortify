const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript");
const root = path.resolve(__dirname, "..");
function fixture() {
  const state = {
    session: { user: { id: "alice" } },
    tier: "APEX",
    records: [],
    plans: [],
    media: [
      {
        id: "mine",
        userId: "alice",
        title: "My video",
        videoUrl: "https://example.com/a.mp4",
      },
      {
        id: "private",
        userId: "bob",
        title: "Private video",
        videoUrl: "https://example.com/private.mp4",
      },
    ],
    logs: [],
    rate: true,
    offline: false,
    failPlan: false,
    generate: true,
    aiText: "See the booking steps before choosing a time.",
    prompts: [],
  };
  const match = (r, w) =>
    Object.entries(w).every(([k, v]) =>
      v && typeof v === "object" && "in" in v
        ? v.in.includes(r[k])
        : r[k] === v,
    );
  const select = (row, keys) =>
    !row
      ? null
      : structuredClone(
          keys
            ? Object.fromEntries(Object.keys(keys).map((k) => [k, row[k]]))
            : row,
        );
  const mutate = (r, d) => {
    if (state.offline) throw Error("DATABASE_PASSWORD_DO_NOT_LEAK");
    for (const [k, v] of Object.entries(d))
      r[k] =
        v && typeof v === "object" && "increment" in v ? r[k] + v.increment : v;
    r.updatedAt = new Date();
  };
  const db = {
    user: {
      findUnique: async ({ where }) =>
        where.id === "alice" ? { id: "alice", tier: state.tier } : null,
    },
    contentRecord: {
      findFirst: async ({ where, select: keys }) => {
        if (state.offline) throw Error("DATABASE_PASSWORD_DO_NOT_LEAK");
        return select(
          state.records.find((r) => match(r, where)),
          keys,
        );
      },
      findMany: async ({ where, select: keys, take }) =>
        state.records
          .filter((r) => match(r, where))
          .slice(0, take)
          .map((r) => select(r, keys)),
      create: async ({ data }) => {
        if (state.offline) throw Error("offline");
        const r = {
          id: "record" + (state.records.length + 1),
          version: 1,
          planId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...structuredClone(data),
        };
        state.records.push(r);
        return structuredClone(r);
      },
      updateMany: async ({ where, data }) => {
        const rows = state.records.filter((r) => match(r, where));
        rows.forEach((r) => mutate(r, data));
        return { count: rows.length };
      },
      update: async ({ where, data }) => {
        const r = state.records.find((r) => match(r, where));
        assert.ok(r);
        mutate(r, data);
        return structuredClone(r);
      },
    },
    mediaItem: {
      count: async ({ where }) =>
        state.media.filter((m) => match(m, where)).length,
      findMany: async ({ where, select: keys }) =>
        state.media.filter((m) => match(m, where)).map((m) => select(m, keys)),
    },
    futurePlan: {
      create: async ({ data }) => {
        if (state.failPlan) throw Error("offline");
        const p = {
          id: "plan" + (state.plans.length + 1),
          ...structuredClone(data),
        };
        state.plans.push(p);
        return structuredClone(p);
      },
      findFirst: async ({ where, select: keys }) =>
        select(
          state.plans.find((p) => match(p, where)),
          keys,
        ),
    },
    brandVoice: {
      findFirst: async () => ({
        name: "NORTH",
        systemPrompt: "Use plain, direct language.",
      }),
    },
    companyDna: {
      findUnique: async () => ({
        entries: [
          { label: "Company", content: "Booking software for salons." },
        ],
      }),
    },
  };
  let queue = Promise.resolve();
  db.$transaction = (fn) => {
    const run = queue.then(async () => {
      const before = structuredClone({
        records: state.records,
        plans: state.plans,
      });
      try {
        return await fn(db);
      } catch (e) {
        state.records = before.records;
        state.plans = before.plans;
        throw e;
      }
    });
    queue = run.catch(() => {});
    return run;
  };
  const cache = new Map();
  function load(relative) {
    const file = path.resolve(
      root,
      relative.endsWith(".ts") ? relative : relative + ".ts",
    );
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    }).outputText;
    function local(name) {
      if (name === "next/server")
        return {
          NextResponse: Object.assign(Response, { json: Response.json }),
        };
      if (name === "@/auth") return { auth: async () => state.session };
      if (name === "@/lib/db") return { db };
      if (name === "@/lib/rate-limit")
        return {
          rateLimit: () => ({ ok: state.rate, resetMs: 10 }),
          rateLimitResponse: () =>
            Response.json({ error: "Wait" }, { status: 429 }),
        };
      if (name === "@/lib/voice")
        return {
          generateInVoice: async (p) => {
            state.prompts.push(p);
            return state.aiText;
          },
        };
      if (name === "@/lib/usage")
        return {
          canGenerate: async () => state.generate,
          logGeneration: async (x) => state.logs.push(x),
        };
      if (name === "@/lib/brave")
        return {
          braveSearch: async () => [
            {
              title: "Source",
              description: "A genuine returned snippet.",
              url: "https://example.com/source",
              source: "Example",
            },
            {
              title: "Unsafe",
              description: "Do not keep.",
              url: "javascript:alert(1)",
            },
          ],
        };
      return load(
        name.startsWith("@/")
          ? name.slice(2)
          : path.relative(root, path.resolve(path.dirname(file), name)),
      );
    }
    new Function("require", "module", "exports", code)(
      local,
      module,
      module.exports,
    );
    return module.exports;
  }
  const d = load("lib/content-workspace"),
    collection = load("app/api/content/route"),
    item = load("app/api/content/[id]/route"),
    commit = load("app/api/content/[id]/commit/route").POST,
    rewrite = load("app/api/content/[id]/rewrite/route").POST;
  async function saved(
    kind = "story",
    document = d.blankContent(kind),
    title = "My work",
  ) {
    const response = await collection.POST(req({ kind, title, document }));
    assert.equal(response.status, 201, await response.clone().text());
    return (await response.json()).record;
  }
  return { state, load, d, collection, item, commit, rewrite, saved };
}
const req = (body, method = "POST", origin = "https://fortify-io.com") =>
  new Request("https://fortify-io.com/api/content", {
    method,
    headers: { origin, "Content-Type": "application/json" },
    body:
      body === undefined
        ? undefined
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
  });
const ctx = (id) => ({ params: Promise.resolve({ id }) });
function decision(d) {
  const x = d.blankContent("decision");
  return {
    ...x,
    question: "Where should we focus?",
    budget: 600,
    reviewDate: "2026-11-10",
    selected: "option-a",
    options: x.options.map((o, i) => ({
      ...o,
      title: i ? "Clarify offer" : "Fix booking",
      cost: i ? 200 : 400,
      days: 5,
      tasks: ["Inspect the journey", "Ship an improvement"],
    })),
  };
}
test("all four workspaces have valid empty states, honest tiers and plain starting actions", () => {
  const { d } = fixture();
  for (const kind of d.CONTENT_KINDS) {
    assert.deepEqual(
      d.parseContent(kind, d.blankContent(kind)),
      d.blankContent(kind),
    );
    assert.ok(d.CONTENT_VIEWS[kind].action);
  }
  assert.equal(d.contentAccess("story", "FREE"), true);
  assert.equal(d.contentAccess("research", "FREE"), false);
  assert.equal(d.contentAccess("test", "PRO"), false);
  assert.equal(d.contentAccess("decision", "ELITE"), false);
  assert.equal(d.contentAccess("decision", "APEX"), true);
});
test("authentication, origin checks and feature access guard every write and private read", async () => {
  for (const session of [null, { user: {} }, { user: { id: 12 } }]) {
    const f = fixture();
    f.state.session = session;
    assert.equal((await f.collection.POST(req({}))).status, 401);
    assert.equal(
      (await f.item.GET(req(undefined, "GET"), ctx("no"))).status,
      401,
    );
    assert.equal((await f.commit(req({ version: 1 }), ctx("no"))).status, 401);
    assert.equal(
      (await f.rewrite(req({ version: 1, beat: "opening" }), ctx("no"))).status,
      401,
    );
  }
  const f = fixture();
  for (const origin of ["", "null", "https://evil.example"])
    assert.equal(
      (await f.collection.POST(req({}, "POST", origin))).status,
      403,
    );
  f.state.tier = "FREE";
  for (const kind of ["research", "test", "decision"])
    assert.equal(
      (
        await f.collection.POST(
          req({ kind, title: "X", document: f.d.blankContent(kind) }),
        )
      ).status,
      403,
    );
  assert.equal(f.state.records.length, 0);
});
test("research survives reload, groups by actual observations and retains source attribution in a story", async () => {
  const f = fixture(),
    o = {
      id: "obs",
      topic: "Missed bookings",
      excerpt: "I cannot reply after closing.",
      source: "Anonymous interview",
      url: "https://example.com/interview",
      date: "2026-10-23",
      type: "interview",
      pinned: true,
      covered: false,
    };
  const r = await f.saved("research", {
    audience: "Salon owners",
    observations: [o],
  });
  const response = await f.item.GET(req(undefined, "GET"), ctx(r.id));
  assert.deepEqual((await response.json()).record.document.observations, [o]);
  const story = await f.saved("story", f.d.storyFromEvidence(o, r.id));
  assert.equal(story.document.evidence[0].excerpt, o.excerpt);
  assert.equal(story.document.researchId, r.id);
  assert.equal(f.d.topicGroups(r.document)[0].length, 1);
});
test("record access and reference validation prevent cross-account reads, edits and media attachment", async () => {
  const f = fixture(),
    r = await f.saved();
  f.state.records[0].userId = "bob";
  assert.equal(
    (await f.item.GET(req(undefined, "GET"), ctx(r.id))).status,
    404,
  );
  assert.equal(
    (await f.item.PATCH(req({ ...r, version: 1 }, "PATCH"), ctx(r.id))).status,
    404,
  );
  const doc = f.d.blankContent("test");
  doc.versions[0].mediaId = "private";
  assert.equal(
    (
      await f.collection.POST(
        req({ kind: "test", title: "Test", document: doc }),
      )
    ).status,
    400,
  );
  doc.versions[0].mediaId = "mine";
  assert.equal(
    (
      await f.collection.POST(
        req({ kind: "test", title: "Test", document: doc }),
      )
    ).status,
    201,
  );
  const story = f.d.blankContent("story");
  story.researchId = r.id;
  assert.equal(
    (
      await f.collection.POST(
        req({ kind: "story", title: "X", document: story }),
      )
    ).status,
    400,
  );
  const media = await f
    .load("app/api/content/media/route")
    .GET(req(undefined, "GET"));
  assert.equal((await media.json()).items.length, 1);
});
test("optimistic saves reject stale edits and preserve a bounded history of decisions", async () => {
  const f = fixture(),
    doc = decision(f.d),
    r = await f.saved("decision", doc);
  let res = await f.item.PATCH(
    req(
      { title: r.title, version: 1, document: { ...doc, budget: 700 } },
      "PATCH",
    ),
    ctx(r.id),
  );
  assert.equal(res.status, 200);
  assert.equal((await res.json()).record.version, 2);
  res = await f.item.PATCH(
    req({ title: "Stale", version: 1, document: doc }, "PATCH"),
    ctx(r.id),
  );
  assert.equal(res.status, 409);
  assert.equal(f.state.records[0].document.budget, 700);
  assert.equal(f.state.records[0].history.length, 2);
  assert.match(f.state.records[0].history[1].detail, /700/);
});
test("approval requires a complete story with supplied evidence for numeric claims", async () => {
  const f = fixture(),
    doc = f.d.blankContent("story");
  doc.approved = true;
  assert.throws(() => f.d.parseContent("story", doc), /every story beat/);
  for (const b of f.d.BEATS) doc.beats[b] = "Plain wording";
  doc.beats.proof = "We increase revenue by 47%.";
  assert.throws(() => f.d.parseContent("story", doc), /unsupported/);
  doc.evidence = [
    {
      title: "Measured result",
      excerpt: "Observed revenue increased 47% for one measured campaign.",
      source: "Our report",
      url: "",
      date: "2026-10-23",
    },
  ];
  assert.equal(f.d.parseContent("story", doc).approved, true);
});
test("test measurements distinguish unknown from zero and cannot record impossible completions", () => {
  const { d } = fixture(),
    doc = d.blankContent("test");
  assert.equal(d.parseContent("test", doc).versions[0].views, null);
  doc.versions[0].views = 0;
  assert.equal(d.parseContent("test", doc).versions[0].views, 0);
  doc.versions[0].completions = 10;
  assert.throws(() => d.parseContent("test", doc), /cannot exceed/);
  doc.versions[0].views = 20;
  doc.versions[0].videoUrl = "https://example.com/clip.mp4";
  doc.notes = [
    {
      id: "note",
      versionId: "version-a",
      seconds: 3.5,
      text: "Show the offer here.",
      kind: "suggestion",
    },
  ];
  assert.equal(d.parseContent("test", doc).notes[0].seconds, 3.5);
  doc.versions[0].mediaId='mine';
  assert.throws(()=>d.parseContent('test',doc),/not both/);
  doc.versions[0].mediaId='';
  doc.notes[0].versionId = "missing";
  assert.throws(() => d.parseContent("test", doc), /valid version/);
});
test("committing a decision creates a real linked plan once, with owned task cards and review date", async () => {
  const f = fixture(),
    doc = decision(f.d),
    r = await f.saved("decision", doc);
  const response = await f.commit(req({ version: 1 }), ctx(r.id));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.record.planId, data.plan.id);
  assert.equal(f.state.plans[0].userId, "alice");
  assert.equal(
    f.state.plans[0].document.nodes.filter((n) => n.kind === "task").length,
    2,
  );
  assert.equal(
    f.state.plans[0].document.nodes.find((n) => n.id === "review").date,
    doc.reviewDate,
  );
  assert.ok(f.state.plans[0].document.nodes.every((n) => !n.workflowId));
  assert.equal((await f.commit(req({ version: 1 }), ctx(r.id))).status, 200);
  assert.equal(f.state.plans.length, 1);
});
test("stale, over-budget or incomplete decisions cannot create a plan; failures roll back the version lock", async () => {
  for (const condition of ["stale", "budget", "tasks", "review", "failure"]) {
    const f = fixture(),
      doc = decision(f.d);
    if (condition === "budget") doc.budget = 100;
    if (condition === "tasks") doc.options[0].tasks = [];
    if (condition === "review") doc.reviewDate = "";
    const r = await f.saved("decision", doc);
    if (condition === "failure") f.state.failPlan = true;
    const res = await f.commit(
      req({ version: condition === "stale" ? 99 : 1 }),
      ctx(r.id),
    );
    assert.notEqual(res.status, 200, condition);
    assert.equal(f.state.plans.length, 0);
    assert.equal(f.state.records[0].version, 1);
  }
});
test("concurrent plan commits cannot duplicate tasks or overwrite a chosen plan", async () => {
  const f = fixture(),
    r = await f.saved("decision", decision(f.d));
  const results = await Promise.all([
    f.commit(req({ version: 1 }), ctx(r.id)),
    f.commit(req({ version: 1 }), ctx(r.id)),
  ]);
  assert.ok(results.every((r) => r.status === 200));
  assert.equal(f.state.plans.length, 1);
});
test("long task names and full reasoning remain available through a valid linked plan", async () => {
  const f = fixture(),
    doc = decision(f.d),
    longTask = "Review ".repeat(28);
  doc.question = "Q".repeat(1000);
  doc.options[0].requirements = "R".repeat(3000);
  doc.options[0].tradeoffs = "T".repeat(3000);
  doc.options[0].tasks = [longTask];
  const r = await f.saved("decision", doc);
  assert.equal((await f.commit(req({ version: 1 }), ctx(r.id))).status, 200);
  const plan = f.state.plans[0].document;
  assert.ok(plan.nodes.find((n) => n.kind === "task").title.length <= 120);
  assert.ok(
    plan.nodes.find((n) => n.kind === "task").body.includes(longTask.trim()),
  );
  assert.equal(
    plan.nodes[0].url,
    `https://fortify-io.com/dashboard/decisions?id=${r.id}`,
  );
  assert.match(f.state.records[0].history.at(-1).detail, /Plan created/);
  const invalid = decision(f.d);
  invalid.options[1].title = "";
  assert.throws(() => f.d.decisionPlan("Plan", invalid), /two alternatives/);
});
test("writing assistance uses the saved brief, voice and company context without changing a story", async () => {
  const f = fixture(),
    doc = f.d.blankContent("story");
  doc.idea = "Explain booking after closing.";
  const r = await f.saved("story", doc);
  const response = await f.rewrite(
    req({ version: 1, beat: "opening" }),
    ctx(r.id),
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).voice, "NORTH");
  assert.match(f.state.prompts[0].systemPrompt, /Booking software/);
  assert.equal(f.state.records[0].version, 1);
  assert.equal(f.state.records[0].document.beats.opening, "");
  assert.equal(f.state.logs.length, 1);
  f.state.aiText = "47% more revenue.";
  assert.equal(
    (await f.rewrite(req({ version: 1, beat: "opening" }), ctx(r.id))).status,
    422,
  );
  f.state.records[0].document.locks = ["opening"];
  assert.equal(
    (await f.rewrite(req({ version: 1, beat: "opening" }), ctx(r.id))).status,
    400,
  );
});
test("invalid URLs, dates, dimensions and bodies fail before writes and operational errors do not expose secrets", async () => {
  const f = fixture();
  for (const url of [
    "javascript:alert(1)",
    "https://a:b@example.com",
    "file:///private",
  ])
    assert.throws(() => f.d.contentUrl(url));
  for (const body of [
    "null",
    "{bad",
    JSON.stringify({ kind: "story", title: "X", document: null }),
    "x".repeat(192001),
  ])
    assert.equal((await f.collection.POST(req(body))).status, 400);
  const x = decision(f.d);
  x.reviewDate = "2026-02-30";
  assert.throws(() => f.d.parseContent("decision", x));
  f.state.rate = false;
  assert.equal((await f.collection.POST(req({}))).status, 429);
  f.state.rate = true;
  f.state.offline = true;
  const res = await f.item.GET(req(undefined, "GET"), ctx("x"));
  assert.equal(res.status, 503);
  assert.ok(!(await res.text()).includes("DATABASE_PASSWORD"));
});
test("search returns attributed provider snippets, filters unsafe URLs and does not invent research", async () => {
  const f = fixture(),
    previous = process.env.BRAVE_API_KEY;
  try {
    process.env.BRAVE_API_KEY = "fixture-only";
    const response = await f
      .load("app/api/content/search/route")
      .POST(req({ query: "booking after hours" }));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.results.length, 1);
    assert.equal(data.results[0].excerpt, "A genuine returned snippet.");
    assert.equal(f.state.records.length, 0);
    delete process.env.BRAVE_API_KEY;
    assert.equal(
      (
        await f
          .load("app/api/content/search/route")
          .POST(req({ query: "booking after hours" }))
      ).status,
      503,
    );
  } finally {
    if (previous === undefined) delete process.env.BRAVE_API_KEY;
    else process.env.BRAVE_API_KEY = previous;
  }
});
