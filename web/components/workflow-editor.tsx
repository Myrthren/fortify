"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowLeft, Save, Play, Pause, Loader2, Plus, X, Trash2, History, ChevronDown, GripVertical } from "lucide-react";
import Link from "next/link";

// ── Canvas dimensions ────────────────────────────────────────────────────────
const CW = 3200;
const CH = 2000;
const NW = 210; // node width
const NH = 82;  // node height (slightly taller to fit config preview)
const PR = 7;   // port radius

// ── Config field types ───────────────────────────────────────────────────────
type ConfigFieldType = "text" | "textarea" | "select" | "cron";

type ConfigField = {
  key: string;
  label: string;
  placeholder: string;
  type?: ConfigFieldType;
  options?: { value: string; label: string }[];
  hint?: string;
  rows?: number;
  previewInNode?: boolean; // show value on node tile
};

type PortKey = "out" | "yes" | "no" | "a" | "b" | "c" | "d";

type NodeDef = {
  label: string;
  icon: string;
  category: "trigger" | "ai" | "action" | "logic";
  accent: string;
  ports: PortKey[];
  configFields?: ConfigField[];
};

// ── Node registry ─────────────────────────────────────────────────────────────
const DEFS: Record<string, NodeDef> = {
  // ── Triggers ─────────────────────────────────────────────────────────────
  trigger_schedule: {
    label: "Schedule", icon: "⏰", category: "trigger", accent: "#a78bfa", ports: ["out"],
    configFields: [
      { key: "cron", label: "Cron Expression", placeholder: "0 9 * * 1", previewInNode: true,
        hint: "Examples: '0 9 * * 1' = Mon 9am, '0 8 * * *' = daily 8am. Use crontab.guru to build one." },
      { key: "timezone", label: "Timezone", placeholder: "Europe/London" },
    ],
  },
  trigger_webhook: {
    label: "Webhook In", icon: "⚡", category: "trigger", accent: "#a78bfa", ports: ["out"],
    configFields: [
      { key: "method", label: "Accept Method", type: "select", placeholder: "POST",
        options: [{ value: "POST", label: "POST" }, { value: "GET", label: "GET" }], previewInNode: true },
      { key: "secret", label: "Secret Token (optional)", placeholder: "my_webhook_secret",
        hint: "Send this token in the X-Webhook-Secret header to authenticate calls." },
    ],
  },
  trigger_new_member: {
    label: "New Member", icon: "👤", category: "trigger", accent: "#a78bfa", ports: ["out"],
    configFields: [
      { key: "tier", label: "Filter by Tier (optional)", type: "select", placeholder: "Any tier", previewInNode: true,
        options: [{ value: "", label: "Any tier" }, { value: "PRO", label: "Pro" }, { value: "ELITE", label: "Elite" }, { value: "APEX", label: "Apex" }] },
    ],
  },
  trigger_competitor: {
    label: "Competitor Change", icon: "👁", category: "trigger", accent: "#a78bfa", ports: ["out"],
    configFields: [
      { key: "watchName", label: "Watch Name", placeholder: "Leave blank for all watches", previewInNode: true,
        hint: "Name of the Competitor Watch to listen to. Leave empty to fire on any change." },
    ],
  },
  trigger_lead: {
    label: "New Lead Found", icon: "🎯", category: "trigger", accent: "#a78bfa", ports: ["out"],
    configFields: [
      { key: "minScore", label: "Minimum Lead Score", placeholder: "70 (0–100)",
        hint: "Only fire this trigger when a lead scores at or above this threshold." },
    ],
  },

  // ── AI ───────────────────────────────────────────────────────────────────
  ai_generate: {
    label: "AI Generate", icon: "✦", category: "ai", accent: "#38bdf8", ports: ["out"],
    configFields: [
      { key: "prompt", label: "Prompt", type: "textarea", rows: 4, placeholder: "Write a welcome email for {{member.name}} who just joined Fortify...", previewInNode: true,
        hint: "Variables: {{member.name}} {{member.email}} {{member.tier}} {{previous_output}}" },
      { key: "outputVar", label: "Output Variable Name", placeholder: "generated_text",
        hint: "Reference the output in later nodes as {{generated_text}} (or whatever name you choose)." },
      { key: "model", label: "Model", type: "select", placeholder: "Haiku (fast)",
        options: [{ value: "haiku", label: "Haiku — fast & cheap" }, { value: "sonnet", label: "Sonnet — smarter, slower" }] },
      { key: "maxTokens", label: "Max Output Tokens", placeholder: "500" },
    ],
  },
  ai_summarise: {
    label: "AI Summarise", icon: "📝", category: "ai", accent: "#38bdf8", ports: ["out"],
    configFields: [
      { key: "input", label: "Input to Summarise", type: "textarea", rows: 2, placeholder: "{{previous_output}}", previewInNode: true,
        hint: "Use {{previous_output}} to pass the output of the last node." },
      { key: "maxLength", label: "Max Summary Length", placeholder: "150 words" },
      { key: "outputVar", label: "Output Variable Name", placeholder: "summary" },
    ],
  },
  ai_analyse: {
    label: "AI Analyse", icon: "🔎", category: "ai", accent: "#38bdf8", ports: ["out"],
    configFields: [
      { key: "input", label: "Input to Analyse", type: "textarea", rows: 2, placeholder: "{{previous_output}}", previewInNode: true },
      { key: "criteria", label: "Analysis Criteria", type: "textarea", rows: 2, placeholder: "Tone, clarity, engagement potential, key themes",
        hint: "Tell the AI what aspects to examine." },
      { key: "outputVar", label: "Output Variable Name", placeholder: "analysis" },
    ],
  },
  ai_classify: {
    label: "AI Classify", icon: "🏷", category: "ai", accent: "#38bdf8", ports: ["out"],
    configFields: [
      { key: "input", label: "Input to Classify", placeholder: "{{previous_output}}", previewInNode: true },
      { key: "categories", label: "Categories (comma-separated)", placeholder: "positive, negative, neutral",
        hint: "The AI will return exactly one of these categories." },
      { key: "outputVar", label: "Output Variable Name", placeholder: "category" },
    ],
  },

  // ── Actions ──────────────────────────────────────────────────────────────
  action_discord: {
    label: "Discord Post", icon: "💬", category: "action", accent: "#818cf8", ports: ["out"],
    configFields: [
      { key: "channel", label: "Channel ID", placeholder: "1234567890123456789", previewInNode: true,
        hint: "Right-click a channel in Discord → Copy ID. Enable Developer Mode in Discord settings first." },
      { key: "message", label: "Message Content", type: "textarea", rows: 4,
        placeholder: "{{generated_text}}\n\nView: https://fortify-io.com/dashboard",
        hint: "Variables: {{generated_text}} {{member.name}} {{member.email}} {{member.tier}} {{previous_output}}" },
      { key: "embedTitle", label: "Embed Title (optional)", placeholder: "New Member Alert" },
      { key: "embedColor", label: "Embed Color (optional)", placeholder: "#5865F2",
        hint: "Hex color for the left border of the embed." },
      { key: "username", label: "Bot Username Override (optional)", placeholder: "Fortify Bot" },
    ],
  },
  action_email: {
    label: "Send Email", icon: "📧", category: "action", accent: "#34d399", ports: ["out"],
    configFields: [
      { key: "to", label: "To Address", placeholder: "{{member.email}}", previewInNode: true,
        hint: "Use {{member.email}} to send to the user who triggered the workflow." },
      { key: "subject", label: "Subject Line", placeholder: "Welcome to Fortify, {{member.name}}!" },
      { key: "body", label: "Email Body", type: "textarea", rows: 5,
        placeholder: "Hi {{member.name}},\n\n{{generated_text}}\n\nBest,\nThe Fortify Team",
        hint: "Variables: {{member.name}} {{member.email}} {{generated_text}} {{previous_output}}" },
      { key: "fromName", label: "From Name (optional)", placeholder: "Fortify" },
    ],
  },
  action_slack: {
    label: "Slack Post", icon: "💼", category: "action", accent: "#f59e0b", ports: ["out"],
    configFields: [
      { key: "webhookUrl", label: "Slack Webhook URL", placeholder: "https://hooks.slack.com/services/T.../B.../...", previewInNode: true,
        hint: "Create one at api.slack.com → Your Apps → Incoming Webhooks." },
      { key: "message", label: "Message", type: "textarea", rows: 3,
        placeholder: "{{generated_text}}",
        hint: "Variables: {{generated_text}} {{member.name}} {{previous_output}}" },
      { key: "username", label: "Bot Name (optional)", placeholder: "Fortify" },
      { key: "emoji", label: "Icon Emoji (optional)", placeholder: ":rocket:" },
    ],
  },
  action_notion: {
    label: "Notion Create", icon: "📓", category: "action", accent: "#e2e8f0", ports: ["out"],
    configFields: [
      { key: "database", label: "Database ID", placeholder: "abc123def456…", previewInNode: true,
        hint: "Found in the Notion page URL after the workspace name and before the '?' query string." },
      { key: "title", label: "Page Title", placeholder: "{{member.name}} — {{date}}" },
      { key: "content", label: "Page Content", type: "textarea", rows: 4, placeholder: "{{generated_text}}" },
      { key: "properties", label: "Extra Properties (JSON optional)", type: "textarea", rows: 2,
        placeholder: '{"Status": "New", "Tier": "{{member.tier}}"}' },
    ],
  },
  action_twitter: {
    label: "X / Twitter", icon: "𝕏", category: "action", accent: "#e2e8f0", ports: ["out"],
    configFields: [
      { key: "message", label: "Tweet Text (max 280 chars)", type: "textarea", rows: 4,
        placeholder: "{{generated_text}}", previewInNode: true,
        hint: "Keep under 280 characters. Variables: {{generated_text}} {{previous_output}}" },
      { key: "replyTo", label: "Reply to Tweet ID (optional)", placeholder: "1234567890" },
    ],
  },
  action_shopify: {
    label: "Shopify", icon: "🛍", category: "action", accent: "#95bf47", ports: ["out"],
    configFields: [
      { key: "action", label: "Action", type: "select", placeholder: "tag_customer", previewInNode: true,
        options: [
          { value: "tag_customer", label: "Tag customer" },
          { value: "add_note", label: "Add order note" },
          { value: "create_draft", label: "Create draft order" },
          { value: "send_webhook", label: "Send to Shopify Flow" },
        ] },
      { key: "value", label: "Tag Name / Note Text", placeholder: "fortify-member" },
      { key: "customerId", label: "Customer ID or Email (optional)", placeholder: "{{member.email}}" },
    ],
  },
  action_webhook_out: {
    label: "Webhook Out", icon: "📤", category: "action", accent: "#f59e0b", ports: ["out"],
    configFields: [
      { key: "url", label: "Endpoint URL", placeholder: "https://your-api.com/webhook", previewInNode: true },
      { key: "method", label: "Method", type: "select", placeholder: "POST",
        options: [{ value: "POST", label: "POST" }, { value: "GET", label: "GET" }, { value: "PUT", label: "PUT" }, { value: "PATCH", label: "PATCH" }] },
      { key: "headers", label: "Headers (JSON)", type: "textarea", rows: 2,
        placeholder: '{"Authorization": "Bearer token123"}' },
      { key: "body", label: "Body Template (JSON)", type: "textarea", rows: 3,
        placeholder: '{"event": "new_member", "name": "{{member.name}}", "data": "{{generated_text}}"}',
        hint: "Variables in string values are interpolated at run time." },
    ],
  },

  // ── Logic ────────────────────────────────────────────────────────────────
  logic_condition: {
    label: "Condition", icon: "◇", category: "logic", accent: "#fb923c", ports: ["yes", "no"],
    configFields: [
      { key: "leftSide", label: "Left Side", placeholder: "{{member.tier}}", previewInNode: true,
        hint: "Variables: {{member.tier}} {{member.credits}} {{previous_output}} {{generated_text}}" },
      { key: "operator", label: "Operator", type: "select", placeholder: "==",
        options: [
          { value: "==",          label: "== equals" },
          { value: "!=",          label: "!= not equals" },
          { value: ">",           label: "> greater than" },
          { value: "<",           label: "< less than" },
          { value: ">=",          label: ">= greater or equal" },
          { value: "<=",          label: "<= less or equal" },
          { value: "contains",    label: "contains" },
          { value: "not_contains", label: "not contains" },
        ] },
      { key: "rightSide", label: "Right Side", placeholder: "ELITE" },
    ],
  },
  logic_delay: {
    label: "Delay", icon: "⏳", category: "logic", accent: "#6b7280", ports: ["out"],
    configFields: [
      { key: "duration", label: "Duration", placeholder: "5", previewInNode: true },
      { key: "unit", label: "Unit", type: "select", placeholder: "minutes",
        options: [{ value: "minutes", label: "Minutes" }, { value: "hours", label: "Hours" }, { value: "days", label: "Days" }] },
    ],
  },
  logic_filter: {
    label: "Filter", icon: "⧩", category: "logic", accent: "#6b7280", ports: ["out"],
    configFields: [
      { key: "expression", label: "Filter Expression", type: "textarea", rows: 2, previewInNode: true,
        placeholder: "{{member.credits}} > 100 AND {{member.tier}} != 'FREE'",
        hint: "Supports AND, OR, comparison operators. Workflow continues only if this evaluates true." },
    ],
  },
  logic_switch: {
    label: "Switch", icon: "🔀", category: "logic", accent: "#fb923c", ports: ["a", "b", "c", "d"],
    configFields: [
      { key: "variable", label: "Variable to switch on", placeholder: "{{member.tier}}", previewInNode: true,
        hint: "The value that will be compared against each branch." },
      { key: "caseA", label: "Branch A — matches value", placeholder: "APEX",
        hint: "Output port A fires when variable equals this." },
      { key: "caseB", label: "Branch B — matches value", placeholder: "ELITE" },
      { key: "caseC", label: "Branch C — matches value", placeholder: "PRO" },
      { key: "caseD", label: "Branch D — default (fallback)", placeholder: "FREE (or leave blank for always)" },
    ],
  },
  logic_transform: {
    label: "Transform", icon: "⚙", category: "logic", accent: "#a3e635", ports: ["out"],
    configFields: [
      { key: "input", label: "Input value or variable", placeholder: "{{previous_output}}", previewInNode: true },
      { key: "template", label: "Output template", type: "textarea", rows: 3,
        placeholder: "Name: {{member.name}}\nTier: {{member.tier}}\nData: {{previous_output}}",
        hint: "Build any string using template variables. The result becomes {{transformed_output}} in later nodes." },
      { key: "outputVar", label: "Output variable name", placeholder: "transformed_output" },
    ],
  },
  action_http_request: {
    label: "HTTP Request", icon: "🌐", category: "action", accent: "#38bdf8", ports: ["out"],
    configFields: [
      { key: "url", label: "URL", placeholder: "https://api.example.com/data", previewInNode: true },
      { key: "method", label: "Method", type: "select", placeholder: "GET",
        options: [{ value: "GET", label: "GET" }, { value: "POST", label: "POST" }, { value: "PUT", label: "PUT" }, { value: "PATCH", label: "PATCH" }, { value: "DELETE", label: "DELETE" }] },
      { key: "headers", label: "Headers (JSON)", type: "textarea", rows: 2,
        placeholder: '{"Authorization": "Bearer {{secret}}", "Content-Type": "application/json"}' },
      { key: "body", label: "Request Body (JSON)", type: "textarea", rows: 3,
        placeholder: '{"query": "{{member.name}}", "source": "fortify"}',
        hint: "Template variables are replaced at run time. Response body becomes {{http_response}} for later nodes." },
      { key: "outputVar", label: "Output variable name", placeholder: "http_response" },
    ],
  },
  logic_loop: {
    label: "Loop / Iterator", icon: "🔁", category: "logic", accent: "#f472b6", ports: ["out"],
    configFields: [
      { key: "items", label: "Items to iterate (JSON array or variable)", type: "textarea", rows: 2,
        placeholder: "{{leads_list}} or [\"item1\",\"item2\"]", previewInNode: true,
        hint: "Each iteration runs downstream nodes once with {{loop_item}} set to the current item." },
      { key: "maxIterations", label: "Max iterations (safety limit)", placeholder: "50",
        hint: "Hard cap to prevent runaway loops. Maximum 500." },
      { key: "outputVar", label: "Current item variable name", placeholder: "loop_item" },
    ],
  },
  logic_retry: {
    label: "Error / Retry", icon: "🔄", category: "logic", accent: "#f87171", ports: ["out"],
    configFields: [
      { key: "maxRetries", label: "Max retries", placeholder: "3", previewInNode: true,
        hint: "How many times to retry a failed downstream node before giving up." },
      { key: "delaySeconds", label: "Delay between retries (seconds)", placeholder: "5" },
      { key: "errorOutputVar", label: "Error message variable name", placeholder: "error_message",
        hint: "The error reason is stored here for use in later error-handling steps." },
    ],
  },
};

const CATEGORY_ORDER = ["trigger", "ai", "action", "logic"] as const;
const CATEGORY_LABELS: Record<string, string> = { trigger: "Triggers", ai: "AI", action: "Actions", logic: "Logic" };

const PORT_COLORS: Record<PortKey, string> = {
  out: "rgba(255,255,255,0.5)",
  yes: "#34d399",
  no:  "#f87171",
  a:   "#a78bfa",
  b:   "#38bdf8",
  c:   "#f59e0b",
  d:   "#6b7280",
};

// ── Types ────────────────────────────────────────────────────────────────────
type WFNode = { id: string; type: string; label: string; x: number; y: number; config: Record<string, string> };
type Conn   = { id: string; fromId: string; fromPort: PortKey; toId: string };

type WorkflowData = {
  id: string; name: string; description: string | null; active: boolean;
  nodes: any[]; connections: any[]; runs: any[];
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 10); }

function outPortPos(node: WFNode, port: PortKey, ports: PortKey[]) {
  const i = ports.indexOf(port);
  const n = ports.length;
  const gap = NW / (n + 1);
  return { x: node.x + gap * (i + 1), y: node.y + NH };
}

function inPortPos(node: WFNode) {
  return { x: node.x + NW / 2, y: node.y };
}

function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cy = Math.max(Math.abs(y2 - y1) * 0.55, 70);
  return `M${x1},${y1} C${x1},${y1 + cy} ${x2},${y2 - cy} ${x2},${y2}`;
}

// Preview text shown inside the node tile
function nodePreview(node: WFNode, def: NodeDef): string {
  const previewField = def.configFields?.find((f) => f.previewInNode);
  if (!previewField) return "";
  const val = node.config[previewField.key] ?? "";
  if (!val) return "";
  // For selects, show the option label instead of raw value
  if (previewField.options) {
    const opt = previewField.options.find((o) => o.value === val);
    if (opt) return opt.label.slice(0, 26);
  }
  return val.replace(/\n/g, " ").slice(0, 26) + (val.length > 26 ? "…" : "");
}

// ── Default example nodes ────────────────────────────────────────────────────
const DEFAULT_NODES: WFNode[] = [
  { id: "n1", type: "trigger_new_member", label: "New Member",   x: 460, y: 160, config: {} },
  { id: "n2", type: "ai_generate",        label: "AI Generate",  x: 460, y: 340, config: { prompt: "Write a welcome message for {{member.name}}", outputVar: "welcome_msg", model: "haiku", maxTokens: "300" } },
  { id: "n3", type: "action_discord",     label: "Discord Post", x: 460, y: 540, config: { channel: "", message: "{{welcome_msg}}" } },
];
const DEFAULT_CONNS: Conn[] = [
  { id: "c1", fromId: "n1", fromPort: "out", toId: "n2" },
  { id: "c2", fromId: "n2", fromPort: "out", toId: "n3" },
];

// ── Main component ─────────────────────────────────────────────────────────────
export function WorkflowEditor({ workflow: init }: { workflow: WorkflowData }) {
  const [wfName,   setWfName]   = useState(init.name);
  const [active,   setActive]   = useState(init.active);
  const [nodes,    setNodes]    = useState<WFNode[]>(() => {
    const saved = init.nodes as WFNode[];
    return saved?.length ? saved : DEFAULT_NODES;
  });
  const [conns,    setConns]    = useState<Conn[]>(() => {
    const saved = init.connections as Conn[];
    return saved?.length ? saved : DEFAULT_CONNS;
  });
  const [selId,    setSelId]    = useState<string | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [toggling, setToggling] = useState(false);
  const [running,  setRunning]  = useState(false);
  const [lastRunStatus, setLastRunStatus] = useState<"ok" | "error" | null>(null);
  const [dirty,    setDirty]    = useState(false);
  const [showRuns, setShowRuns] = useState(false);
  const [runs,     setRuns]     = useState<any[]>(init.runs);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [tempConn, setTempConn] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [hovInputId, setHovInputId] = useState<string | null>(null);

  // Derived: cron from the first trigger_schedule node
  const scheduleNode = nodes.find(n => n.type === "trigger_schedule");
  const scheduleCron = scheduleNode?.config?.cron ?? "";
  const scheduleLabel = scheduleCron || "Not scheduled";

  // Sidebar width (resizable)
  const [sidebarW, setSidebarW] = useState(220);
  const sidebarDrag = useRef<{ active: boolean; startX: number; startW: number }>({ active: false, startX: 0, startW: 220 });

  // Drag state in refs (avoids re-render on every mouse move)
  const drag = useRef<{
    kind: null | "node" | "connect";
    nodeId?: string; startCX?: number; startCY?: number; nodeX?: number; nodeY?: number;
    fromId?: string; fromPort?: PortKey;
  }>({ kind: null });
  const nodesRef  = useRef(nodes);
  const canvasRef = useRef<HTMLDivElement>(null);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  // Canvas-relative coordinates
  const xy = useCallback((e: PointerEvent | MouseEvent) => {
    const el = canvasRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left + el.scrollLeft, y: e.clientY - r.top + el.scrollTop };
  }, []);

  // Global pointer listeners
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      // Sidebar resize
      if (sidebarDrag.current.active) {
        const delta = e.clientX - sidebarDrag.current.startX;
        setSidebarW(Math.max(160, Math.min(420, sidebarDrag.current.startW + delta)));
        return;
      }

      const d = drag.current;
      if (!d.kind) return;
      const c = xy(e); if (!c) return;

      if (d.kind === "node") {
        setNodes(prev => prev.map(n => n.id === d.nodeId
          ? { ...n, x: Math.max(0, d.nodeX! + (c.x - d.startCX!)), y: Math.max(0, d.nodeY! + (c.y - d.startCY!)) }
          : n));
      } else if (d.kind === "connect") {
        const from = nodesRef.current.find(n => n.id === d.fromId);
        if (!from) return;
        const pp = outPortPos(from, d.fromPort!, DEFS[from.type]?.ports ?? ["out"]);
        setTempConn({ x1: pp.x, y1: pp.y, x2: c.x, y2: c.y });
        let hov: string | null = null;
        for (const node of nodesRef.current) {
          if (node.id === d.fromId) continue;
          const ip = inPortPos(node);
          if (Math.hypot(c.x - ip.x, c.y - ip.y) <= 20) { hov = node.id; break; }
        }
        setHovInputId(hov);
      }
    };

    const onUp = (e: PointerEvent) => {
      if (sidebarDrag.current.active) {
        sidebarDrag.current.active = false;
        return;
      }
      const d = drag.current;
      if (d.kind === "connect") {
        const c = xy(e);
        if (c) {
          for (const node of nodesRef.current) {
            if (node.id === d.fromId) continue;
            const ip = inPortPos(node);
            if (Math.hypot(c.x - ip.x, c.y - ip.y) <= 20) {
              setConns(prev => {
                if (prev.some(cn => cn.fromId === d.fromId && cn.fromPort === d.fromPort)) return prev;
                return [...prev, { id: uid(), fromId: d.fromId!, fromPort: d.fromPort!, toId: node.id }];
              });
              setDirty(true);
              break;
            }
          }
        }
      }
      drag.current = { kind: null };
      setTempConn(null);
      setHovInputId(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup",   onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup",   onUp);
    };
  }, [xy]);

  function startNodeDrag(e: React.PointerEvent, nodeId: string) {
    e.preventDefault(); e.stopPropagation();
    const c = xy(e.nativeEvent); if (!c) return;
    const node = nodesRef.current.find(n => n.id === nodeId)!;
    drag.current = { kind: "node", nodeId, startCX: c.x, startCY: c.y, nodeX: node.x, nodeY: node.y };
    setSelId(nodeId);
  }

  function startConnect(e: React.PointerEvent, fromId: string, fromPort: PortKey) {
    e.preventDefault(); e.stopPropagation();
    drag.current = { kind: "connect", fromId, fromPort };
  }

  function addNode(type: string) {
    const el = canvasRef.current;
    const cx = (el?.scrollLeft ?? 0) + (el?.clientWidth ?? 800) / 2 - NW / 2 + (Math.random() - 0.5) * 80;
    const cy = (el?.scrollTop ?? 0)  + (el?.clientHeight ?? 600) / 2 - NH / 2 + (Math.random() - 0.5) * 80;
    const n: WFNode = { id: uid(), type, label: DEFS[type]?.label ?? type, x: Math.max(0, cx), y: Math.max(0, cy), config: {} };
    setNodes(p => [...p, n]);
    setSelId(n.id); setDirty(true);
  }

  function deleteNode(id: string) {
    setNodes(p => p.filter(n => n.id !== id));
    setConns(p => p.filter(c => c.fromId !== id && c.toId !== id));
    if (selId === id) setSelId(null);
    setDirty(true);
  }

  function deleteConn(id: string) {
    setConns(p => p.filter(c => c.id !== id));
    setDirty(true);
  }

  function updateConfig(nodeId: string, key: string, val: string) {
    setNodes(p => p.map(n => n.id === nodeId ? { ...n, config: { ...n.config, [key]: val } } : n));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/workflows/${init.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: wfName, nodes, connections: conns }),
      });
      setDirty(false);
    } finally { setSaving(false); }
  }

  async function toggleActive() {
    setToggling(true);
    try {
      const r = await fetch(`/api/workflows/${init.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      if (r.ok) setActive(a => !a);
    } finally { setToggling(false); }
  }

  async function fetchRuns() {
    const r = await fetch(`/api/workflows/${init.id}`);
    if (r.ok) {
      const data = await r.json();
      setRuns(data.workflow?.runs ?? []);
    }
  }

  async function runNow() {
    setRunning(true);
    setLastRunStatus(null);
    try {
      const r = await fetch(`/api/workflows/${init.id}/run`, { method: "POST" });
      const data = await r.json();
      if (!r.ok) {
        setLastRunStatus("error");
        // Show error inline in runs panel instead of alert
        setShowRuns(true);
        await fetchRuns();
      } else {
        setLastRunStatus(data.status === "completed" ? "ok" : "error");
        setShowRuns(true);
        setExpandedRunId(data.runId ?? null);
        await fetchRuns();
      }
    } catch {
      setLastRunStatus("error");
    } finally {
      setRunning(false);
    }
  }

  const selNode = nodes.find(n => n.id === selId);
  const selDef  = selNode ? DEFS[selNode.type] : null;

  return (
    <>
      <style>{`
        @keyframes cubeGlow {
          0%,100% {
            box-shadow: 0 2px 12px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.10);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 2px 16px rgba(0,0,0,0.7), 0 0 0 1.5px rgba(255,255,255,0.50), 0 0 28px rgba(255,255,255,0.09);
            transform: scale(1.035);
          }
        }
        .wf-node { transition: box-shadow 0.15s, transform 0.15s; }
        .wf-node:hover { animation: cubeGlow 1.6s ease-in-out infinite !important; }
        .wf-node.selected {
          box-shadow: 0 2px 16px rgba(0,0,0,0.8), 0 0 0 1.5px rgba(255,255,255,0.40), 0 0 24px rgba(255,255,255,0.07) !important;
        }
        @keyframes portPulse {
          0%,100% { opacity:0.6; transform:scale(1); }
          50%      { opacity:1;   transform:scale(1.35); }
        }
        .wf-port { cursor:crosshair; transition: opacity 0.12s, transform 0.12s; }
        .wf-port:hover { animation: portPulse 0.9s ease-in-out infinite; }
        .wf-port-in { cursor:default; }
        .wf-port-in.hover-target { filter: drop-shadow(0 0 6px rgba(255,255,255,0.8)); }
        .wf-conn { cursor:pointer; transition:stroke 0.15s; }
        .wf-conn:hover { stroke: rgba(255,255,255,0.55) !important; }
        .wf-resize-handle { cursor: col-resize; transition: background 0.15s; }
        .wf-resize-handle:hover { background: rgba(255,255,255,0.08) !important; }
        .wf-config-hint { font-size: 10px; color: rgba(255,255,255,0.3); line-height: 1.4; margin-top: 3px; }
      `}</style>

      <div className="flex h-[calc(100vh-56px)] flex-col select-none">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 border-b border-bg-border bg-bg-panel px-4 py-2.5">
          <Link href="/dashboard/workflows" className="text-text-muted hover:text-text transition p-1">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <input
            className="flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-text-dim max-w-xs"
            value={wfName}
            onChange={e => { setWfName(e.target.value); setDirty(true); }}
            placeholder="Workflow name"
          />
          <div className="ml-auto flex items-center gap-2">
            {dirty && <span className="text-[10px] text-text-dim">Unsaved changes</span>}
            {/* Schedule picker */}
            <div className="relative">
              <button
                onClick={() => setShowSchedule(s => !s)}
                className="btn-ghost text-xs gap-1.5"
                title="Edit run schedule"
              >
                <span>⏰</span>
                <span className="max-w-[120px] truncate hidden sm:inline">{scheduleLabel}</span>
              </button>
              {showSchedule && (
                <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-lg border border-bg-border bg-bg-panel p-3 shadow-xl">
                  <p className="text-xs font-semibold mb-2">Run Schedule</p>
                  <p className="text-[10px] text-text-dim mb-2">
                    Set a cron expression on your Schedule trigger node.
                    {!scheduleNode && " Add a 'Schedule' trigger node to the canvas first."}
                  </p>
                  {scheduleNode ? (
                    <>
                      <input
                        className="input text-xs mb-1.5"
                        placeholder="0 9 * * 1 (Mon 9am)"
                        value={scheduleNode.config.cron ?? ""}
                        onChange={e => {
                          updateConfig(scheduleNode.id, "cron", e.target.value);
                        }}
                      />
                      <input
                        className="input text-xs mb-2"
                        placeholder="Timezone: Europe/London"
                        value={scheduleNode.config.timezone ?? ""}
                        onChange={e => updateConfig(scheduleNode.id, "timezone", e.target.value)}
                      />
                      <div className="grid grid-cols-2 gap-1 text-[10px] text-text-dim">
                        {[
                          ["Every day 8am",    "0 8 * * *"],
                          ["Every Mon 9am",    "0 9 * * 1"],
                          ["Every hour",       "0 * * * *"],
                          ["Every 30 min",     "*/30 * * * *"],
                        ].map(([lbl, cron]) => (
                          <button
                            key={cron}
                            className="rounded px-2 py-1 bg-white/[0.04] hover:bg-white/[0.08] transition text-left"
                            onClick={() => updateConfig(scheduleNode.id, "cron", cron)}
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <button
                      className="btn-ghost text-xs w-full"
                      onClick={() => { addNode("trigger_schedule"); setShowSchedule(false); }}
                    >
                      <Plus className="h-3 w-3" /> Add Schedule trigger
                    </button>
                  )}
                </div>
              )}
            </div>
            <button onClick={() => setShowRuns(r => !r)} className="btn-ghost text-xs gap-1.5">
              <History className="h-3.5 w-3.5" />Runs
            </button>
            <button
              onClick={runNow}
              disabled={running || saving}
              className="btn-ghost text-xs gap-1.5 disabled:opacity-40"
              title="Run workflow now (manual trigger)"
              style={lastRunStatus === "ok" ? { color: "#34d399" } : lastRunStatus === "error" ? { color: "#f87171" } : {}}
            >
              {running
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Play className="h-3.5 w-3.5" />}
              {running ? "Running…" : "Run Now"}
            </button>
            <button onClick={toggleActive} disabled={toggling} className="btn-secondary text-xs">
              {toggling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : active ? <><Pause className="h-3 w-3" />Pause</> : <><Play className="h-3 w-3" />Activate</>}
            </button>
            <button onClick={save} disabled={!dirty || saving} className="btn-primary text-xs disabled:opacity-40">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Save className="h-3 w-3" />Save</>}
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Left sidebar (node palette, resizable) ── */}
          <div
            className="relative shrink-0 overflow-y-auto border-r border-bg-border bg-bg-panel py-3"
            style={{ width: sidebarW }}
          >
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-text-dim">Add node</p>
            {CATEGORY_ORDER.map(cat => {
              const items = Object.entries(DEFS).filter(([, d]) => d.category === cat);
              return (
                <div key={cat} className="mb-3">
                  <p className="px-3 pb-1 text-[10px] font-medium uppercase tracking-wider text-text-dim">
                    {CATEGORY_LABELS[cat]}
                  </p>
                  {items.map(([type, def]) => (
                    <button
                      key={type}
                      onClick={() => addNode(type)}
                      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-xs text-text-muted transition hover:bg-white/[0.04] hover:text-text"
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px]"
                        style={{ background: "linear-gradient(145deg,#111,#1a1a1a)", border: `1px solid ${def.accent}33` }}
                      >
                        {def.icon}
                      </span>
                      <span className="truncate">{def.label}</span>
                    </button>
                  ))}
                </div>
              );
            })}

            {/* Drag handle */}
            <div
              className="wf-resize-handle absolute right-0 top-0 bottom-0 flex items-center justify-center"
              style={{ width: 6, background: "transparent", zIndex: 10 }}
              onPointerDown={e => {
                e.preventDefault();
                sidebarDrag.current = { active: true, startX: e.clientX, startW: sidebarW };
              }}
            >
              <GripVertical className="h-3 w-3 text-text-dim opacity-40" />
            </div>
          </div>

          {/* ── Canvas ── */}
          <div
            ref={canvasRef}
            className="relative flex-1 overflow-auto"
            style={{
              background: "#020202",
              backgroundImage: [
                "radial-gradient(circle, rgba(255,255,255,0.085) 1px, transparent 1px)",
                "radial-gradient(circle, rgba(255,255,255,0.045) 1.5px, transparent 1.5px)",
                "radial-gradient(circle, rgba(255,255,255,0.025) 2px, transparent 2px)",
              ].join(","),
              backgroundSize: "20px 20px, 40px 40px, 80px 80px",
              backgroundPosition: "0 0, 10px 10px, 0 0",
            }}
            onClick={e => {
              if ((e.target as HTMLElement).closest(".wf-node")) return;
              setSelId(null);
            }}
          >
            <div style={{ width: CW, height: CH, position: "relative" }}>

              {/* SVG connections layer */}
              <svg style={{ position: "absolute", inset: 0, width: CW, height: CH, pointerEvents: "none", overflow: "visible" }}>
                <defs>
                  <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L0,6 L8,3 z" fill="rgba(255,255,255,0.35)" />
                  </marker>
                  <marker id="arrow-yes" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L0,6 L8,3 z" fill="#34d399" />
                  </marker>
                  <marker id="arrow-no" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L0,6 L8,3 z" fill="#f87171" />
                  </marker>
                </defs>

                {conns.map(conn => {
                  const fromNode = nodes.find(n => n.id === conn.fromId);
                  const toNode   = nodes.find(n => n.id === conn.toId);
                  if (!fromNode || !toNode) return null;
                  const fp = outPortPos(fromNode, conn.fromPort, DEFS[fromNode.type]?.ports ?? ["out"]);
                  const tp = inPortPos(toNode);
                  const baseColor = PORT_COLORS[conn.fromPort] ?? "rgba(255,255,255,0.5)";
                  const strokeColor = baseColor.startsWith("rgba") ? baseColor : `${baseColor}66`;
                  const arrowRef =
                    conn.fromPort === "yes" ? "url(#arrow-yes)" :
                    conn.fromPort === "no"  ? "url(#arrow-no)"  :
                    "url(#arrow)";
                  return (
                    <g key={conn.id} style={{ pointerEvents: "stroke" }}>
                      <path d={bezier(fp.x, fp.y, tp.x, tp.y)} fill="none" stroke="transparent" strokeWidth={14}
                        className="wf-conn" onClick={() => deleteConn(conn.id)} style={{ cursor: "pointer", pointerEvents: "stroke" }} />
                      <path d={bezier(fp.x, fp.y, tp.x, tp.y)} fill="none" stroke={strokeColor} strokeWidth={1.5}
                        strokeDasharray="6 4" markerEnd={arrowRef} className="wf-conn"
                        onClick={() => deleteConn(conn.id)} style={{ pointerEvents: "none" }} />
                    </g>
                  );
                })}

                {tempConn && (
                  <path d={bezier(tempConn.x1, tempConn.y1, tempConn.x2, tempConn.y2)}
                    fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} strokeDasharray="5 4" />
                )}
              </svg>

              {/* Nodes */}
              {nodes.map(node => {
                const def = DEFS[node.type] ?? { label: node.type, icon: "⚙", category: "action", accent: "#555", ports: ["out"] as PortKey[], configFields: [] };
                const isSelected = selId === node.id;
                const preview = nodePreview(node, def);

                return (
                  <div
                    key={node.id}
                    className={`wf-node absolute${isSelected ? " selected" : ""}`}
                    style={{
                      left: node.x, top: node.y,
                      width: NW, height: NH,
                      background: "linear-gradient(145deg, #0c0c0c 0%, #181818 50%, #111 100%)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 14,
                      cursor: "grab",
                      userSelect: "none",
                      zIndex: isSelected ? 10 : 1,
                    }}
                    onPointerDown={e => startNodeDrag(e, node.id)}
                  >
                    {/* Accent top bar */}
                    <div style={{
                      position: "absolute", top: 0, left: 12, right: 12, height: 2,
                      background: `linear-gradient(90deg, transparent, ${def.accent}99, transparent)`,
                      borderRadius: "0 0 4px 4px",
                    }} />

                    {/* Node body */}
                    <div className="flex h-full items-center gap-2.5 px-3 pt-1">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base"
                        style={{ background: "linear-gradient(145deg,#111,#1c1c1c)", border: `1px solid ${def.accent}40` }}
                      >
                        {def.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-text leading-tight truncate">{node.label}</p>
                        <p className="text-[10px] text-text-dim leading-tight capitalize">{def.category}</p>
                        {preview && (
                          <p className="text-[9px] leading-tight mt-0.5 truncate" style={{ color: `${def.accent}bb` }}>
                            {preview}
                          </p>
                        )}
                      </div>
                      <button
                        onPointerDown={e => { e.stopPropagation(); }}
                        onClick={e => { e.stopPropagation(); deleteNode(node.id); }}
                        className="shrink-0 text-text-dim hover:text-red-400 transition"
                        style={{ opacity: isSelected ? 1 : 0.3 }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Input port (top center) */}
                    <div
                      className={`wf-port-in absolute${hovInputId === node.id ? " hover-target" : ""}`}
                      style={{
                        width: PR * 2, height: PR * 2, borderRadius: "50%",
                        background: "#1a1a1a", border: "1.5px solid rgba(255,255,255,0.35)",
                        left: NW / 2 - PR, top: -PR,
                        pointerEvents: "none",
                      }}
                    />

                    {/* Output port(s) (bottom) */}
                    {def.ports.map(port => {
                      const pp = outPortPos(node, port, def.ports);
                      const portColor = PORT_COLORS[port] ?? "rgba(255,255,255,0.5)";
                      return (
                        <div key={port} style={{ position: "absolute", pointerEvents: "all" }}>
                          <div
                            className="wf-port"
                            style={{
                              width: PR * 2, height: PR * 2, borderRadius: "50%",
                              background: "#111",
                              border: `1.5px solid ${portColor}`,
                              boxShadow: `0 0 4px ${portColor}55`,
                              position: "absolute",
                              left: pp.x - node.x - PR, top: NH - PR,
                            }}
                            onPointerDown={e => startConnect(e, node.id, port)}
                          />
                          {def.ports.length > 1 && (
                            <span style={{
                              position: "absolute",
                              left: pp.x - node.x - 10, top: NH + 10,
                              fontSize: 9, color: portColor, fontWeight: 600,
                              pointerEvents: "none",
                            }}>
                              {port}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Right config panel ── */}
          {selNode && selDef && (
            <div className="w-72 shrink-0 overflow-y-auto border-l border-bg-border bg-bg-panel">
              {/* Panel header */}
              <div className="sticky top-0 z-10 border-b border-bg-border bg-bg-panel px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-sm"
                    style={{ background: "linear-gradient(145deg,#111,#1c1c1c)", border: `1px solid ${selDef.accent}55` }}
                  >
                    {selDef.icon}
                  </span>
                  <div>
                    <p className="text-sm font-semibold leading-none">{selNode.label}</p>
                    <p className="text-[10px] text-text-dim capitalize mt-0.5">{selDef.category}</p>
                  </div>
                </div>
                <button onClick={() => setSelId(null)} className="text-text-muted hover:text-text">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* Node label */}
                <div>
                  <label className="text-xs text-text-muted mb-1 block font-medium">Node label</label>
                  <input
                    className="input text-xs"
                    value={selNode.label}
                    onChange={e => {
                      setNodes(p => p.map(n => n.id === selNode.id ? { ...n, label: e.target.value } : n));
                      setDirty(true);
                    }}
                  />
                </div>

                {/* Divider */}
                {selDef.configFields && selDef.configFields.length > 0 && (
                  <div className="border-t border-bg-border pt-1">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-text-dim mb-3">Configuration</p>
                    {selDef.configFields.map(f => (
                      <div key={f.key} className="mb-3">
                        <label className="text-xs text-text-muted mb-1 block font-medium">{f.label}</label>

                        {f.type === "textarea" ? (
                          <textarea
                            className="input text-xs resize-y min-h-[60px]"
                            rows={f.rows ?? 3}
                            placeholder={f.placeholder}
                            value={selNode.config[f.key] ?? ""}
                            onChange={e => updateConfig(selNode.id, f.key, e.target.value)}
                          />
                        ) : f.type === "select" ? (
                          <select
                            className="input text-xs"
                            value={selNode.config[f.key] ?? ""}
                            onChange={e => updateConfig(selNode.id, f.key, e.target.value)}
                          >
                            <option value="">{f.placeholder}</option>
                            {f.options?.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            className="input text-xs"
                            placeholder={f.placeholder}
                            value={selNode.config[f.key] ?? ""}
                            onChange={e => updateConfig(selNode.id, f.key, e.target.value)}
                          />
                        )}

                        {f.hint && <p className="wf-config-hint">{f.hint}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Webhook URL (for webhook trigger nodes) */}
                {selNode.type === "trigger_webhook" && (
                  <div className="border-t border-bg-border pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-text-dim mb-2">Webhook URL</p>
                    <p className="text-[10px] text-text-muted mb-1.5">POST to this URL to trigger the workflow (workflow must be Active):</p>
                    <div
                      className="rounded border border-bg-border bg-black/30 px-2 py-1.5 text-[10px] font-mono text-text-muted break-all cursor-pointer select-all"
                      onClick={() => navigator.clipboard?.writeText(`https://fortify-io.com/api/workflows/webhook/${init.id}`)}
                      title="Click to copy"
                    >
                      https://fortify-io.com/api/workflows/webhook/{init.id}
                    </div>
                    <p className="wf-config-hint mt-1">Click to copy. Activate the workflow first, then send POST requests to this URL.</p>
                  </div>
                )}

                {/* Connections */}
                <div className="border-t border-bg-border pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-text-dim mb-2">Connections</p>
                  {conns.filter(c => c.fromId === selNode.id || c.toId === selNode.id).length === 0
                    ? <p className="text-xs text-text-dim">No connections yet. Drag from an output port to another node's input port.</p>
                    : conns.filter(c => c.fromId === selNode.id || c.toId === selNode.id).map(c => {
                      const isFrom = c.fromId === selNode.id;
                      const other = nodes.find(n => n.id === (isFrom ? c.toId : c.fromId));
                      if (!other) return null;
                      return (
                        <div key={c.id} className="flex items-center justify-between text-xs text-text-muted mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-text-dim text-[10px]">{isFrom ? `→ [${c.fromPort}]` : "← in"}</span>
                            <span className="truncate">{other.label}</span>
                          </div>
                          <button onClick={() => deleteConn(c.id)} className="text-text-dim hover:text-red-400 ml-2 shrink-0">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })
                  }
                </div>

                <button onClick={() => deleteNode(selNode.id)} className="btn-ghost text-xs w-full text-red-400 hover:text-red-300 mt-1 border border-red-500/20">
                  <Trash2 className="h-3.5 w-3.5" /> Delete node
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Run history drawer ── */}
        {showRuns && (
          <div className="border-t border-bg-border bg-bg-panel" style={{ maxHeight: 280, overflowY: "auto" }}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-bg-border sticky top-0 bg-bg-panel z-10">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Run history</p>
              <div className="flex items-center gap-2">
                <button onClick={fetchRuns} className="text-text-dim hover:text-text text-[10px]" title="Refresh">↻</button>
                <button onClick={() => setShowRuns(false)} className="text-text-dim hover:text-text">
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </div>
            {runs.length === 0 ? (
              <p className="px-4 py-4 text-xs text-text-dim">No runs yet. Click "Run Now" to execute the workflow manually.</p>
            ) : (
              <div>
                {runs.map((r: any) => {
                  const dur = r.completedAt
                    ? `${((new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()) / 1000).toFixed(1)}s`
                    : r.status === "running" ? "running…" : "—";
                  const statusColor = r.status === "completed" ? "#34d399" : r.status === "failed" ? "#f87171" : "#60a5fa";
                  const logs: any[] = Array.isArray(r.log) ? r.log : [];
                  const isExpanded = expandedRunId === r.id;

                  return (
                    <div key={r.id} className="border-b border-bg-border/40">
                      {/* Run summary row */}
                      <button
                        type="button"
                        onClick={() => setExpandedRunId(isExpanded ? null : r.id)}
                        className="flex w-full items-center gap-3 px-4 py-2 text-xs hover:bg-white/[0.02] text-left transition"
                      >
                        <span className="font-semibold" style={{ color: statusColor, minWidth: 70 }}>{r.status}</span>
                        <span className="text-text-muted">{new Date(r.startedAt).toLocaleString()}</span>
                        <span className="text-text-dim ml-auto">{dur}</span>
                        <span className="text-text-dim">{r.usedCapacity}u</span>
                        <span className="text-text-dim text-[10px] ml-1">{isExpanded ? "▲" : "▼"}</span>
                      </button>

                      {/* Expanded per-node logs */}
                      {isExpanded && (
                        <div className="px-4 pb-3 space-y-1.5 bg-black/20">
                          {logs.length === 0 ? (
                            <p className="text-[10px] text-text-dim py-2">No node logs recorded.</p>
                          ) : logs.map((log: any, i: number) => (
                            <div key={i} className="flex items-start gap-2 text-[10px]">
                              <span
                                className="shrink-0 w-14 font-semibold"
                                style={{ color: log.status === "ok" ? "#34d399" : log.status === "error" ? "#f87171" : "#94a3b8" }}
                              >
                                {log.status === "ok" ? "✓ ok" : log.status === "error" ? "✗ err" : "↷ skip"}
                              </span>
                              <span className="text-text-muted font-medium shrink-0 w-28 truncate">{log.nodeLabel}</span>
                              <span className="text-text-dim flex-1 truncate">
                                {log.error ? <span className="text-red-300">{log.error}</span> : log.output}
                              </span>
                              <span className="shrink-0 text-text-dim">{log.ms}ms</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
