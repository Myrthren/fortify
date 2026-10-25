const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), ts = require("typescript");
const root = path.resolve(__dirname, ".."), cache = new Map();
function load(file) { file = path.resolve(file); if (!path.extname(file)) file += ".ts"; if (cache.has(file)) return cache.get(file); const exports = {}; cache.set(file, exports); const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText; new Function("require", "exports", code)(name => load(path.resolve(path.dirname(file), name)), exports); return exports; }
const { BUSINESS_LIMITS, buildBusinessRecommendations, businessLimitLabel, parseBusinessSetup } = load(path.join(root, "lib/business-setup.ts"));
const input = { name: " Northstar ", website: "https://northstar.test", industry: "Research", stage: "Growing", businessModel: "Services", offer: "Decision research", audience: "Product teams", objective: "Win ten retained clients", bottleneck: "Manual repeated reporting takes too much time", teamSize: "4", channels: ["Outbound", "Content", "Unknown", "Outbound"] };

test("business limits match the Fortify plans", () => {
  assert.deepEqual(BUSINESS_LIMITS, { FREE: 0, PRO: 1, ELITE: 5, APEX: Infinity });
  assert.equal(businessLimitLabel(BUSINESS_LIMITS.APEX), "Unlimited");
});

test("the setup parser normalises usable business context", () => {
  const parsed = parseBusinessSetup(input);
  assert.equal(parsed.name, "Northstar");
  assert.deepEqual(parsed.channels, ["Outbound", "Content"]);
  assert.equal(parsed.website, "https://northstar.test");
  assert.throws(() => parseBusinessSetup({ ...input, website: "northstar.test" }), /full website address/);
  assert.throws(() => parseBusinessSetup({ ...input, channels: [] }), /at least one/);
});

test("the blueprint directs demand and systems work into real Fortify tools", () => {
  const recommendations = buildBusinessRecommendations(parseBusinessSetup(input));
  assert.deepEqual(recommendations.map(item => item.phase), ["Foundation", "Demand", "Systems"]);
  assert.equal(recommendations[1].href, "/dashboard/pipeline");
  assert.equal(recommendations[2].href, "/dashboard/workflows");
  assert.match(recommendations[2].detail, /Manual repeated reporting/);
});

test("the deployment schema enforces one active context per account", () => {
  const sql = fs.readFileSync(path.join(root, "prisma/business-setup.sql"), "utf8");
  assert.match(sql, /BusinessProfile_one_active_per_user_idx/);
  assert.match(sql, /WHERE "active" = true/);
  assert.match(sql, /ROW_NUMBER\(\) OVER \(PARTITION BY "userId"/);
});
