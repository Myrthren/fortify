import type { SimulationTheme } from "./institute-themes";

type PersonPresentation = { role: string; goal: string };

const PEOPLE: Record<SimulationTheme, Record<string, PersonPresentation>> = {
  research: {
    mira: { role: "Researcher", goal: "Improve calibration and support it with measured evidence." },
    ivo: { role: "Researcher", goal: "Investigate redundant reasoning and challenge weak conclusions." },
    jun: { role: "Systems engineer", goal: "Keep instruments trustworthy and computing available." },
    ada: { role: "Data analyst", goal: "Separate promising readings from reproducible evidence." },
    sol: { role: "Lab technician", goal: "Prepare safe experiments and keep the bench calibrated." },
    nia: { role: "Research director", goal: "Allocate the shared grant and approve an evidenced result." },
  },
  operations: {
    mira: { role: "Process strategist", goal: "Improve process design and support it with measured operating signals." },
    ivo: { role: "Operations strategist", goal: "Stress-test resilient procedures and challenge weak assumptions." },
    jun: { role: "Systems engineer", goal: "Keep systems trustworthy and delivery capacity available." },
    ada: { role: "Performance analyst", goal: "Separate promising indicators from repeatable operating results." },
    sol: { role: "Automation specialist", goal: "Prepare safe automations and keep the control pod ready." },
    nia: { role: "Operations director", goal: "Allocate the operating reserve and approve a supported programme." },
  },
  orbital: {
    mira: { role: "Navigation specialist", goal: "Improve navigation logic and support it with verified telemetry." },
    ivo: { role: "Resilience specialist", goal: "Investigate failover reasoning and challenge weak mission assumptions." },
    jun: { role: "Flight systems engineer", goal: "Keep vessel systems trustworthy and flight compute available." },
    ada: { role: "Telemetry analyst", goal: "Separate promising readings from reproducible mission telemetry." },
    sol: { role: "Flight systems specialist", goal: "Prepare safe trials and keep the systems bay calibrated." },
    nia: { role: "Mission commander", goal: "Allocate the mission reserve and clear a verified result." },
  },
};

export const THEME_PRESENTATION: Record<SimulationTheme, {
  recordSingular: string; recordPlural: string; buildLabel: string; revisionLabel: string;
  environmentLabel: string; environmentValue: string; readyLabel: string; preparationLabel: string;
  computeLabel: string; creditsLabel: string; workInProgress: string; completedLabel: string; endedLabel: string;
  peopleSummary: string; instrumentsLabel: string; screenNamespace: string; screenRevisionKey: string;
  screenComputeKey: string; screenHealthKey: string;
}> = {
  research: { recordSingular: "Experiment", recordPlural: "Experiments", buildLabel: "Prototype", revisionLabel: "Dataset", environmentLabel: "Test environment", environmentValue: "Dataset", readyLabel: "Ready", preparationLabel: "Preparation due", computeLabel: "Computing", creditsLabel: "project credits", workInProgress: "Research in progress", completedLabel: "The team demonstrated a result.", endedLabel: "The research window has closed.", peopleSummary: "Six people. Two hypotheses. One shared world.", instrumentsLabel: "INSTRUMENTS", screenNamespace: "institute.research", screenRevisionKey: "dataset_revision", screenComputeKey: "available_compute", screenHealthKey: "instrument_health" },
  operations: { recordSingular: "Run", recordPlural: "Runs", buildLabel: "Workflow", revisionLabel: "Operating cycle", environmentLabel: "Operating environment", environmentValue: "Cycle", readyLabel: "Ready", preparationLabel: "Setup due", computeLabel: "Delivery capacity", creditsLabel: "programme credits", workInProgress: "Operation in progress", completedLabel: "The team validated a programme.", endedLabel: "The operating window has closed.", peopleSummary: "Six people. Two procedures. One shared operation.", instrumentsLabel: "SYSTEMS", screenNamespace: "studio.operations", screenRevisionKey: "operating_cycle", screenComputeKey: "available_capacity", screenHealthKey: "system_health" },
  orbital: { recordSingular: "Trial", recordPlural: "Trials", buildLabel: "Subsystem", revisionLabel: "Flight profile", environmentLabel: "Flight conditions", environmentValue: "Profile", readyLabel: "Cleared", preparationLabel: "Clearance due", computeLabel: "Flight compute", creditsLabel: "mission credits", workInProgress: "Mission in progress", completedLabel: "The crew stabilised the mission system.", endedLabel: "The mission window has closed.", peopleSummary: "Six crew. Two strategies. One shared mission.", instrumentsLabel: "VESSEL SYSTEMS", screenNamespace: "command.orbital", screenRevisionKey: "flight_profile", screenComputeKey: "available_flight_compute", screenHealthKey: "vessel_health" },
};

const RULES: Record<Exclude<SimulationTheme, "research">, [string, string][]> = {
  operations: [
    ["for hypothesis in approaches", "for procedure in programmes"],
    ["an experiment", "a run"], ["an instrument", "a system"],
    ["calibrated reasoning", "optimised execution"], ["redundant reasoning", "resilient execution"],
    ["research director", "operations director"], ["lab technician", "automation specialist"],
    ["experimental session", "automation run"], ["research session", "operating session"],
    ["research window", "operating window"], ["research priority", "operating priority"],
    ["test distribution", "demand conditions"], ["test environment", "operating environment"],
    ["test bench", "control pod"], ["test set", "operating conditions"],
    ["shared grant", "operating reserve"], ["lab credits", "programme credits"],
    ["project credits", "programme credits"], ["compute slots", "delivery slots"],
    ["researchers", "operators"], ["researcher", "operator"], ["experiments", "runs"],
    ["experiment", "run"], ["dataset", "operating cycle"], ["instrument", "system"],
    ["prototype", "workflow"], ["measurements", "checkpoints"], ["measurement", "checkpoint"],
    ["evidence", "operating signals"], ["reliability", "delivery confidence"],
    ["calibration", "optimisation"], ["grant", "reserve"], ["published", "validated"],
    ["publish", "validate"], ["research", "operations"], ["bench", "control pod"],
  ],
  orbital: [
    ["for hypothesis in approaches", "for strategy in subsystems"],
    ["an experiment", "a trial"], ["an instrument", "a vessel system"],
    ["calibrated reasoning", "navigation control"], ["redundant reasoning", "failover control"],
    ["research director", "mission commander"], ["lab technician", "flight systems specialist"],
    ["experimental session", "flight trial"], ["research session", "mission session"],
    ["research window", "mission window"], ["research priority", "mission priority"],
    ["test distribution", "flight conditions"], ["test environment", "mission environment"],
    ["test bench", "systems bay"], ["test set", "flight profile"],
    ["shared grant", "mission reserve"], ["lab credits", "mission credits"],
    ["project credits", "mission credits"], ["compute slots", "flight-compute slots"],
    ["researchers", "crew specialists"], ["researcher", "crew specialist"], ["experiments", "trials"],
    ["experiment", "trial"], ["dataset", "flight profile"], ["instrument", "vessel system"],
    ["prototype", "subsystem"], ["measurements", "telemetry readings"], ["measurement", "telemetry reading"],
    ["evidence", "telemetry"], ["reliability", "mission confidence"],
    ["calibration", "navigation"], ["grant", "reserve"], ["published", "verified"],
    ["publish", "verify"], ["research", "mission"], ["bench", "systems bay"],
  ],
};

function matchCase(source: string, replacement: string) {
  if (source === source.toUpperCase()) return replacement.toUpperCase();
  if (source[0] === source[0]?.toUpperCase()) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
}

export function presentThemeText(theme: SimulationTheme, text: string) {
  if (theme === "research") return text;
  return RULES[theme].reduce((value, [source, replacement]) => {
    const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return value.replace(new RegExp(`\\b${escaped}\\b`, "gi"), match => matchCase(match, replacement));
  }, text);
}

export function themePerson(theme: SimulationTheme, id: string, fallback: PersonPresentation) {
  return PEOPLE[theme][id] ?? fallback;
}
