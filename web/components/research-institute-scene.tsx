"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Focus, Maximize2, Minimize2, Orbit, RotateCcw, Play, Pause, SkipForward, PanelRight, Zap, ChevronDown, Network, ArrowRight } from "lucide-react";
import { PEOPLE, type World, type PersonId, type Intervention } from "@/lib/research-institute";
import type { CameraView } from "@/lib/institute-space";
import type { createInstituteScene } from "@/lib/institute-renderer";
import { focusExchanges } from "@/lib/institute-teamwork";
import { SIMULATION_THEMES, type SimulationTheme } from "@/lib/institute-themes";
import { presentThemeText, themePerson, THEME_PRESENTATION } from "@/lib/institute-theme-presentation";

type Scene = ReturnType<typeof createInstituteScene>;
export function ResearchInstituteScene({ theme = "research", world, selected, onSelect, playing = false, canRun = false, canStep = false, canIntervene = false, inspecting = false, onToggleRun, onStep, onIntervene, onInspect, initialView = "laboratory" }: { theme?: SimulationTheme; world: World; selected: PersonId; onSelect: (id: PersonId) => void; playing?: boolean; canRun?: boolean; canStep?: boolean; canIntervene?: boolean; inspecting?: boolean; onToggleRun?: () => void; onStep?: () => void; onIntervene?: (event: Intervention) => void; onInspect?: () => void; initialView?: CameraView }) {
  const host = useRef<HTMLDivElement>(null), shell = useRef<HTMLDivElement>(null), scene = useRef<Scene | null>(null), latest = useRef({ world, selected, onSelect });
  latest.current = { world, selected, onSelect };
  const [ready, setReady] = useState(false), [error, setError] = useState(""), [attempt, setAttempt] = useState(0), [view, setView] = useState<CameraView>(initialView), [cinematic, setCinematic] = useState(false), [full, setFull] = useState(false), [quality, setQuality] = useState("auto"), [eventsOpen, setEventsOpen] = useState(false), [showExchanges, setShowExchanges] = useState(true);
  const exchange = focusExchanges(world, selected).at(-1);
  const preferences = useRef({ quality, view }); preferences.current = { quality, view };
  const exchangeName = (id: PersonId) => PEOPLE.find(person => person.id === id)!.name.split(" ")[0];
  const person = PEOPLE.find(p => p.id === selected)!, agent = world.agents.find(a => a.id === selected)!;
  const displayPerson = themePerson(theme, person.id, person), present = (text: string) => presentThemeText(theme, text), presentation = THEME_PRESENTATION[theme];
  const eventTrigger = useRef<HTMLButtonElement>(null);
  const eventOptions = ([{ id: "equipment-fault", title: "Instrument fault", detail: "Health drops to 35%. Watch the team respond." }, { id: "compute-outage", title: "Compute shortage", detail: "One compute slot for three rounds." }, { id: "dataset-shift", title: "New test distribution", detail: "The team needs fresh evidence." }] satisfies { id: Intervention; title: string; detail: string }[]).map(item => ({ ...item, title: present(item.title), detail: present(item.detail) }));
  useEffect(() => { if (!eventsOpen) return; document.querySelector<HTMLButtonElement>("#institute-scene-events button")?.focus(); const close = (e: KeyboardEvent) => { if (e.key === "Escape") { setEventsOpen(false); eventTrigger.current?.focus(); } }; const outside = (e: PointerEvent) => { if (!(e.target as Element).closest(".institute-scene-events")) setEventsOpen(false); }; document.addEventListener("keydown", close); document.addEventListener("pointerdown", outside); return () => { document.removeEventListener("keydown", close); document.removeEventListener("pointerdown", outside); }; }, [eventsOpen]);
  useEffect(() => {
    let cancelled = false; setReady(false); setError("");
    import("@/lib/institute-renderer").then(({ createInstituteScene }) => {
      if (cancelled || !host.current) return;
      try { scene.current = createInstituteScene(host.current, { ...latest.current, theme, onSelect: id => latest.current.onSelect(id), onReady: () => { if (!cancelled) setReady(true); }, onError: message => { if (!cancelled) setError(message); } }); scene.current.setQuality(preferences.current.quality); scene.current.setView(preferences.current.view); }
      catch { setError("The 3D environment could not start. This view needs WebGL 2 graphics support. You can still inspect people and run the simulation below."); }
    }).catch(() => { if (!cancelled) setError("The 3D environment could not load. Reload the view to try again."); });
    return () => { cancelled = true; scene.current?.dispose(); scene.current = null; };
  }, [attempt]);
  useEffect(() => { scene.current?.update(world, selected); }, [world, selected, ready]);
  useEffect(() => { scene.current?.setExchanges(showExchanges); }, [showExchanges, ready]);
  useEffect(() => { const update = () => setFull(document.fullscreenElement === shell.current); document.addEventListener("fullscreenchange", update); return () => document.removeEventListener("fullscreenchange", update); }, []);
  function camera(next: CameraView) { setView(next); setCinematic(false); scene.current?.setView(next); }
  async function fullscreen() { try { if (document.fullscreenElement) await document.exitFullscreen(); else await shell.current?.requestFullscreen(); } catch { setError("Fullscreen is unavailable here. You can still orbit and zoom the lab in this view."); } }
  const themeMeta = SIMULATION_THEMES[theme];
  return <div ref={shell} className="institute-3d-shell">
    <div className="institute-3d-toolbar"><div><span className={`institute-dot ${playing ? "is-running" : ""}`}/><strong>{themeMeta.shortName} world</strong><span>{playing ? "Simulation running" : `Explore ${themeMeta.setting.toLowerCase()}`}</span></div><div><label>Graphics<select aria-label="3D graphics quality" value={quality} onChange={e => { setQuality(e.target.value); scene.current?.setQuality(e.target.value); }}><option value="auto">Auto · adaptive</option><option value="balanced">Balanced</option><option value="high">High · effects</option></select></label>{!full && <button className="institute-details-toggle" aria-label="Toggle agent details" aria-expanded={inspecting} aria-controls="institute-inspector" onClick={onInspect}><PanelRight size={15}/><span>Agent details</span></button>}<button title="Reset camera" aria-label="Reset 3D camera" onClick={() => camera("laboratory")}><RotateCcw size={14}/></button><button title={full ? "Exit fullscreen" : "Enter fullscreen"} aria-label={full ? "Exit fullscreen" : "Enter fullscreen"} onClick={() => void fullscreen()}>{full ? <Minimize2 size={15}/> : <Maximize2 size={15}/>}</button></div></div>
    <div ref={host} className="institute-3d-viewport">
      {!ready && !error && <div className="institute-3d-loading"><Orbit size={28}/><strong>Entering {themeMeta.name}</strong><span>Preparing the simulation world…</span></div>}
      {error && <div className="institute-3d-error" role="alert"><p>{error}</p><button onClick={() => { scene.current?.dispose(); scene.current = null; setAttempt(a => a + 1); }}>Reload 3D view</button></div>}
      <div className="institute-3d-corner"><strong>{themeMeta.name}</strong><small>{presentation.peopleSummary}</small></div>
      <div className="institute-3d-readings"><span>{presentation.instrumentsLabel}<strong>{world.health}%</strong></span><span>{themeMeta.reserveLabel.toUpperCase()}<strong>{world.treasury}<small> credits</small></strong></span><span>ROUND<strong>{String(world.round).padStart(2, "0")}<small> / 24</small></strong></span></div>
      <div className="institute-3d-camera"><Camera size={13}/>{([['overview','Overview'],['inside','Inside'],['laboratory','Lab'],['systems','Systems'],['office','Office'],['analysis','Analysis'],['collaboration','Team']] as [CameraView,string][]).map(([id,label])=><button key={id} aria-pressed={view===id&&!cinematic} onClick={()=>camera(id)}>{label}</button>)}<button aria-pressed={view==="follow"&&!cinematic} onClick={()=>camera("follow")}><Focus size={12}/> Follow agent</button><button aria-label="Toggle communication traces" title="Recorded exchanges involving the selected person" aria-pressed={showExchanges} onClick={()=>setShowExchanges(!showExchanges)}><Network size={13}/></button><button aria-label="Toggle cinematic orbit" aria-pressed={cinematic} onClick={()=>{const next=!cinematic;setCinematic(next);scene.current?.setCinematic(next);}}><Orbit size={13}/></button></div>
      <div className="institute-scene-focus"><span>{person.initials}</span><div><strong>{person.name}<small>{displayPerson.role}</small></strong><p>{present(agent.activity)}</p></div><button onClick={() => camera("follow")} aria-label={`Follow ${person.name}`}><Focus size={15}/></button></div>
      {exchange && <div className="institute-scene-exchange" data-exchange={exchange.id}><span>Recorded {exchange.kind}</span><strong><button onClick={()=>onSelect(exchange.from)}>{exchangeName(exchange.from)}</button><ArrowRight size={13}/><button onClick={()=>onSelect(exchange.to)}>{exchangeName(exchange.to)}</button></strong><p>{present(exchange.subject)}</p></div>}
    </div>
    <div className="institute-3d-playback"><button disabled={!canRun} onClick={onToggleRun}>{playing?<Pause size={15}/>:<Play size={15}/>} {playing?"Pause":"Run simulation"}</button><button className="institute-step" disabled={!canStep} onClick={onStep}><SkipForward size={14}/> Next round</button><div className="institute-scene-events"><button ref={eventTrigger} className="institute-event-trigger" disabled={!canIntervene} aria-expanded={eventsOpen} aria-controls="institute-scene-events" onClick={() => setEventsOpen(!eventsOpen)}><Zap size={14}/> Introduce event<ChevronDown size={12}/></button>{eventsOpen && <div id="institute-scene-events" className="institute-event-menu"><p>Change a condition, then advance a round to see the response.</p>{eventOptions.map(item => <button key={item.id} onClick={() => { if (canIntervene) onIntervene?.(item.id); setEventsOpen(false); eventTrigger.current?.focus(); }}><strong>{item.title}</strong><span>{item.detail}</span></button>)}</div>}</div><span>Round {world.round} / 24 · {world.status==="active"?playing ? presentation.workInProgress : "Paused":present(world.result)}</span></div>
    <div className="institute-3d-help"><span>Drag to orbit · Scroll to zoom · Right-drag to pan</span><span>Select a person to inspect their decisions</span></div>
  </div>;
}
