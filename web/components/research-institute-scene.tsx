"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Focus, Maximize2, Minimize2, Orbit, RotateCcw, Play, Pause, SkipForward } from "lucide-react";
import type { World, PersonId } from "@/lib/research-institute";
import type { CameraView } from "@/lib/institute-space";
import type { createInstituteScene } from "@/lib/institute-renderer";

type Scene = ReturnType<typeof createInstituteScene>;
export function ResearchInstituteScene({ world, selected, onSelect, playing = false, canRun = false, canStep = false, onToggleRun, onStep }: { world: World; selected: PersonId; onSelect: (id: PersonId) => void; playing?: boolean; canRun?: boolean; canStep?: boolean; onToggleRun?: () => void; onStep?: () => void }) {
  const host = useRef<HTMLDivElement>(null), shell = useRef<HTMLDivElement>(null), scene = useRef<Scene | null>(null), latest = useRef({ world, selected, onSelect });
  latest.current = { world, selected, onSelect };
  const [ready, setReady] = useState(false), [error, setError] = useState(""), [attempt, setAttempt] = useState(0), [view, setView] = useState<CameraView>("overview"), [cinematic, setCinematic] = useState(false), [full, setFull] = useState(false), [quality, setQuality] = useState("high");
  useEffect(() => {
    let cancelled = false; setReady(false); setError("");
    import("@/lib/institute-renderer").then(({ createInstituteScene }) => {
      if (cancelled || !host.current) return;
      try { scene.current = createInstituteScene(host.current, { ...latest.current, onSelect: id => latest.current.onSelect(id), onReady: () => setReady(true), onError: setError }); scene.current.setQuality(quality); scene.current.setView(view); }
      catch { setError("The 3D environment could not start. This view needs WebGL 2 graphics support. You can still inspect people and run the simulation below."); }
    }).catch(() => { if (!cancelled) setError("The 3D environment could not load. Reload the view to try again."); });
    return () => { cancelled = true; scene.current?.dispose(); scene.current = null; };
  }, [attempt]);
  useEffect(() => { scene.current?.update(world, selected); }, [world, selected, ready]);
  useEffect(() => { const update = () => setFull(document.fullscreenElement === shell.current); document.addEventListener("fullscreenchange", update); return () => document.removeEventListener("fullscreenchange", update); }, []);
  function camera(next: CameraView) { setView(next); setCinematic(false); scene.current?.setView(next); }
  async function fullscreen() { try { if (document.fullscreenElement) await document.exitFullscreen(); else await shell.current?.requestFullscreen(); } catch { setError("Fullscreen is unavailable here. You can still orbit and zoom the lab in this view."); } }
  return <div ref={shell} className="institute-3d-shell">
    <div className="institute-3d-toolbar"><div><span className="institute-dot"/><strong>INSTITUTE / 01</strong><span>Autonomous research</span></div><div><label>Graphics<select aria-label="3D graphics quality" value={quality} onChange={e => { setQuality(e.target.value); scene.current?.setQuality(e.target.value); }}><option value="high">High</option><option value="balanced">Balanced</option></select></label><button title="Reset camera" aria-label="Reset 3D camera" onClick={() => camera("overview")}><RotateCcw size={14}/></button><button title={full ? "Exit fullscreen" : "Enter fullscreen"} aria-label={full ? "Exit fullscreen" : "Enter fullscreen"} onClick={() => void fullscreen()}>{full ? <Minimize2 size={15}/> : <Maximize2 size={15}/>}</button></div></div>
    <div ref={host} className="institute-3d-viewport">
      {!ready && !error && <div className="institute-3d-loading"><Orbit size={28}/><strong>Entering the institute</strong><span>Preparing the research floor…</span></div>}
      {error && <div className="institute-3d-error" role="alert"><p>{error}</p><button onClick={() => { scene.current?.dispose(); scene.current = null; setAttempt(a => a + 1); }}>Reload 3D view</button></div>}
      <div className="institute-3d-corner"><span>FORTIFY RESEARCH SYSTEMS</span><strong>Research Institute</strong><small>Six people. Two hypotheses. One shared world.</small></div>
      <div className="institute-3d-readings"><span>INSTRUMENTS<strong>{world.health}%</strong></span><span>GRANT<strong>{world.treasury}<small> credits</small></strong></span><span>ROUND<strong>{String(world.round).padStart(2, "0")}<small> / 24</small></strong></span></div>
      <div className="institute-3d-camera"><Camera size={13}/>{([['overview','Overview'],['inside','Inside'],['laboratory','Lab'],['systems','Systems'],['office','Office'],['analysis','Analysis']] as [CameraView,string][]).map(([id,label])=><button key={id} aria-pressed={view===id&&!cinematic} onClick={()=>camera(id)}>{label}</button>)}<button aria-pressed={view==="follow"&&!cinematic} onClick={()=>camera("follow")}><Focus size={12}/> Follow agent</button><button aria-label="Toggle cinematic orbit" aria-pressed={cinematic} onClick={()=>{const next=!cinematic;setCinematic(next);scene.current?.setCinematic(next);}}><Orbit size={13}/></button></div>
    </div>
    {full&&<div className="institute-3d-playback"><button disabled={!canRun} onClick={onToggleRun}>{playing?<Pause size={13}/>:<Play size={13}/>} {playing?"Pause simulation":"Run simulation"}</button><button disabled={!canStep} onClick={onStep}><SkipForward size={13}/> Next round</button><span>Round {world.round} / 24 · {world.status==="active"?"Research in progress":world.result}</span></div>}
    <div className="institute-3d-help"><span>Drag to orbit · Scroll to zoom · Right-drag to pan</span><span>Select a person to inspect their decisions</span></div>
  </div>;
}
