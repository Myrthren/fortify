"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowLeft, Save, Play, Pause, Loader2, Plus, X, Trash2, History, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";

// ── Canvas dimensions ────────────────────────────────────────────────────────
const CW = 3200;
const CH = 2000;
const NW = 200; // node width
const NH = 76;  // node height
const PR = 7;   // port radius

// ── Node registry ─────────────────────────────────────────────────────────────
type PortKey = "out" | "yes" | "no";

type NodeDef = {
  label: string;
  icon: string;
  category: "trigger" | "ai" | "action" | "logic";
  accent: string;
  ports: PortKey[];
  configFields?: { key: string; placeholder: string; label: string }[];
};

const DEFS: Record<string, NodeDef> = {
  // Triggers
  trigger_schedule:   { label:"Schedule",         icon:"⏰", category:"trigger", accent:"#a78bfa", ports:["out"], configFields:[{key:"cron",label:"Cron expression",placeholder:"0 9 * * 1"}] },
  trigger_webhook:    { label:"Webhook In",        icon:"⚡", category:"trigger", accent:"#a78bfa", ports:["out"] },
  trigger_new_member: { label:"New Member",        icon:"👤", category:"trigger", accent:"#a78bfa", ports:["out"] },
  trigger_competitor: { label:"Competitor Change", icon:"👁", category:"trigger", accent:"#a78bfa", ports:["out"] },
  trigger_lead:       { label:"New Lead Found",    icon:"🎯", category:"trigger", accent:"#a78bfa", ports:["out"] },
  // AI
  ai_generate:        { label:"AI Generate",       icon:"✦",  category:"ai",      accent:"#38bdf8", ports:["out"], configFields:[{key:"prompt",label:"Prompt",placeholder:"Write a weekly summary of…"}] },
  ai_summarise:       { label:"AI Summarise",      icon:"📝", category:"ai",      accent:"#38bdf8", ports:["out"] },
  ai_analyse:         { label:"AI Analyse",        icon:"🔎", category:"ai",      accent:"#38bdf8", ports:["out"] },
  ai_classify:        { label:"AI Classify",       icon:"🏷", category:"ai",      accent:"#38bdf8", ports:["out"] },
  // Actions
  action_discord:     { label:"Discord Post",      icon:"💬", category:"action",  accent:"#818cf8", ports:["out"], configFields:[{key:"channel",label:"Channel ID",placeholder:"1234567890"}] },
  action_email:       { label:"Send Email",        icon:"📧", category:"action",  accent:"#34d399", ports:["out"], configFields:[{key:"to",label:"To",placeholder:"user@example.com"},{key:"subject",label:"Subject",placeholder:"Weekly update"}] },
  action_slack:       { label:"Slack Post",        icon:"💼", category:"action",  accent:"#f59e0b", ports:["out"], configFields:[{key:"channel",label:"Channel",placeholder:"#general"}] },
  action_notion:      { label:"Notion Create",     icon:"📓", category:"action",  accent:"#e2e8f0", ports:["out"], configFields:[{key:"database",label:"Database ID",placeholder:"abc123…"}] },
  action_twitter:     { label:"X / Twitter",       icon:"𝕏",  category:"action",  accent:"#e2e8f0", ports:["out"] },
  action_shopify:     { label:"Shopify",           icon:"🛍", category:"action",  accent:"#95bf47", ports:["out"] },
  action_webhook_out: { label:"Webhook Out",       icon:"📤", category:"action",  accent:"#f59e0b", ports:["out"], configFields:[{key:"url",label:"URL",placeholder:"https://…"}] },
  // Logic
  logic_condition:    { label:"Condition",         icon:"◇",  category:"logic",   accent:"#fb923c", ports:["yes","no"], configFields:[{key:"condition",label:"Condition",placeholder:"{{value}} > 100"}] },
  logic_delay:        { label:"Delay",             icon:"⏳", category:"logic",   accent:"#6b7280", ports:["out"], configFields:[{key:"duration",label:"Duration",placeholder:"5m"}] },
  logic_filter:       { label:"Filter",            icon:"⧩",  category:"logic",   accent:"#6b7280", ports:["out"], configFields:[{key:"filter",label:"Filter expression",placeholder:"{{tier}} == 'ELITE'"}] },
};

const CATEGORY_ORDER = ["trigger","ai","action","logic"] as const;
const CATEGORY_LABELS: Record<string, string> = { trigger:"Triggers", ai:"AI", action:"Actions", logic:"Logic" };

// ── Types ────────────────────────────────────────────────────────────────────
type WFNode = { id:string; type:string; label:string; x:number; y:number; config:Record<string,string> };
type Conn    = { id:string; fromId:string; fromPort:PortKey; toId:string };

type WorkflowData = {
  id:string; name:string; description:string|null; active:boolean;
  nodes:any[]; connections:any[]; runs:any[];
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2,10); }

function outPortPos(node:WFNode, port:PortKey, ports:PortKey[]) {
  const i = ports.indexOf(port);
  const n = ports.length;
  const gap = NW / (n + 1);
  return { x: node.x + gap*(i+1), y: node.y + NH };
}

function inPortPos(node:WFNode) {
  return { x: node.x + NW/2, y: node.y };
}

function bezier(x1:number,y1:number,x2:number,y2:number) {
  const cy = Math.max(Math.abs(y2-y1)*0.55, 70);
  return `M${x1},${y1} C${x1},${y1+cy} ${x2},${y2-cy} ${x2},${y2}`;
}

function accentForPort(port:PortKey): string {
  if (port==="yes") return "#34d399";
  if (port==="no")  return "#f87171";
  return "rgba(255,255,255,0.5)";
}

// ── Default example nodes ────────────────────────────────────────────────────
const DEFAULT_NODES: WFNode[] = [
  { id:"n1", type:"trigger_new_member", label:"New Member",   x:460, y:160, config:{} },
  { id:"n2", type:"ai_generate",        label:"AI Generate",  x:460, y:340, config:{ prompt:"Welcome email for new Fortify member" } },
  { id:"n3", type:"action_discord",     label:"Discord Post", x:460, y:520, config:{ channel:"1234567890" } },
];
const DEFAULT_CONNS: Conn[] = [
  { id:"c1", fromId:"n1", fromPort:"out", toId:"n2" },
  { id:"c2", fromId:"n2", fromPort:"out", toId:"n3" },
];

// ── Main component ─────────────────────────────────────────────────────────────
export function WorkflowEditor({ workflow: init }: { workflow: WorkflowData }) {
  const [wfName,    setWfName]    = useState(init.name);
  const [active,    setActive]    = useState(init.active);
  const [nodes,     setNodes]     = useState<WFNode[]>(() => {
    const saved = init.nodes as WFNode[];
    return saved?.length ? saved : DEFAULT_NODES;
  });
  const [conns,     setConns]     = useState<Conn[]>(() => {
    const saved = init.connections as Conn[];
    return saved?.length ? saved : DEFAULT_CONNS;
  });
  const [selId,     setSelId]     = useState<string|null>(null);
  const [saving,    setSaving]    = useState(false);
  const [toggling,  setToggling]  = useState(false);
  const [dirty,     setDirty]     = useState(false);
  const [showRuns,  setShowRuns]  = useState(false);
  const [tempConn,  setTempConn]  = useState<{x1:number;y1:number;x2:number;y2:number}|null>(null);
  const [hovInputId,setHovInputId]= useState<string|null>(null);

  // Drag state held in refs (avoids re-render on every mouse move)
  const drag = useRef<{
    kind: null|"node"|"connect";
    nodeId?:string; startCX?:number; startCY?:number; nodeX?:number; nodeY?:number;
    fromId?:string; fromPort?:PortKey;
  }>({ kind:null });
  const nodesRef  = useRef(nodes);
  const canvasRef = useRef<HTMLDivElement>(null);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  // Canvas-relative coordinates
  const xy = useCallback((e:PointerEvent|MouseEvent) => {
    const el = canvasRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left + el.scrollLeft, y: e.clientY - r.top + el.scrollTop };
  }, []);

  // Global pointer listeners (stable, mounted once)
  useEffect(() => {
    const onMove = (e:PointerEvent) => {
      const d = drag.current;
      if (!d.kind) return;
      const c = xy(e); if (!c) return;

      if (d.kind === "node") {
        setNodes(prev => prev.map(n => n.id===d.nodeId
          ? { ...n, x:Math.max(0,d.nodeX!+(c.x-d.startCX!)), y:Math.max(0,d.nodeY!+(c.y-d.startCY!)) }
          : n));
      } else if (d.kind === "connect") {
        const from = nodesRef.current.find(n=>n.id===d.fromId);
        if (!from) return;
        const pp = outPortPos(from, d.fromPort!, DEFS[from.type]?.ports ?? ["out"]);
        setTempConn({ x1:pp.x, y1:pp.y, x2:c.x, y2:c.y });
        // check hover on input ports
        let hov:string|null = null;
        for (const node of nodesRef.current) {
          if (node.id===d.fromId) continue;
          const ip = inPortPos(node);
          if (Math.hypot(c.x-ip.x, c.y-ip.y) <= 20) { hov=node.id; break; }
        }
        setHovInputId(hov);
      }
    };

    const onUp = (e:PointerEvent) => {
      const d = drag.current;
      if (d.kind === "connect") {
        const c = xy(e);
        if (c) {
          for (const node of nodesRef.current) {
            if (node.id===d.fromId) continue;
            const ip = inPortPos(node);
            if (Math.hypot(c.x-ip.x, c.y-ip.y) <= 20) {
              setConns(prev => {
                if (prev.some(cn=>cn.fromId===d.fromId && cn.fromPort===d.fromPort)) return prev;
                return [...prev, {id:uid(), fromId:d.fromId!, fromPort:d.fromPort!, toId:node.id}];
              });
              setDirty(true);
              break;
            }
          }
        }
      }
      drag.current = { kind:null };
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

  function startNodeDrag(e:React.PointerEvent, nodeId:string) {
    e.preventDefault(); e.stopPropagation();
    const c = xy(e.nativeEvent); if (!c) return;
    const node = nodesRef.current.find(n=>n.id===nodeId)!;
    drag.current = { kind:"node", nodeId, startCX:c.x, startCY:c.y, nodeX:node.x, nodeY:node.y };
    setSelId(nodeId);
  }

  function startConnect(e:React.PointerEvent, fromId:string, fromPort:PortKey) {
    e.preventDefault(); e.stopPropagation();
    drag.current = { kind:"connect", fromId, fromPort };
  }

  function addNode(type:string) {
    const el = canvasRef.current;
    const cx = (el?.scrollLeft??0) + (el?.clientWidth??800)/2 - NW/2 + (Math.random()-0.5)*80;
    const cy = (el?.scrollTop??0)  + (el?.clientHeight??600)/2 - NH/2 + (Math.random()-0.5)*80;
    const n:WFNode = { id:uid(), type, label:DEFS[type]?.label??type, x:Math.max(0,cx), y:Math.max(0,cy), config:{} };
    setNodes(p=>[...p,n]);
    setSelId(n.id); setDirty(true);
  }

  function deleteNode(id:string) {
    setNodes(p=>p.filter(n=>n.id!==id));
    setConns(p=>p.filter(c=>c.fromId!==id && c.toId!==id));
    if (selId===id) setSelId(null);
    setDirty(true);
  }

  function deleteConn(id:string) {
    setConns(p=>p.filter(c=>c.id!==id));
    setDirty(true);
  }

  function updateConfig(nodeId:string, key:string, val:string) {
    setNodes(p=>p.map(n=>n.id===nodeId ? {...n, config:{...n.config,[key]:val}} : n));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/workflows/${init.id}`, {
        method:"PATCH",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ name:wfName, nodes, connections:conns }),
      });
      setDirty(false);
    } finally { setSaving(false); }
  }

  async function toggleActive() {
    setToggling(true);
    try {
      const r = await fetch(`/api/workflows/${init.id}`, {
        method:"PATCH", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ active:!active }),
      });
      if (r.ok) setActive(a=>!a);
    } finally { setToggling(false); }
  }

  const selNode = nodes.find(n=>n.id===selId);
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
            onChange={e=>{setWfName(e.target.value);setDirty(true);}}
            placeholder="Workflow name"
          />
          <div className="ml-auto flex items-center gap-2">
            {dirty && <span className="text-[10px] text-text-dim">Unsaved changes</span>}
            <button onClick={()=>setShowRuns(r=>!r)} className="btn-ghost text-xs gap-1.5">
              <History className="h-3.5 w-3.5" />Runs
            </button>
            <button onClick={toggleActive} disabled={toggling} className="btn-secondary text-xs">
              {toggling ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : active ? <><Pause className="h-3 w-3"/>Pause</> : <><Play className="h-3 w-3"/>Activate</>}
            </button>
            <button onClick={save} disabled={!dirty||saving} className="btn-primary text-xs disabled:opacity-40">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <><Save className="h-3 w-3"/>Save</>}
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Sidebar ── */}
          <div className="w-52 shrink-0 overflow-y-auto border-r border-bg-border bg-bg-panel py-3">
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-text-dim">Add node</p>
            {CATEGORY_ORDER.map(cat=>{
              const items = Object.entries(DEFS).filter(([,d])=>d.category===cat);
              return (
                <div key={cat} className="mb-3">
                  <p className="px-3 pb-1 text-[10px] font-medium uppercase tracking-wider text-text-dim">
                    {CATEGORY_LABELS[cat]}
                  </p>
                  {items.map(([type,def])=>(
                    <button
                      key={type}
                      onClick={()=>addNode(type)}
                      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-xs text-text-muted transition hover:bg-white/[0.04] hover:text-text"
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px]"
                        style={{ background:"linear-gradient(145deg,#111,#1a1a1a)", border:`1px solid ${def.accent}33` }}
                      >
                        {def.icon}
                      </span>
                      {def.label}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>

          {/* ── Canvas ── */}
          <div
            ref={canvasRef}
            className="relative flex-1 overflow-auto"
            style={{
              background:"#020202",
              backgroundImage:[
                "radial-gradient(circle, rgba(255,255,255,0.085) 1px, transparent 1px)",
                "radial-gradient(circle, rgba(255,255,255,0.045) 1.5px, transparent 1.5px)",
                "radial-gradient(circle, rgba(255,255,255,0.025) 2px, transparent 2px)",
              ].join(","),
              backgroundSize:"20px 20px, 40px 40px, 80px 80px",
              backgroundPosition:"0 0, 10px 10px, 0 0",
            }}
            onClick={e=>{
              if ((e.target as HTMLElement).closest(".wf-node")) return;
              setSelId(null);
            }}
          >
            {/* Inner content div */}
            <div style={{ width:CW, height:CH, position:"relative" }}>

              {/* SVG connections layer */}
              <svg
                style={{ position:"absolute", inset:0, width:CW, height:CH, pointerEvents:"none", overflow:"visible" }}
              >
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

                {/* Existing connections */}
                {conns.map(conn=>{
                  const fromNode = nodes.find(n=>n.id===conn.fromId);
                  const toNode   = nodes.find(n=>n.id===conn.toId);
                  if (!fromNode||!toNode) return null;
                  const fp = outPortPos(fromNode, conn.fromPort, DEFS[fromNode.type]?.ports??["out"]);
                  const tp = inPortPos(toNode);
                  const strokeColor =
                    conn.fromPort==="yes" ? "#34d39966" :
                    conn.fromPort==="no"  ? "#f8717166" :
                    "rgba(255,255,255,0.22)";
                  const arrowRef =
                    conn.fromPort==="yes" ? "url(#arrow-yes)" :
                    conn.fromPort==="no"  ? "url(#arrow-no)"  :
                    "url(#arrow)";
                  return (
                    <g key={conn.id} style={{ pointerEvents:"stroke" }}>
                      <path
                        d={bezier(fp.x,fp.y,tp.x,tp.y)}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={14}
                        className="wf-conn"
                        onClick={()=>deleteConn(conn.id)}
                        style={{ cursor:"pointer", pointerEvents:"stroke" }}
                      />
                      <path
                        d={bezier(fp.x,fp.y,tp.x,tp.y)}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={1.5}
                        strokeDasharray="6 4"
                        markerEnd={arrowRef}
                        className="wf-conn"
                        onClick={()=>deleteConn(conn.id)}
                        style={{ pointerEvents:"none" }}
                      />
                    </g>
                  );
                })}

                {/* Temp connection being drawn */}
                {tempConn && (
                  <path
                    d={bezier(tempConn.x1,tempConn.y1,tempConn.x2,tempConn.y2)}
                    fill="none"
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                  />
                )}
              </svg>

              {/* Nodes */}
              {nodes.map(node=>{
                const def = DEFS[node.type] ?? { label:node.type, icon:"⚙", category:"action", accent:"#555", ports:["out"] as PortKey[], configFields:[] };
                const isSelected = selId===node.id;

                return (
                  <div
                    key={node.id}
                    className={`wf-node absolute${isSelected ? " selected" : ""}`}
                    style={{
                      left:node.x, top:node.y,
                      width:NW, height:NH,
                      background:"linear-gradient(145deg, #0c0c0c 0%, #181818 50%, #111 100%)",
                      border:"1px solid rgba(255,255,255,0.1)",
                      borderRadius:14,
                      cursor:"grab",
                      userSelect:"none",
                      zIndex: isSelected ? 10 : 1,
                    }}
                    onPointerDown={e=>startNodeDrag(e,node.id)}
                  >
                    {/* Accent top bar */}
                    <div style={{
                      position:"absolute", top:0, left:12, right:12, height:2,
                      background:`linear-gradient(90deg, transparent, ${def.accent}99, transparent)`,
                      borderRadius:"0 0 4px 4px",
                    }}/>

                    {/* Node body */}
                    <div className="flex h-full items-center gap-2.5 px-3 pt-1">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base"
                        style={{ background:`linear-gradient(145deg,#111,#1c1c1c)`, border:`1px solid ${def.accent}40` }}
                      >
                        {def.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-text leading-tight truncate">{node.label}</p>
                        <p className="text-[10px] text-text-dim leading-tight capitalize">{def.category}</p>
                      </div>
                      <button
                        onPointerDown={e=>{e.stopPropagation();}}
                        onClick={e=>{e.stopPropagation();deleteNode(node.id);}}
                        className="shrink-0 text-text-dim hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                        style={{ opacity: isSelected ? 1 : 0.3 }}
                      >
                        <X className="h-3 w-3"/>
                      </button>
                    </div>

                    {/* Input port (top center) */}
                    <div
                      className={`wf-port-in absolute${hovInputId===node.id?" hover-target":""}`}
                      style={{
                        width:PR*2, height:PR*2, borderRadius:"50%",
                        background:"#1a1a1a", border:"1.5px solid rgba(255,255,255,0.35)",
                        left:NW/2-PR, top:-PR,
                        pointerEvents:"none",
                      }}
                    />

                    {/* Output port(s) (bottom) */}
                    {def.ports.map(port=>{
                      const pp = outPortPos(node,port,def.ports);
                      const portColor = port==="yes"?"#34d399":port==="no"?"#f87171":"rgba(255,255,255,0.5)";
                      return (
                        <div key={port} style={{ position:"absolute", pointerEvents:"all" }}>
                          <div
                            className="wf-port"
                            style={{
                              width:PR*2, height:PR*2, borderRadius:"50%",
                              background:"#111",
                              border:`1.5px solid ${portColor}`,
                              boxShadow:`0 0 4px ${portColor}55`,
                              position:"absolute",
                              left:pp.x-node.x-PR, top:NH-PR,
                            }}
                            onPointerDown={e=>startConnect(e,node.id,port)}
                          />
                          {def.ports.length > 1 && (
                            <span style={{
                              position:"absolute",
                              left:pp.x-node.x-10, top:NH+10,
                              fontSize:9, color:portColor, fontWeight:600,
                              pointerEvents:"none",
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

          {/* ── Config panel ── */}
          {selNode && selDef && (
            <div className="w-64 shrink-0 overflow-y-auto border-l border-bg-border bg-bg-panel">
              <div className="border-b border-bg-border px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">{selDef.icon}</span>
                  <p className="text-sm font-semibold">{selNode.label}</p>
                </div>
                <button onClick={()=>setSelId(null)} className="text-text-muted hover:text-text">
                  <X className="h-4 w-4"/>
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* Label */}
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Node label</label>
                  <input
                    className="input text-xs"
                    value={selNode.label}
                    onChange={e=>{
                      setNodes(p=>p.map(n=>n.id===selNode.id?{...n,label:e.target.value}:n));
                      setDirty(true);
                    }}
                  />
                </div>

                {/* Config fields */}
                {selDef.configFields?.map(f=>(
                  <div key={f.key}>
                    <label className="text-xs text-text-muted mb-1 block">{f.label}</label>
                    <input
                      className="input text-xs"
                      placeholder={f.placeholder}
                      value={selNode.config[f.key]??''}
                      onChange={e=>updateConfig(selNode.id,f.key,e.target.value)}
                    />
                  </div>
                ))}

                {/* Connected to */}
                <div>
                  <p className="text-xs text-text-muted mb-1">Connected to</p>
                  {conns.filter(c=>c.fromId===selNode.id||c.toId===selNode.id).length===0
                    ? <p className="text-xs text-text-dim">No connections</p>
                    : conns.filter(c=>c.fromId===selNode.id||c.toId===selNode.id).map(c=>{
                      const other = nodes.find(n=>n.id===(c.fromId===selNode.id?c.toId:c.fromId));
                      if (!other) return null;
                      return (
                        <div key={c.id} className="flex items-center justify-between text-xs text-text-muted mb-1">
                          <span className="truncate">{other.label}</span>
                          <button onClick={()=>deleteConn(c.id)} className="text-text-dim hover:text-red-400 ml-2 shrink-0">
                            <X className="h-3 w-3"/>
                          </button>
                        </div>
                      );
                    })
                  }
                </div>

                <button onClick={()=>deleteNode(selNode.id)} className="btn-ghost text-xs w-full text-red-400 hover:text-red-300 mt-2">
                  <Trash2 className="h-3.5 w-3.5"/> Delete node
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Run history drawer ── */}
        {showRuns && (
          <div className="border-t border-bg-border bg-bg-panel" style={{ height:200, overflowY:"auto" }}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-bg-border sticky top-0 bg-bg-panel">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Run history</p>
              <button onClick={()=>setShowRuns(false)} className="text-text-dim hover:text-text">
                <ChevronDown className="h-4 w-4"/>
              </button>
            </div>
            {init.runs.length===0 ? (
              <p className="px-4 py-4 text-xs text-text-dim">No runs yet.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-dim border-b border-bg-border">
                    <th className="px-4 py-1.5 text-left font-medium">Status</th>
                    <th className="px-4 py-1.5 text-left font-medium">Started</th>
                    <th className="px-4 py-1.5 text-left font-medium">Duration</th>
                    <th className="px-4 py-1.5 text-left font-medium">Capacity</th>
                  </tr>
                </thead>
                <tbody>
                  {init.runs.map((r:any)=>{
                    const dur = r.completedAt
                      ? `${((new Date(r.completedAt).getTime()-new Date(r.startedAt).getTime())/1000).toFixed(1)}s`
                      : "—";
                    const color = r.status==="completed"?"text-emerald-400":r.status==="failed"?"text-red-400":"text-blue-400";
                    return (
                      <tr key={r.id} className="border-b border-bg-border/40 hover:bg-white/[0.02]">
                        <td className={`px-4 py-2 font-medium ${color}`}>{r.status}</td>
                        <td className="px-4 py-2 text-text-muted">{new Date(r.startedAt).toLocaleString()}</td>
                        <td className="px-4 py-2 text-text-muted">{dur}</td>
                        <td className="px-4 py-2 text-text-muted">{r.usedCapacity} units</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </>
  );
}
