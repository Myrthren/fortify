const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), ts = require("typescript");
const root = path.resolve(__dirname, ".."), cache = new Map();
function load(file) { file = path.resolve(file); if (!path.extname(file)) file += ".ts"; if (cache.has(file)) return cache.get(file); const exports = {}; cache.set(file, exports); const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText; new Function("require", "exports", code)(name => load(path.resolve(path.dirname(file), name)), exports); return exports; }
const { SIMULATION_THEMES, isSimulationTheme } = load(path.join(root, "lib/institute-themes.ts"));
const { presentThemeText, themePerson, THEME_PRESENTATION } = load(path.join(root, "lib/institute-theme-presentation.ts"));

test("Fortify ships three concrete simulation environments", () => {
  assert.deepEqual(Object.keys(SIMULATION_THEMES), ["research", "operations", "orbital"]);
  assert.equal(new Set(Object.values(SIMULATION_THEMES).map(theme => theme.name)).size, 3);
  for (const theme of Object.values(SIMULATION_THEMES)) {
    assert.match(theme.signal, /^#[0-9a-f]{6}$/i);
    assert.match(theme.background, /^#[0-9a-f]{6}$/i);
    assert.ok(theme.description.length > 30);
    assert.ok(theme.sceneLabel.length > 3);
    assert.equal(theme.zones.length, 5);
    assert.equal(theme.priorities.length, 3);
    assert.ok(theme.objective.length > 30);
  }
  assert.equal(new Set(Object.values(SIMULATION_THEMES).map(theme => theme.objectiveLabel)).size, 3);
});

test("saved environment values are guarded before they reach the renderer", () => {
  assert.equal(isSimulationTheme("orbital"), true);
  assert.equal(isSimulationTheme("powerpoint"), false);
  assert.equal(isSimulationTheme(null), false);
});

test("each environment presents its own roles, work and operational vocabulary", () => {
  assert.equal(themePerson("operations", "sol", { role: "Lab technician", goal: "Fallback" }).role, "Automation specialist");
  assert.equal(themePerson("orbital", "nia", { role: "Research director", goal: "Fallback" }).role, "Mission commander");
  assert.match(presentThemeText("operations", "The researcher ran an experiment on the test bench."), /operator ran a run on the control pod/i);
  assert.match(presentThemeText("orbital", "The instrument produced research evidence for the dataset."), /vessel system produced mission telemetry for the flight profile/i);
  assert.deepEqual(Object.values(THEME_PRESENTATION).map(item => item.recordPlural), ["Experiments", "Runs", "Trials"]);
  assert.equal(THEME_PRESENTATION.operations.screenHealthKey, "system_health");
  assert.equal(THEME_PRESENTATION.orbital.screenRevisionKey, "flight_profile");
  assert.match(presentThemeText("operations", "Two compute slots and 8 project credits."), /Two delivery slots and 8 programme credits/);
  assert.equal(presentThemeText("operations", "for hypothesis in approaches:"), "for procedure in programmes:");
  assert.equal(presentThemeText("orbital", "for hypothesis in approaches:"), "for strategy in subsystems:");
});
