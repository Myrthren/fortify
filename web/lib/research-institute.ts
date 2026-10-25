// A bounded, seeded agent world. Model choices never author experimental results.
export const LAB_ROUNDS = 24;
export const TARGET = .82;
export const FOCUS = ["balanced", "rigour", "speed"] as const;
export type Focus = typeof FOCUS[number];
export type Method = "calibration" | "redundancy";
export type Location = "office" | "workbench" | "compute" | "analysis" | "meeting" | "maintenance";
export const PEOPLE = [
  { id: "mira", name: "Mira Chen", role: "Researcher", goal: "Improve calibration and support it with measured evidence.", method: "calibration", initials: "MC" },
  { id: "ivo", name: "Ivo Mensah", role: "Researcher", goal: "Investigate redundant reasoning and challenge weak conclusions.", method: "redundancy", initials: "IM" },
  { id: "jun", name: "Jun Park", role: "Systems engineer", goal: "Keep instruments trustworthy and computing available.", initials: "JP" },
  { id: "ada", name: "Ada Reyes", role: "Data analyst", goal: "Separate promising readings from reproducible evidence.", initials: "AR" },
  { id: "sol", name: "Sol Avery", role: "Lab technician", goal: "Prepare safe experiments and keep the bench calibrated.", initials: "SA" },
  { id: "nia", name: "Nia Okafor", role: "Research director", goal: "Allocate the shared grant and approve an evidenced result.", initials: "NO" },
] as const;
export type PersonId = typeof PEOPLE[number]["id"];
export type Agent = { id: PersonId; location: Location; activity: string; note: string; memories: string[] };
export type Trial = { id: number; round: number; revision: number; level: number; reading: number; health: number; reviewed: boolean; verdict: "pending" | "valid" | "unreliable"; published: number | null };
export type Project = { id: Method; title: string; level: number; funds: number; trials: Trial[] };
export type Exchange = { from: PersonId; to: PersonId; kind: "request" | "handoff" | "review" | "support" | "coordination"; subject: string; trialId?: number };
export type LabEvent = { id: number; round: number; actor: PersonId | "you" | "world"; text: string; kind: "work" | "message" | "finding" | "intervention"; exchanges?: Exchange[] };
export type World = { schema: 1; id: string; seed: number; round: number; focus: Focus; status: "active" | "completed" | "ended"; revision: number; treasury: number; compute: number; outageUntil: number; health: number; benchReady: boolean; agents: Agent[]; projects: Project[]; events: LabEvent[]; board: string[]; nextTrial: number; lastDriver: "rules" | "ai"; result: string };
export type Action = { id: string; label: string; location: Location };
export type Decision = { agentId: PersonId; actionId: string; note: string };
export type Intervention = "equipment-fault" | "dataset-shift" | "compute-outage" | "grant" | "budget-cut";
const methods: Method[] = ["calibration", "redundancy"];
const locations: Location[] = ["office", "workbench", "compute", "analysis", "meeting", "maintenance"];
const bounded = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
const rounded = (n: number) => Math.round(n * 10000) / 10000;
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
function sample(seed: number, round: number, salt: number) { let x = (seed ^ Math.imul(round + 1, 2654435761) ^ Math.imul(salt + 1, 1597334677)) >>> 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; }
export function createInstitute(seed = 31415, id = "local-run"): World {
  return { schema: 1, id, seed: bounded(Math.floor(seed), 1, 2147483647), round: 0, focus: "balanced", status: "active", revision: 0, treasury: 100, compute: 2, outageUntil: 0, health: 92, benchReady: false,
    agents: PEOPLE.map(p => ({ id: p.id, location: p.id === "jun" ? "maintenance" : p.id === "sol" ? "workbench" : p.id === "ada" ? "analysis" : "office", activity: "Reading the research brief", note: p.goal, memories: ["Brief: demonstrate a reliability score of at least 82% on the current test set."] })),
    projects: [{ id: "calibration", title: "Calibrated reasoning", level: 0, funds: 0, trials: [] }, { id: "redundancy", title: "Redundant reasoning", level: 0, funds: 0, trials: [] }], events: [], board: ["Two approaches. One shared grant. All results belong to this fictional test environment."], nextTrial: 1, lastDriver: "rules", result: "" };
}
function event(w: World, actor: LabEvent["actor"], text: string, kind: LabEvent["kind"] = "work", exchanges: Exchange[] = []) { w.events.push({ id: (w.events.at(-1)?.id ?? 0) + 1, round: w.round, actor, text, kind, ...(exchanges.length ? { exchanges } : {}) }); w.events = w.events.slice(-140); }
function remember(w: World, id: PersonId, text: string) { const a = w.agents.find(a => a.id === id)!; a.memories = [...a.memories, text].slice(-6); }
function publish(w: World, text: string) { w.board = [...w.board, text].slice(-6); for (const a of w.agents) remember(w, a.id, text); }
export function evidence(w: World, p: Project) { return p.trials.filter(t => t.reviewed && t.verdict === "valid" && t.revision === w.revision && t.level === p.level); }
export function projectScore(w: World, p: Project) { const trials = evidence(w, p); return trials.length ? rounded(trials.reduce((sum, t) => sum + t.published!, 0) / trials.length) : null; }
export function requiredEvidence(w: World) { return w.focus === "rigour" ? 3 : 2; }
export function availableCompute(w: World) { return w.outageUntil > w.round ? 1 : w.compute; }
export function legalActions(w: World, agentId: PersonId): Action[] {
  if (w.status !== "active" || w.round >= LAB_ROUNDS) return [];
  const person = PEOPLE.find(p => p.id === agentId)!;
  const actions: Action[] = [{ id: "reflect", label: "Review findings and working notes", location: "office" }];
  if ("method" in person) {
    const p = w.projects.find(p => p.id === person.method)!;
    if (p.funds < 7) actions.push({ id: "request-funds", label: `Request funding for ${p.title.toLowerCase()}`, location: "meeting" });
    const pending = p.trials.some(t => !t.reviewed);
    if (p.level < 4 && p.funds >= 4 && !pending) actions.push({ id: "build", label: `Build revision ${p.level + 1} of the prototype`, location: "workbench" });
    if (p.level > 0 && p.funds >= 3 && w.benchReady && w.health >= 60 && !pending) actions.push({ id: "experiment", label: `Run a controlled ${p.title.toLowerCase()} experiment`, location: "compute" });
    if (pending) actions.push({ id: "request-analysis", label: "Ask Ada to review the latest measurement", location: "analysis" });
    if (evidence(w, p).length) actions.push({ id: "share", label: "Share the current evidence with the team", location: "meeting" });
  } else if (agentId === "jun") {
    if (w.health < 92 && w.treasury >= 3) actions.push({ id: "repair", label: "Service and recalibrate the instrument", location: "maintenance" });
    if (w.compute < 3 && w.health >= 80 && w.treasury >= 6 && w.outageUntil <= w.round) actions.push({ id: "optimize", label: "Add a third compute slot", location: "maintenance" });
    actions.push({ id: "inspect", label: "Inspect equipment and report its condition", location: "maintenance" });
  } else if (agentId === "sol") {
    if (!w.benchReady && w.health >= 60 && w.treasury >= 1) actions.push({ id: "prepare", label: "Prepare the shared test bench", location: "workbench" });
    if (w.health < 80 && w.treasury >= 2) actions.push({ id: "calibrate", label: "Recalibrate sensors and request engineering support", location: "workbench" });
    actions.push({ id: "check", label: "Check experimental readiness", location: "workbench" });
  } else if (agentId === "ada") {
    for (const p of w.projects) for (const t of p.trials.filter(t => !t.reviewed).slice(0, 3)) actions.push({ id: `analyze:${t.id}`, label: `Review experiment ${t.id}: ${p.title}`, location: "analysis" });
    actions.push({ id: "audit", label: "Audit evidence and identify missing replications", location: "analysis" });
  } else if (agentId === "nia") {
    for (const p of w.projects) {
      if (w.treasury >= 8 && p.funds < 8) actions.push({ id: `fund:${p.id}`, label: `Allocate 8 lab credits to ${p.title.toLowerCase()}`, location: "meeting" });
      if (w.treasury < 6 && p.funds >= 8) actions.push({ id: `rebalance:${p.id}`, label: `Recover 4 reserve credits from ${p.title.toLowerCase()} for shared operations`, location: "meeting" });
      if (evidence(w, p).length >= requiredEvidence(w) && (projectScore(w, p) ?? 0) >= TARGET) actions.push({ id: `approve:${p.id}`, label: `Approve the demonstrated ${p.title.toLowerCase()} result`, location: "meeting" });
    }
    actions.push({ id: "coordinate", label: "Coordinate priorities and request evidence", location: "meeting" });
  }
  return actions;
}
export function chooseRules(w: World): Decision[] {
  return PEOPLE.map(person => {
    const actions = legalActions(w, person.id), has = (id: string) => actions.some(a => a.id === id);
    let actionId = "reflect", note = "I will review the latest shared findings before spending more resources.";
    if ("method" in person) {
      const p = w.projects.find(p => p.id === person.method)!, score = projectScore(w, p), proof = evidence(w, p);
      if (has("request-analysis")) { actionId = "request-analysis"; note = "A measurement is waiting for review. I need evidence before revising the prototype."; }
      else if (has("request-funds") && p.funds < 4) { actionId = "request-funds"; note = `I have ${p.funds} lab credits left and cannot fund the next useful experiment.`; }
      else if (has("build") && (p.level === 0 || (score !== null && score < TARGET) || (w.focus === "speed" && proof.length === 0 && p.level < 3))) { actionId = "build"; note = score === null ? "I need a testable prototype before this approach can generate evidence." : `Reviewed reliability is ${Math.round(score * 100)}%. I will change the prototype rather than repeat a weak design.`; }
      else if (has("experiment") && proof.length < requiredEvidence(w)) { actionId = "experiment"; note = proof.length ? "One good reading is insufficient. I will independently repeat the measurement." : "The prototype and bench are ready. I will test the current version."; }
      else if (has("share")) { actionId = "share"; note = "The current evidence should be considered in the next funding or approval decision."; }
      else if (has("request-funds")) { actionId = "request-funds"; note = "The next iteration needs resources; I will make the request visible to the director."; }
      else { note = w.health < 60 ? "The instrument is below the operating threshold. I will wait for engineering support." : "The bench is not ready. I will review the protocol while the technician prepares it."; }
    } else if (person.id === "jun") {
      if (has("repair") && w.health < 82) { actionId = "repair"; note = "Instrument condition threatens the quality of our evidence. Maintenance takes priority."; }
      else if (has("optimize") && w.focus !== "rigour") { actionId = "optimize"; note = "The instrument is healthy. Extra computing will reduce contention between projects."; }
      else { actionId = "inspect"; note = "I will report instrument health so the team can judge whether measurements are trustworthy."; }
    } else if (person.id === "sol") {
      if (has("calibrate")) { actionId = "calibrate"; note = "The sensors need calibration before the next experimental session."; }
      else if (has("prepare")) { actionId = "prepare"; note = "Researchers are waiting for a prepared bench. I will make the next experiment possible."; }
      else { actionId = "check"; note = "I will check readiness and notify researchers about equipment constraints."; }
    } else if (person.id === "ada") {
      const pending = actions.find(a => a.id.startsWith("analyze:")); actionId = pending?.id ?? "audit";
      note = pending ? "I will inspect this measurement, its dataset version and the instrument condition before publishing it." : "I will identify missing evidence so the next experiment answers a useful question.";
    } else {
      const approval = actions.find(a => a.id.startsWith("approve:"));
      const possible = w.projects.filter(p => has(`fund:${p.id}`));
      const candidate = [...possible].sort((a, b) => (a.funds - b.funds) || (w.focus === "speed" ? b.level - a.level : (sample(w.seed, w.round, a.id === "calibration" ? 1 : 2) - .5)))[0];
      const recovery = actions.find(a => a.id.startsWith("rebalance:"));
      actionId = approval?.id ?? recovery?.id ?? (candidate ? `fund:${candidate.id}` : "coordinate");
      note = approval ? "The current dataset has enough independent, reviewed measurements above the objective." : recovery ? "Project reserves are tying up the grant while shared operations need funding. I will recover a small reserve." : candidate ? `I will fund ${candidate.title.toLowerCase()} because its available project budget is low.` : "I will keep the team focused on the strongest current evidence and unresolved constraints.";
    }
    return { agentId: person.id, actionId, note };
  });
}
export function validateDecisions(w: World, value: unknown): Decision[] {
  if (!Array.isArray(value) || value.length !== PEOPLE.length) throw Error("A round requires one valid decision for each of the six agents.");
  const seen = new Set<string>();
  return value.map((v: unknown) => {
    const d = v as Partial<Decision>;
    if (!d || !PEOPLE.some(p => p.id === d.agentId) || seen.has(d.agentId!) || typeof d.note !== "string" || !d.note.trim() || d.note.length > 240 || !legalActions(w, d.agentId!).some(a => a.id === d.actionId)) throw Error("An agent selected an unavailable action or supplied an invalid decision note.");
    seen.add(d.agentId!); return { agentId: d.agentId!, actionId: d.actionId!, note: d.note.trim() };
  });
}
export function stepInstitute(previous: World, choices = chooseRules(previous), driver: "rules" | "ai" = "rules"): World {
  if (previous.status !== "active" || previous.round >= LAB_ROUNDS) throw Error("This research session has ended. Start another session to continue.");
  const decisions = validateDecisions(previous, choices), w = copy(previous); w.round++; w.lastDriver = driver;
  let slots = availableCompute(previous), usedBench = false;
  // All agents choose from the same prior snapshot. Rotate resolution order to
  // avoid permanently privileging one researcher when resources are scarce.
  const order = [...PEOPLE.slice(previous.round % 6), ...PEOPLE.slice(0, previous.round % 6)];
  for (const person of order) {
    const d = decisions.find(d => d.agentId === person.id)!, selected = legalActions(previous, person.id).find(a => a.id === d.actionId)!, agent = w.agents.find(a => a.id === person.id)!;
    agent.location = selected.location; agent.activity = selected.label; agent.note = d.note; remember(w, agent.id, d.note);
    const project = "method" in person ? w.projects.find(p => p.id === person.method)! : null;
    let text = "";
    if (d.actionId === "request-funds") { text = `${person.name.split(" ")[0]} requested funding for ${project!.title.toLowerCase()} (${project!.funds} credits available).`; remember(w, "nia", text); }
    else if (d.actionId === "build") { project!.funds -= 4; project!.level++; text = `${person.name.split(" ")[0]} built prototype revision ${project!.level}; used 4 project credits.`; }
    else if (d.actionId === "experiment") {
      if (!slots || !w.benchReady || w.health < 60) { text = `${person.name.split(" ")[0]} could not start: ${!slots ? "all compute slots were taken" : "the test bench was unavailable"}.`; agent.activity = "Waiting for a test slot"; }
      else {
        slots--; project!.funds -= 3; usedBench = true;
        const shift = w.revision * (project!.id === "calibration" ? .075 : .025), base = project!.id === "calibration" ? .60 + project!.level * .06 : .64 + project!.level * .05;
        const bias = w.health < 70 ? .10 : 0, noise = (sample(w.seed, w.round, w.nextTrial) - .5) * (w.focus === "rigour" ? .02 : .04);
        const t: Trial = { id: w.nextTrial++, round: w.round, revision: w.revision, level: project!.level, reading: rounded(bounded(base - shift + noise + bias, .1, .99)), health: w.health, reviewed: false, verdict: "pending", published: null };
        project!.trials.push(t); w.health = Math.max(0, w.health - 7);
        text = `${person.name.split(" ")[0]} ran experiment ${t.id} on ${project!.title.toLowerCase()}: ${Math.round(t.reading * 100)}% raw reliability. Ada must review it.`; remember(w, "ada", text);
      }
    } else if (d.actionId === "request-analysis") { text = `${person.name.split(" ")[0]} asked Ada to review the pending measurement.`; remember(w, "ada", text); }
    else if (d.actionId === "share") { text = `${person.name.split(" ")[0]} shared ${evidence(w, project!).length} current reviewed measurements for ${project!.title.toLowerCase()}.`; remember(w, "nia", text); }
    else if (d.actionId === "repair") { if (w.treasury >= 3) { w.treasury -= 3; w.health = Math.min(100, w.health + 25); text = `Jun serviced the instrument. Health is now ${w.health}%; used 3 shared credits.`; } }
    else if (d.actionId === "optimize") { if (w.treasury >= 6) { w.treasury -= 6; w.compute = 3; text = "Jun provisioned a third compute slot for subsequent rounds; used 6 shared credits."; } }
    else if (d.actionId === "inspect") { text = `Jun reported instrument health at ${w.health}%.`; remember(w, "sol", text); }
    else if (d.actionId === "prepare") { if (w.treasury >= 1 && w.health >= 60) { w.treasury--; w.benchReady = true; text = "Sol prepared the shared test bench; used 1 shared credit."; } }
    else if (d.actionId === "calibrate") { if (w.treasury >= 2) { w.treasury -= 2; w.health = Math.min(100, w.health + 10); text = `Sol calibrated the sensors. Health is now ${w.health}%; used 2 shared credits.`; remember(w, "jun", text); } }
    else if (d.actionId === "check") { text = `Sol checked the bench: ${w.benchReady && w.health >= 60 ? "ready for a test" : "preparation or maintenance required"}.`; }
    else if (d.actionId.startsWith("analyze:")) {
      const trialId = Number(d.actionId.split(":")[1]), p = w.projects.find(p => p.trials.some(t => t.id === trialId))!, t = p.trials.find(t => t.id === trialId)!;
      t.reviewed = true; t.verdict = t.health < 70 || t.revision !== w.revision ? "unreliable" : "valid"; t.published = t.verdict === "valid" ? t.reading : null;
      text = t.verdict === "valid" ? `Ada published experiment ${t.id}: ${Math.round(t.reading * 100)}% for ${p.title.toLowerCase()}, prototype ${t.level}.` : `Ada rejected experiment ${t.id}: ${t.revision !== w.revision ? "it used the previous test set" : "instrument condition made the reading unreliable"}.`;
      publish(w, text); event(w, person.id, text, "finding", actionExchanges(previous, w, person.id, d.actionId, text)); continue;
    } else if (d.actionId === "audit") { text = `Ada requested ${requiredEvidence(w)} independent reviewed readings per current prototype before approval.`; remember(w, "nia", text); }
    else if (d.actionId.startsWith("fund:")) {
      const p = w.projects.find(p => p.id === d.actionId.split(":")[1])!;
      if (w.treasury >= 8) { w.treasury -= 8; p.funds += 8; text = `Nia allocated 8 shared credits to ${p.title.toLowerCase()}.`; remember(w, p.id === "calibration" ? "mira" : "ivo", text); }
    } else if (d.actionId.startsWith("rebalance:")) {
      const p = w.projects.find(p => p.id === d.actionId.split(":")[1])!;
      if (p.funds >= 4) { p.funds -= 4; w.treasury += 4; text = `Nia recovered 4 reserve credits from ${p.title.toLowerCase()} to keep shared operations running.`; }
    } else if (d.actionId.startsWith("approve:")) {
      const p = w.projects.find(p => p.id === d.actionId.split(":")[1])!, score = projectScore(w, p);
      if (score !== null && score >= TARGET && evidence(w, p).length >= requiredEvidence(w)) { w.status = "completed"; w.result = `${p.title} met the objective with ${Math.round(score * 100)}% mean reliability across ${evidence(w, p).length} current reviewed experiments.`; text = `Nia approved the result. ${w.result}`; publish(w, text); }
    } else if (d.actionId === "coordinate") { text = `Nia asked the team to ${w.focus === "rigour" ? "prioritise replication and trustworthy measurements" : w.focus === "speed" ? "iterate prototypes quickly within the grant" : "balance iteration with independent evidence"}.`; }
    else { text = `${person.name.split(" ")[0]} reviewed the shared findings and their working notes.`; }
    event(w, person.id, text || `${person.name.split(" ")[0]} deferred the action because shared resources had changed.`, ["request-funds", "request-analysis", "share", "coordinate"].includes(d.actionId) ? "message" : "work", actionExchanges(previous, w, person.id, d.actionId, text));
  }
  if (usedBench) w.benchReady = false;
  if (w.round === LAB_ROUNDS && w.status === "active") { w.status = "ended"; w.result = "The research window ended without an approved result. Inspect the evidence and resource decisions, or rerun with different priorities."; event(w, "world", w.result, "finding"); }
  return w;
}
export function intervene(previous: World, intervention: Intervention | Focus): World {
  if (previous.status !== "active") throw Error("Start another session to intervene in a new world.");
  const w = copy(previous); let text: string;
  if (FOCUS.includes(intervention as Focus)) { w.focus = intervention as Focus; text = `You changed the research priority to ${intervention}.`; }
  else if (intervention === "equipment-fault") { w.health = 35; w.benchReady = false; text = "You introduced an instrument fault. Health fell to 35%; the bench needs maintenance."; }
  else if (intervention === "dataset-shift") { w.revision++; text = "You changed the test distribution. Earlier results remain in history but cannot support a new approval."; }
  else if (intervention === "compute-outage") { w.outageUntil = w.round + 3; text = "You limited computing to one slot for the next three rounds."; }
  else if (intervention === "grant") { w.treasury = Math.min(200, w.treasury + 20); text = "You added 20 fictional lab credits to the shared grant."; }
  else if (intervention === "budget-cut") { const cut = Math.min(15, w.treasury); w.treasury -= cut; text = `You removed ${cut} unallocated lab credits from the grant.`; }
  else throw Error("Unknown intervention.");
  event(w, "you", text, "intervention"); publish(w, text); return w;
}
export function observations(w: World) {
  return PEOPLE.map(p => ({ id: p.id, role: p.role, goal: p.goal, memories: w.agents.find(a => a.id === p.id)!.memories.slice(-3), legalActions: legalActions(w, p.id) }));
}
// Validate device saves and untrusted API snapshots before using them.
export function readInstitute(value: unknown): World {
  const o = value as World;
  const num = (v: unknown, low: number, high: number) => typeof v === "number" && Number.isFinite(v) && v >= low && v <= high;
  const str = (v: unknown, max: number) => typeof v === "string" && v.length <= max;
  if (!o || o.schema !== 1 || !str(o.id, 80) || !/^[a-zA-Z0-9_-]+$/.test(o.id) || !num(o.seed, 1, 2147483647) || !Number.isInteger(o.seed) || !num(o.round, 0, LAB_ROUNDS) || !Number.isInteger(o.round) || !FOCUS.includes(o.focus) || !["active", "completed", "ended"].includes(o.status) || !num(o.revision, 0, 100) || !Number.isInteger(o.revision) || !num(o.treasury, 0, 200) || !num(o.compute, 1, 3) || !num(o.health, 0, 100) || !num(o.outageUntil, 0, LAB_ROUNDS + 3) || typeof o.benchReady !== "boolean" || !num(o.nextTrial, 1, 100) || !["rules", "ai"].includes(o.lastDriver) || !str(o.result, 600)) throw Error("This research session is invalid or uses an unsupported version.");
  if (!Array.isArray(o.agents) || o.agents.length !== 6 || new Set(o.agents.map(a => a.id)).size !== 6 || !o.agents.every(a => PEOPLE.some(p => p.id === a.id) && locations.includes(a.location) && str(a.activity, 240) && str(a.note, 240) && Array.isArray(a.memories) && a.memories.length <= 6 && a.memories.every(m => str(m, 600)))) throw Error("Invalid agent memories or roles.");
  if (!Array.isArray(o.projects) || o.projects.length !== 2 || new Set(o.projects.map(p => p.id)).size !== 2 || !o.projects.every(p => methods.includes(p.id) && str(p.title, 100) && num(p.level, 0, 4) && Number.isInteger(p.level) && num(p.funds, 0, 200) && Array.isArray(p.trials) && p.trials.length <= 48 && p.trials.every(t => num(t.id, 1, 100) && Number.isInteger(t.id) && num(t.round, 0, LAB_ROUNDS) && num(t.revision, 0, 100) && num(t.level, 1, 4) && num(t.reading, 0, 1) && num(t.health, 0, 100) && typeof t.reviewed === "boolean" && ["pending", "valid", "unreliable"].includes(t.verdict) && (t.published === null || num(t.published, 0, 1))))) throw Error("Invalid experiment history.");
  const trialIds = o.projects.flatMap(p => p.trials.map(t => t.id)); if (new Set(trialIds).size !== trialIds.length || trialIds.some(id => id >= o.nextTrial)) throw Error("Experiment identifiers are inconsistent.");
  if ([o.treasury, o.compute, o.outageUntil, o.nextTrial, ...o.projects.map(p => p.funds)].some(n => !Number.isInteger(n)) || (o.status === "active" && o.round === LAB_ROUNDS)) throw Error("The research clock or resources are inconsistent.");
  if (o.projects.some(p => p.trials.some(t => !Number.isInteger(t.round) || !Number.isInteger(t.level) || !Number.isInteger(t.revision) || (t.verdict === "valid" && (!t.reviewed || t.published === null)) || (t.verdict !== "valid" && t.published !== null)))) throw Error("An experimental verdict is inconsistent.");
  if (!Array.isArray(o.board) || o.board.length > 6 || !o.board.every(b => str(b, 600)) || !Array.isArray(o.events) || o.events.length > 140 || !o.events.every(e => num(e.id, 1, 10000) && num(e.round, 0, LAB_ROUNDS) && (e.actor === "you" || e.actor === "world" || PEOPLE.some(p => p.id === e.actor)) && str(e.text, 600) && ["work", "message", "finding", "intervention"].includes(e.kind))) throw Error("Invalid research log.");
  for (const entry of o.events) {
    if (entry.exchanges === undefined) continue;
    if (!Array.isArray(entry.exchanges) || entry.exchanges.length > 6) throw Error("Invalid team exchange.");
    for (const exchange of entry.exchanges) {
      if (!exchange || exchange.from !== entry.actor || !PEOPLE.some(p => p.id === exchange.from) || !PEOPLE.some(p => p.id === exchange.to) || exchange.from === exchange.to || !["request", "handoff", "review", "support", "coordination"].includes(exchange.kind) || !str(exchange.subject, 240) || !exchange.subject.trim() || (exchange.trialId !== undefined && (!Number.isInteger(exchange.trialId) || !trialIds.includes(exchange.trialId)))) throw Error("Invalid team exchange.");
    }
  }
  return copy(o);
}

// Record recipient and evidence references only after an action resolves. This
// adds replayable communication without changing outcomes or granting an agent
// resources, reviews or repairs that it did not actually perform.
function actionExchanges(previous: World, w: World, from: PersonId, action: string, outcome: string): Exchange[] {
  if (!outcome || /waiting|could not/i.test(w.agents.find(a => a.id === from)!.activity)) return [];
  const make = (to: PersonId, kind: Exchange["kind"], subject: string, trialId?: number): Exchange => ({ from, to, kind, subject, ...(trialId ? { trialId } : {}) });
  const method = from === "mira" ? "calibration" : from === "ivo" ? "redundancy" : null;
  const project = w.projects.find(p => p.id === method);
  if (action === "request-funds" && project) return [make("nia", "request", `Funding for ${project.title.toLowerCase()}`)];
  if (action === "request-analysis" && project) {
    const trial = previous.projects.find(p => p.id === method)!.trials.find(t => !t.reviewed);
    return trial ? [make("ada", "request", `Review requested for experiment ${trial.id}`, trial.id)] : [];
  }
  if (action === "experiment" && project) {
    const trial = project.trials.find(t => t.id >= previous.nextTrial && t.round === w.round);
    return trial ? [make("ada", "handoff", `Experiment ${trial.id} ready for review`, trial.id)] : [];
  }
  if (action === "share" && project) return [make("nia", "handoff", `${project.title}: ${evidence(w, project).length} reviewed measurements`)];
  if (action.startsWith("analyze:")) {
    const trialId = Number(action.split(":")[1]), p = w.projects.find(p => p.trials.some(t => t.id === trialId))!, trial = p.trials.find(t => t.id === trialId)!;
    return [make(p.id === "calibration" ? "mira" : "ivo", "review", `Experiment ${trial.id} ${trial.verdict === "valid" ? "reviewed and published" : "rejected"}`, trial.id)];
  }
  if (action.startsWith("fund:")) return [make(action.endsWith("calibration") ? "mira" : "ivo", "handoff", "8 lab credits allocated to the project")];
  if (action === "calibrate") return [make("jun", "request", `Engineering support requested · ${w.health}% instrument health`)];
  if (action === "repair") return [make("sol", "support", `Instrument serviced · ${w.health}% health`)];
  if (action === "prepare") return [make("mira", "support", "Shared test bench prepared"), make("ivo", "support", "Shared test bench prepared")];
  if (action === "optimize") return [make("nia", "support", "Third compute slot provisioned")];
  if (action === "coordinate") return [make("mira", "coordination", `Research priority: ${w.focus}`), make("ivo", "coordination", `Research priority: ${w.focus}`)];
  return [];
}
