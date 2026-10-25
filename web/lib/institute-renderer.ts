import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { PEOPLE, availableCompute, projectScore, type World, type PersonId, type Location } from "./research-institute";
import { station, route, CAMERA_VIEWS, type CameraView, type Point } from "./institute-space";
import { workPose, limbAngles, footCycle, handReach } from "./institute-motion";
import { currentExchanges, focusExchanges, conversationPartner } from "./institute-teamwork";
import { createCharacterHead, INSTITUTE_CHARACTER_LOOKS } from "./institute-character";
import { graphicsPixelRatio, resolutionAfterWindow, type GraphicsQuality } from "./institute-performance";
import { SIMULATION_THEMES, type SimulationTheme } from "./institute-themes";
import { presentThemeText, themePerson, THEME_PRESENTATION } from "./institute-theme-presentation";

type Rig = { id: PersonId; root: T.Group; body: T.Group; head: T.Group; face: T.Mesh; tablet: T.Group; arms: T.Group[]; elbows: T.Group[]; wrists: T.Group[]; fingers: T.Group[]; eyes: T.Group[]; legs: T.Group[]; knees: T.Group[]; ankles: T.Group[]; destination: Point; path: Point[]; location: Location; phase: number; distance: number; seat: number; ring: T.Mesh; label: HTMLButtonElement };
type Options = { world: World; selected: PersonId; theme?: SimulationTheme; onSelect: (id: PersonId) => void; onReady: () => void; onError: (message: string) => void };

// The environment is authored locally; anatomical head data is bundled and the iris texture is self-hosted.
export function createInstituteScene(host: HTMLElement, options: Options) {
  const worldTheme = options.theme ?? "research", theme = SIMULATION_THEMES[worldTheme];
  const present = (text: string) => presentThemeText(worldTheme, text), presentation = THEME_PRESENTATION[worldTheme];
  let world = options.world, selected = options.selected, disposed = false, animation = 0, previous = 0, elapsed = 0, hidden = document.hidden;
  let view: CameraView = "overview", follow = false, teamCamera = false, cinematic = false, quality: GraphicsQuality = "auto", cameraTween = 0, exchangesVisible = true;
  let adaptiveScale = 1, visible = true, labelUpdated = 0, shadowUpdated = 0, firstFrame = true;
  let budgetStarted = 0, budgetFrames = 0, budgetTime = 0, renderWidth = 1, renderHeight = 1;
  let exchanges = currentExchanges(world), exchangeStarted = 0;
  let partners = new Map(PEOPLE.map(person => [person.id, conversationPartner(world, person.id)]));
  let highlighted = focusExchanges(world, selected);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scene = new T.Scene(); scene.background = new T.Color(theme.background); scene.fog = new T.FogExp2(theme.background, worldTheme === "orbital" ? .0045 : .008);
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  // Opt-in diagnostics count the whole composer frame, including shadow and AO passes.
  const profiling = new URLSearchParams(window.location.search).has("profile");
  const samples: { interval: number; cpu: number; calls: number; triangles: number }[] = [];
  renderer.info.autoReset = false;
  let lastProfile = 0;
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
  renderer.domElement.setAttribute("aria-label", `Interactive 3D ${theme.name}. Drag to orbit, scroll to zoom. Select a person in the scene or the people controls.`);
  renderer.domElement.setAttribute("role", "img"); renderer.domElement.tabIndex = 0; host.prepend(renderer.domElement);
  const camera = new T.PerspectiveCamera(40, 1, .1, 160); camera.position.set(24, 24, 29);
  const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, 0, 0); controls.enableDamping = true; controls.dampingFactor = .065;
  controls.minDistance = 3; controls.maxDistance = 56; controls.maxPolarAngle = Math.PI / 2.07; controls.minPolarAngle = .15; controls.zoomSpeed = .75; controls.panSpeed = .6;
  const eyeGoal = camera.position.clone(), targetGoal = controls.target.clone(), positionScratch = new T.Vector3(), projection = new T.Vector3();
  const geometry = new Map<string, T.BufferGeometry>(), material = new Map<string, T.MeshStandardMaterial>(); const textures: T.Texture[] = [];
  const group = (parent: T.Object3D, x = 0, y = 0, z = 0, rotation = 0) => { const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = rotation; parent.add(g); return g; };
  function mat(color: string, roughness = .6, metalness = 0, glow = 0) { const key = `${color}/${roughness}/${metalness}/${glow}`; if (!material.has(key)) material.set(key, new T.MeshStandardMaterial({ color, roughness, metalness, emissive: color, emissiveIntensity: glow })); return material.get(key)!; }
  const white = mat(theme.wall, .38, .12), ceramic = mat(theme.surface, .26, .08), graphite = mat(worldTheme === "orbital" ? "#101720" : "#1c1d1f", .43, .55), black = mat(worldTheme === "orbital" ? "#060a10" : "#101112", .51, .2), steel = mat(theme.metal, .24, .92), rubber = mat("#101011", .88), wood = mat(worldTheme === "operations" ? "#4a3c31" : "#353332", .63), cool = mat(theme.signal, .22, .3, 1.8), green = mat(worldTheme === "orbital" ? "#71b7c9" : "#a3b5aa", .3, .15, 1.6), amber = mat(worldTheme === "operations" ? "#e0ad72" : "#d1b288", .35, .1, 1.6);
  const glass = new T.MeshPhysicalMaterial({ color: "#c9d0d5", metalness: 0, roughness: .075, clearcoat: 1, transparent: true, opacity: .12, side: T.DoubleSide, depthWrite: false });
  glass.forceSinglePass = true;
  function mesh(parent: T.Object3D, geo: T.BufferGeometry, m: T.Material, x: number, y: number, z: number) { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = m !== glass; o.receiveShadow = true; parent.add(o); return o; }
  function box(parent: T.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, m: T.Material, radius = .025) { if (Math.min(w, h, d) < .045) radius = 0; const key = `b${w}/${h}/${d}/${radius}`; if (!geometry.has(key)) geometry.set(key, radius ? new RoundedBoxGeometry(w, h, d, 1, Math.min(radius, w / 3, h / 3, d / 3)) : new T.BoxGeometry(w, h, d)); return mesh(parent, geometry.get(key)!, m, x, y, z); }
  function cylinder(parent: T.Object3D, top: number, bottom: number, h: number, x: number, y: number, z: number, m: T.Material, segments = 20) { const key = `c${top}/${bottom}/${h}/${segments}`; if (!geometry.has(key)) geometry.set(key, new T.CylinderGeometry(top, bottom, h, segments)); return mesh(parent, geometry.get(key)!, m, x, y, z); }
  function sphere(parent: T.Object3D, x: number, y: number, z: number, sx: number, sy: number, sz: number, m: T.Material) { if (!geometry.has("sphere")) geometry.set("sphere", new T.SphereGeometry(1, 20, 14)); const o = mesh(parent, geometry.get("sphere")!, m, x, y, z); o.scale.set(sx, sy, sz); return o; }
  function tube(parent: T.Object3D, points: number[][], radius: number, m: T.Material) { const geo = new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p as [number, number, number]))), 16, radius, 6, false); const o = mesh(parent, geo, m, 0, 0, 0); geometry.set(`tube${geometry.size}`, geo); return o; }
  function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) { const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h; draw(canvas.getContext("2d")!); const tx = new T.CanvasTexture(canvas); tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 4; textures.push(tx); return tx; }
  const fabric = canvasTexture(128, 128, c => {
    c.fillStyle = "#888"; c.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const thread = (x + y) % 4 === 0 ? 157 : (x - y + 128) % 4 === 0 ? 105 : 130; c.fillStyle = `rgb(${thread},${thread},${thread})`; c.fillRect(x, y, 1, 1); }
  });
  fabric.colorSpace = T.NoColorSpace; fabric.wrapS = fabric.wrapT = T.RepeatWrapping; fabric.repeat.set(6, 6);
  function batchRigid(anchor: T.Group) {
    const batches = new Map<T.Material, T.Mesh[]>();
    for (const object of anchor.children) if (object instanceof T.Mesh && !Array.isArray(object.material) && !object.material.transparent) { const rows = batches.get(object.material) ?? []; rows.push(object); batches.set(object.material, rows); }
    for (const [m, rows] of batches) {
      if (rows.length < 2) continue;
      const parts = rows.map(object => { object.updateMatrix(); const part = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone(); part.applyMatrix4(object.matrix); return part; });
      const merged = mergeGeometries(parts); parts.forEach(part => part.dispose()); if (!merged) continue;
      rows.forEach(object => object.removeFromParent()); mesh(anchor, merged, m, 0, 0, 0); geometry.set(`rig${geometry.size}`, merged);
    }
  }
  const floorTexture = canvasTexture(512, 512, c => { c.fillStyle = theme.floor; c.fillRect(0, 0, 512, 512); let seed = 318; for (let i = 0; i < 20000; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const x = seed >>> 23; seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const y = seed >>> 23; c.fillStyle = i % 2 ? "#ffffff07" : "#00000007"; c.fillRect(x, y, 1, 1); } c.strokeStyle = theme.floorLine; c.lineWidth = worldTheme === "orbital" ? 4 : 2; c.strokeRect(1, 1, 510, 510); }); floorTexture.wrapS = floorTexture.wrapT = T.RepeatWrapping; floorTexture.repeat.set(14, 9);
  const floorMat = new T.MeshStandardMaterial({ map: floorTexture, roughness: .47, metalness: .2 }); material.set("floor", floorMat);
  function sign(parent: T.Object3D, text: string, x: number, y: number, z: number, width = 2, color = "#b9b9bb", floor = false) { const tx = canvasTexture(1024, 128, c => { c.clearRect(0, 0, 1024, 128); c.fillStyle = color; c.font = '500 48px "Chakra Petch", monospace'; c.textAlign = "center"; c.fillText(text, 512, 82); }); const m = new T.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false, side: T.DoubleSide }); const o = mesh(parent, new T.PlaneGeometry(width, width / 8), m, x, y, z); geometry.set(`sign${geometry.size}`, o.geometry); if (floor) o.rotation.x = -Math.PI / 2; return o; }
  const lighting = new T.HemisphereLight(worldTheme === "orbital" ? "#b8dfff" : "#e2e7ed", worldTheme === "operations" ? "#2f241c" : "#242426", .65); scene.add(lighting);
  const sun = new T.DirectionalLight(worldTheme === "operations" ? "#fff0dd" : worldTheme === "orbital" ? "#d7edff" : "#f1efeb", 2.1); sun.position.set(-8, 19, -6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 18, bottom: -18, near: .5, far: 70 }); sun.shadow.camera.updateProjectionMatrix(); sun.shadow.normalBias = .025; sun.shadow.bias = -.0001; sun.shadow.radius = 2.5; sun.shadow.intensity = .75; scene.add(sun);
  const fill = new T.DirectionalLight("#dadbdf", .65); fill.position.set(10, 8, 13); scene.add(fill);
  const pmrem = new T.PMREMGenerator(renderer), roomEnvironment = new RoomEnvironment(), environment = pmrem.fromScene(roomEnvironment, .04); scene.environment = environment.texture; scene.environmentIntensity = .8; roomEnvironment.dispose(); pmrem.dispose();
  RectAreaLightUniformsLib.init();
  const taskLights: T.RectAreaLight[] = [];
  function taskLight(x: number, z: number, width: number, intensity = 5) { const light = new T.RectAreaLight("#eef2f6", intensity, width, 1.1); light.position.set(x, 3.7, z); light.lookAt(x, 0, z); scene.add(light); taskLights.push(light); }
  taskLight(-9.55, -4.65, 3.3, 7); taskLight(-4.85, -4.65, 3.3, 7); taskLight(-8.7, 3.4, 6.5); taskLight(8.7, 3.65, 6.5); taskLight(8.7, -4.65, 6.5, 4);
  const building = group(scene);
  box(scene, 150, .4, 150, 0, -.9, 0, new T.MeshBasicMaterial({ color: theme.background }), 0);
  box(building, 29.5, .65, 19.7, 0, -.38, 0, graphite, .18);
  box(building, 28.6, .12, 18.8, 0, -.01, 0, floorMat, .02);
  box(building, 29.2, .045, .045, 0, -.24, 9.64, cool, .01);
  box(building, .045, .045, 19, 14.57, -.24, 0, cool, .01);
  // Warm office carpet and laboratory flooring have separate material responses.
  box(building, 9.7, .025, 6.6, -8.1, .065, 5.35, mat("#1b1c1e", .99), 0);
  box(building, 6.4, .025, 6.5, .2, .065, 5.4, mat("#262628", .93), 0);
  for (let x = -14; x <= 14; x += 2) { box(building, .025, .015, 1.1, x, .07, 1, mat("#757578", .8), 0); }
  for (const z of [.25, 1.75]) box(building, 28, .018, .026, 0, .08, z, mat("#8b8b8e", .7), 0);
  // Back facade: dimensional panels, recessed windows, structural steel and vents.
  box(building, 28.5, .95, .3, 0, .5, -9.35, white);
  box(building, 28.5, .22, .42, 0, 4.3, -9.35, graphite);
  for (let x = -14; x <= 14; x += 3.5) {
    box(building, .17, 4.3, .43, x, 2.15, -9.35, steel);
    if (x < 13) {
      box(building, 3.28, 3.12, .07, x + 1.75, 2.57, -9.4, glass);
      for (const y of [1.3, 2.7, 4]) box(building, 3.35, .035, .13, x + 1.75, y, -9.3, steel, 0);
      for (let a = 0; a < 9; a++) box(building, 3.23, .025, .14, x + 1.75, 3.55 + a * .065, -9.27, mat("#65676a", .4, .6), 0);
    }
  }
  // Silhouettes beyond the glazed facade give the room depth rather than a void.
  const glazingTexture = canvasTexture(1024, 512, c => { const gradient = c.createLinearGradient(0, 0, 0, 512); gradient.addColorStop(0, worldTheme === "orbital" ? "#010207" : "#111214"); gradient.addColorStop(.65, worldTheme === "operations" ? "#302921" : worldTheme === "orbital" ? "#07111e" : "#25272a"); gradient.addColorStop(1, worldTheme === "operations" ? "#55483a" : worldTheme === "orbital" ? "#0d2135" : "#3e4043"); c.fillStyle = gradient; c.fillRect(0, 0, 1024, 512); if (worldTheme === "orbital") { let seed = 84; for (let i = 0; i < 210; i++) { seed = Math.imul(seed, 1664525) + 1013904223; const x = (seed >>> 0) % 1024; seed = Math.imul(seed, 1664525) + 1013904223; const y = (seed >>> 0) % 512; const size = i % 19 === 0 ? 3 : 1; c.fillStyle = i % 11 === 0 ? "#b9dcff" : "#ffffff"; c.globalAlpha = .35 + (i % 7) * .08; c.fillRect(x, y, size, size); } c.globalAlpha = 1; } else for (let i = 0; i < 45; i++) { const x = i * 31 % 1024, h = 35 + i * 17 % 120; c.fillStyle = i % 2 ? "#73737325" : "#92929225"; c.fillRect(x, 512 - h, 22, h); } });
  box(building, 28, 3.2, .02, 0, 2.65, -9.5, new T.MeshBasicMaterial({ map: glazingTexture }));
  // Server suite enclosure with a real opening onto the aisle.
  for (const x of [3.6, 14.1]) {
    box(building, .12, 1, 8.7, x, .5, -4.9, white);
    box(building, .055, 2.7, 8.7, x, 2.4, -4.9, glass);
    for (const z of [-9.2, -6.2, -3.2, -.6]) box(building, .12, 3.8, .12, x, 1.9, z, steel);
    box(building, .17, .12, 8.7, x, 3.83, -4.9, graphite);
  }
  for (const [x, w] of [[4.8, 2.5], [12.5, 3.3]]) { box(building, w, 1, .13, x, .5, -.55, white); box(building, w, 2.7, .06, x, 2.4, -.55, glass); box(building, w, .12, .16, x, 3.83, -.55, graphite); }
  box(building, 2.2, .07, .11, 8.5, 3.5, -.55, cool); sign(building, theme.computeLabel, 8.5, 3.16, -.45, 2.1);
  // Low glass partitions leave a readable cutaway from the default camera.
  for (const [x, z, w] of [[-8.2, 2, 9.7], [8.8, 2, 7.5]]) { box(building, w, .4, .13, x, .2, z, graphite); box(building, w, .95, .055, x, .9, z, glass); box(building, w, .04, .08, x, 1.4, z, steel); }
  for (const [x, z, text] of [[-7, -1.25, theme.zones[0]], [8.5, -1.3, theme.zones[1]], [-8.3, 8.5, theme.zones[2]], [.2, 8.5, theme.zones[3]], [8.7, 8.5, theme.zones[4]]] as [number, number, string][]) sign(building, text, x, .09, z, 4.1, "#a2a2a5", true);
  sign(building, `F O R T I F Y   /   ${theme.sceneLabel.split("").join(" ")}`, -4.6, 3.85, -9.12, 9.2, theme.signal);
  // Suspended services, luminaire housings and cable trays.
  for (const x of [-10, -5.4, 5.4, 11.2]) {
    const light = group(building, x, 4.05, -4.8); box(light, 2.5, .12, .48, 0, 0, 0, graphite); box(light, 2.35, .025, .32, 0, -.075, 0, cool);
    for (const z of [-.16, .16]) cylinder(light, .012, .012, .55, 0, .33, z, steel, 8);
  }
  const pipe = cylinder(building, .095, .095, 27.3, 0, 3.7, -8.8, steel); pipe.rotation.z = Math.PI / 2;
  for (let a = 0; a < 12; a++) { box(building, .08, .28, .4, -13 + a * 2.3, 3.8, -8.8, graphite); }
  function chair(parent: T.Object3D, x: number, z: number, rot = 0, scale = 1) {
    const g = group(parent, x, 0, z, rot); g.scale.setScalar(scale);
    cylinder(g, .055, .055, .44, 0, .34, 0, steel); box(g, .6, .1, .59, 0, .63, 0, rubber, .075); box(g, .58, .58, .09, 0, .96, -.25, graphite, .07);
    for (let i = 0; i < 5; i++) { const p = group(g, 0, .13, 0, i * Math.PI * 2 / 5); box(p, .045, .045, .43, 0, 0, .16, steel); const wheel = cylinder(p, .045, .045, .06, 0, -.055, .34, rubber, 12); wheel.rotation.z = Math.PI / 2; }
    for (const side of [-1, 1]) { box(g, .04, .25, .04, side * .34, .78, 0, steel); box(g, .09, .06, .4, side * .34, .92, -.02, rubber); }
    for (let i = 0; i < 6; i++) box(g, .46, .012, .015, 0, .79 + i * .056, -.194, steel, 0);
    return g;
  }
  const screens: { texture: T.CanvasTexture; canvas: HTMLCanvasElement; type: string }[] = [];
  function screen(parent: T.Object3D, x: number, y: number, z: number, type: string, w = 1.12, h = .65) {
    box(parent, w + .08, h + .08, .065, x, y, z, black, .035);
    const canvas = document.createElement("canvas"); canvas.width = 768; canvas.height = 440; const tx = new T.CanvasTexture(canvas); tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 4; textures.push(tx); screens.push({ texture: tx, canvas, type });
    const m = new T.MeshStandardMaterial({ map: tx, emissiveMap: tx, emissive: "#ffffff", emissiveIntensity: .6, roughness: .35, metalness: .05 }); material.set(`screen${screens.length}`, m);
    mesh(parent, new T.PlaneGeometry(w, h), m, x, y, z + .037); geometry.set(`display${geometry.size}`, (parent.children.at(-1) as T.Mesh).geometry);
    cylinder(parent, .027, .027, .23, x, y - h / 2 - .13, z, steel, 8); box(parent, .4, .025, .22, x, y - h / 2 - .25, z + .025, graphite);
  }
  function keyboard(parent: T.Object3D, x: number, y: number, z: number) {
    box(parent, .72, .026, .25, x, y, z, black, .025);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 13; c++) box(parent, .04, .012, .033, x - .31 + c * .051, y + .018, z - .08 + r * .051, mat("#67686b", .7), .003);
    box(parent, .1, .045, .16, x + .56, y + .006, z, graphite, .035);
  }
  function mug(parent: T.Object3D, x: number, y: number, z: number) { cylinder(parent, .072, .061, .15, x, y + .075, z, ceramic); cylinder(parent, .057, .057, .005, x, y + .153, z, mat("#30251e", .6)); const geo = new T.TorusGeometry(.048, .014, 8, 16); geometry.set(`mug${geometry.size}`, geo); mesh(parent, geo, ceramic, x + .075, y + .09, z); }
  function desk(x: number, z: number, type: string, rot = 0) {
    const g = group(building, x, 0, z, rot);
    box(g, 2.8, .09, 1.24, 0, .92, 0, type === "office" ? wood : white, .045);
    for (const side of [-1, 1]) { box(g, .06, .88, .88, side * 1.2, .44, 0, graphite); box(g, .36, .04, 1.1, side * 1.2, .07, 0, steel); }
    box(g, 2.4, .12, .08, 0, .3, -.35, steel);
    screen(g, -.35, 1.57, -.3, type); screen(g, .76, 1.5, -.27, "code", .83, .58);
    keyboard(g, -.33, .986, .48); mug(g, 1.05, .97, .35);
    box(g, .3, .35, .58, -.97, 1.15, -.22, graphite); for (let i = 0; i < 5; i++) box(g, .2, .008, .01, -.97, 1.1 + i * .04, .078, steel, 0);
    box(g, .27, .025, .35, -.96, .992, .34, mat("#aaa9a7", .9)); box(g, .25, .005, .32, -.96, 1.008, .34, ceramic); chair(g, -.33, 1, Math.PI);
    tube(g, [[-.35, 1.1, -.37], [-.35, .55, -.5], [.95, .5, -.5], [1.2, .1, -.55]], .015, rubber);
  }
  desk(-10.6, 3.4, "office"); desk(-6.9, 3.4, "office"); desk(6.7, 3.65, "analysis"); desk(10.5, 3.65, "analysis"); desk(6.4, -4.65, "compute"); desk(11.1, -4.65, "compute");
  // Emitting strips sit over the same working surfaces as the area lights.
  for (const [x, z, w] of [[-8.7, 3.4, 6.5], [8.7, 3.65, 6.5]]) { box(building, w, .075, .32, x, 3.75, z, graphite); box(building, w - .15, .025, .22, x, 3.7, z, cool); }
  const robotArms: T.Group[] = [], instrumentLights: T.Mesh[] = [], fans: T.Group[] = [];
  function labBench(x: number) {
    const g = group(building, x, 0, -4.65);
    box(g, 3.65, .13, 1.55, 0, 1.02, 0, ceramic, .05); box(g, 3.6, .83, 1.36, 0, .51, 0, white);
    for (let i = 0; i < 4; i++) { box(g, .82, .68, .025, -1.36 + i * .91, .54, .7, mat("#3b3d40", .4, .2)); box(g, .24, .024, .045, -1.36 + i * .91, .77, .735, steel); }
    box(g, 3.8, .065, .055, 0, 1.09, .76, cool);
    screen(g, -1.1, 1.7, -.35, "instrument", .91, .6); keyboard(g, -1.05, 1.117, .36);
    box(g, .95, .075, .88, .55, 1.13, -.12, graphite, .025); box(g, .95, .085, .88, .55, 1.82, -.12, graphite, .025);
    box(g, .95, .64, .06, .55, 1.48, -.53, graphite); for (const side of [-1, 1]) box(g, .055, .64, .84, .55 + side * .45, 1.48, -.12, graphite);
    box(g, .81, .54, .025, .55, 1.49, .335, glass); box(g, .73, .025, .035, .55, 1.74, -.4, cool);
    for (const a of [-1, 1]) { box(g, .035, .55, .035, .55 + a * .38, 1.49, .38, steel); cylinder(g, .018, .018, .46, .55 + a * .26, 1.43, -.36, steel, 8); }
    box(g, .07, .2, .045, .85, 1.48, .39, steel); sign(g, theme.equipmentLabel, .55, 1.82, .331, .7, "#dae6e6");
    box(g, .06, .06, .06, .22, 1.11, .36, amber, .012); tube(g, [[.27, 1.63, -.41], [.45, 1.58, -.37], [.55, 1.45, -.14]], .009, rubber);
    cylinder(g, .25, .3, .09, .55, 1.16, .02, steel); cylinder(g, .16, .16, .15, .55, 1.28, .02, ceramic); instrumentLights.push(cylinder(g, .14, .14, .025, .55, 1.38, .02, green));
    const arm = group(g, 1.35, 1.14, -.15); cylinder(arm, .18, .2, .11, 0, .03, 0, steel); const joint = group(arm, 0, .1, 0); sphere(joint, 0, .1, 0, .12, .12, .12, graphite); box(joint, .12, .5, .15, 0, .36, 0, white); const elbow = group(joint, 0, .59, 0); elbow.rotation.z = -1.1; cylinder(elbow, .105, .105, .18, 0, 0, 0, steel).rotation.x = Math.PI / 2; box(elbow, .11, .43, .13, 0, .23, 0, white); box(elbow, .2, .14, .17, 0, .5, 0, graphite); for (const a of [-1, 1]) box(elbow, .025, .12, .04, a * .075, .62, 0, steel); robotArms.push(joint);
    for (let i = 0; i < 5; i++) { const xx = -1.45 + i * .15; cylinder(g, .035, .035, .23, xx, 1.23, -.65, glass, 12); cylinder(g, .033, .033, .08, xx, 1.17, -.65, mat("#96999c", .2, .2), 12); cylinder(g, .041, .041, .025, xx, 1.36, -.65, steel, 12); }
  }
  labBench(-9.55); labBench(-4.85);
  // Perimeter storage, gas cylinders and a dimensional inspection instrument.
  for (let i = 0; i < 5; i++) { const x = -11 + i * 2.2; box(building, 2.06, .95, 1, x, .54, -8.6, white); box(building, 2.15, .08, 1.08, x, 1.05, -8.6, ceramic); for (const a of [-.5, .5]) { box(building, 1, .75, .025, x + a, .55, -8.08, mat("#3b3c3e", .5, .2)); box(building, .3, .025, .05, x + a, .83, -8.04, steel); } }
  for (const x of [-13.4, -12.9]) { cylinder(building, .18, .19, 1.25, x, .74, -7.4, mat("#56595d", .4, .65)); sphere(building, x, 1.37, -7.4, .18, .13, .18, steel); cylinder(building, .035, .035, .17, x, 1.54, -7.4, graphite); tube(building, [[x, 1.62, -7.4], [x + .22, 1.8, -7.3], [x + .4, .9, -7]], .014, rubber); }
  const microscope = group(building, -1.4, 1.1, -8.5); box(microscope, .5, .055, .6, 0, 0, 0, graphite); const neck = box(microscope, .15, .42, .17, .1, .24, -.14, white); neck.rotation.x = .2; cylinder(microscope, .05, .075, .35, 0, .48, .04, graphite).rotation.x = -.4; box(microscope, .3, .04, .24, 0, .18, .1, steel);
  // Racks have independent blades, fans, patch leads, handles and status LEDs.
  const rackLEDs: T.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const rack = group(building, 8 + i * 2.05, 0, -7.45); box(rack, 1.58, 3.25, 1.55, 0, 1.66, 0, black, .06);
    for (const side of [-1, 1]) box(rack, .06, 3.15, .08, side * .72, 1.67, .8, steel);
    for (let j = 0; j < 10; j++) {
      const y = .3 + j * .28; box(rack, 1.36, .23, .08, 0, y, .8, graphite, .012);
      for (let a = 0; a < 11; a++) box(rack, .025, .11, .025, -.58 + a * .082, y, .85, black, 0);
      for (const side of [-1, 1]) box(rack, .035, .09, .055, side * .63, y, .86, steel, .006);
      rackLEDs.push(box(rack, .025, .025, .015, .47, y, .85, j % 3 ? green : cool, .004));
      if (j % 3 === 0) tube(rack, [[.3, y, .87], [.6, y - .1, 1], [.72, y - .35, .98], [.5, y - .4, .87]], .012, mat(i % 2 ? "#8d928e" : "#898c91", .6));
    }
    for (let j = 0; j < 2; j++) { const fan = group(rack, 0, 2.6 + j * .32, -.81); cylinder(fan, .13, .13, .02, 0, 0, 0, steel).rotation.x = Math.PI / 2; for (let a = 0; a < 6; a++) { const blade = box(fan, .19, .045, .02, 0, 0, -.02, black, .01); blade.rotation.z = a * Math.PI / 3; } fans.push(fan); }
    sign(rack, `NODE / 0${i + 1}`, 0, 3.05, .85, .9);
  }
  // Wall data display is drawn from actual project state on every simulation round.
  const wallDisplay = group(building, 1, 0, -9.05); screen(wallDisplay, 0, 2.3, .03, "wall", 3.7, 2.1);
  // Team table, tablets, notebooks and chairs.
  const table = group(building, 0, 0, 5.5); box(table, 2.65, .09, 2.7, 0, .9, 0, wood, .25); box(table, 1.5, .8, 1.3, 0, .43, 0, graphite, .09);
  // Fortify's dotted planet becomes a quiet in-world research display.
  const signal = group(scene, 0, 1.6, 5.5), cloud = new T.BufferGeometry(), dots: number[] = [];
  for (let i = 0; i < 580; i++) { const y = 1 - i / 579 * 2, r = Math.sqrt(1 - y * y), angle = i * 2.399963; dots.push(Math.cos(angle) * r * .52, y * .52, Math.sin(angle) * r * .52); }
  cloud.setAttribute("position", new T.Float32BufferAttribute(dots, 3)); geometry.set("signal-cloud", cloud);
  const dotMaterial = new T.PointsMaterial({ color: theme.signal, size: .019, transparent: true, opacity: .68, depthWrite: false }); signal.add(new T.Points(cloud, dotMaterial));
  const orbitMaterial = new T.MeshBasicMaterial({ color: "#aaaaaa", transparent: true, opacity: .28 });
  for (const tilt of [.5, -1]) { const orbit = mesh(signal, new T.TorusGeometry(.66, .003, 4, 100), orbitMaterial, 0, 0, 0); geometry.set(`orbit${tilt}`, orbit.geometry); orbit.rotation.set(tilt, 0, .35); }
  cylinder(table, .33, .37, .045, 0, .97, 0, black); cylinder(table, .27, .27, .008, 0, .996, 0, cool);
  let scifi = document.documentElement.dataset.theme === "scifi";
  function updateTheme() { scifi = document.documentElement.dataset.theme === "scifi"; signal.visible = scifi || worldTheme === "orbital"; }
  const themeObserver = new MutationObserver(updateTheme); themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] }); updateTheme();
  for (const x of [-2.1, 2.1]) for (const z of [-.9, .9]) chair(table, x, z, x > 0 ? Math.PI / 2 : -Math.PI / 2);
  for (const x of [-.6, .6]) { const tablet = box(table, .46, .025, .63, x, .965, .2, black, .035); tablet.rotation.y = x; box(table, .37, .01, .52, x, .984, .2, mat("#3d4145", .4, .2, .3)).rotation.y = x; mug(table, x, .955, -.55); }
  box(table, .48, .025, .65, .4, .962, .8, ceramic).rotation.y = -.3;
  function plant(x: number, z: number, scale = 1) {
    const g = group(building, x, 0, z); g.scale.setScalar(scale); cylinder(g, .25, .2, .52, 0, .28, 0, mat("#555658", .9)); cylinder(g, .23, .23, .02, 0, .55, 0, mat("#38352d", 1));
    for (let i = 0; i < 9; i++) { const a = i * 2.399, h = 1.1 + (i % 3) * .28, end = [.4 * Math.sin(a), h, .4 * Math.cos(a)]; tube(g, [[0, .5, 0], [end[0] * .4, h * .8, end[2] * .4], end], .012, mat("#3c5143", .95)); const leaf = sphere(g, end[0], h, end[2], .11, .32, .025, mat(i % 2 ? "#6f8972" : "#4c6959", .75)); leaf.rotation.set(.35 * Math.cos(a), a, -.5 * Math.sin(a)); }
  }
  plant(-13.3, 7.8, 1.1); plant(-3.5, 8, .8); plant(13.2, 7.9, 1.15); plant(3.1, -8.5, .8);
  for (let i = 0; i < 3; i++) { const g = group(building, -12.8 + i * .65, 0, 6.9); box(g, .55, 1.1, .7, 0, .57, 0, graphite); for (let j = 0; j < 3; j++) { box(g, .47, .3, .025, 0, .22 + j * .34, .36, steel); box(g, .13, .025, .03, 0, .27 + j * .34, .38, black); } }
  // A trolley, maintenance tools and shipping cases make the space inhabited.
  const cart = group(building, 12.9, 0, -2.4); for (const y of [.25, .85]) box(cart, .72, .055, .95, 0, y, 0, steel); for (const x of [-.3, .3]) for (const z of [-.4, .4]) { cylinder(cart, .02, .02, .95, x, .56, z, steel, 8); sphere(cart, x, .12, z, .065, .065, .05, rubber); } box(cart, .5, .3, .55, 0, .42, 0, graphite); box(cart, .36, .16, .5, 0, .97, 0, mat("#7b7975", .8));
  if (worldTheme === "operations") {
    // A visible delivery rhythm: programme rail, weekly markers and warm pendants.
    const programme = group(building, -1.3, 0, -8.92);
    box(programme, 5.4, 1.28, .08, 0, 2.35, 0, mat("#24201d", .8), .035);
    sign(programme, "ACTIVE PROGRAMME / 90 DAYS", 0, 2.92, .051, 3.8, "#f0e3ce");
    for (let column = 0; column < 4; column++) {
      const x = -1.9 + column * 1.28;
      box(programme, 1.05, .035, .035, x, 2.64, .08, cool, 0);
      for (let item = 0; item < 3; item++) box(programme, .82 - item * .08, .11, .025, x, 2.38 - item * .22, .08, item === 0 ? amber : ceramic, .012);
    }
    for (const x of [-10.5, -7.1, 6.9, 10.4]) {
      cylinder(building, .012, .012, 1.1, x, 4.35, 3.45, steel, 8);
      const shade = cylinder(building, .27, .09, .24, x, 3.73, 3.45, graphite, 20); shade.rotation.x = Math.PI;
      cylinder(building, .16, .16, .018, x, 3.59, 3.45, amber, 16);
    }
    for (const z of [-.2, .2]) box(building, 25.5, .018, .035, 0, .082, z, amber, 0);
  }
  if (worldTheme === "orbital") {
    // Hull ribs, an airlock and a navigation spine distinguish the command deck.
    for (const x of [-13.4, -8.9, -4.45, 0, 4.45, 8.9, 13.4]) {
      box(building, .11, 4.4, .18, x, 2.15, -9.12, steel, .025);
      box(building, .11, .18, 18.1, x, 4.18, 0, steel, .025);
    }
    const airlock = group(building, -14.18, 0, 4.8, Math.PI / 2);
    for (const radius of [1.18, 1.32]) { const geo = new T.TorusGeometry(radius, .055, 8, 48); geometry.set(`airlock${radius}`, geo); mesh(airlock, geo, radius === 1.18 ? cool : steel, 0, 1.55, 0); }
    box(airlock, 1.65, 2.05, .08, 0, 1.55, .04, mat("#0b1119", .5, .5), .55);
    sign(airlock, "AIRLOCK / A", 0, 3.04, .08, 1.5, theme.signal);
    for (let i = 0; i < 12; i++) {
      const z = -8.2 + i * 1.48, bright = i % 3 === 0;
      box(building, .045, .025, 1.05, 0, .085, z, bright ? cool : mat("#48647c", .35, .55, .5), 0);
    }
    const nav = group(building, 0, 1.3, 5.5);
    for (const radius of [.86, 1.05]) { const geo = new T.TorusGeometry(radius, .018, 6, 72); geometry.set(`nav${radius}`, geo); const ring = mesh(nav, geo, radius === .86 ? cool : steel, 0, .4, 0); ring.rotation.x = Math.PI / 2; }
  }
  // Researchers use articulated anatomical rigs with tailored clothing and faces.
  const labels = document.createElement("div"); labels.className = "institute-3d-labels"; host.append(labels);
  const rigs: Rig[] = [], pickTargets: T.Object3D[] = [];
  let resolveEyes!: () => void, rejectEyes!: (error: Error) => void;
  const eyesReady = new Promise<void>((resolve, reject) => { resolveEyes = resolve; rejectEyes = reject; });
  const eyeTexture = new T.TextureLoader().load("/models/institute/brown-eye.png", () => resolveEyes(), undefined, () => rejectEyes(new Error("The character eye material could not load.")));
  eyeTexture.colorSpace = T.SRGBColorSpace; textures.push(eyeTexture);
  const looks = INSTITUTE_CHARACTER_LOOKS;
  for (const [index, person] of PEOPLE.entries()) {
    const look = looks[index], root = group(scene), body = group(root, 0, .88, 0), skin = mat(look.skin, .69), hair = mat(look.hair, .92), cloth = mat(look.shirt, .88), pants = mat(index === 3 ? "#656660" : "#303134", .94);
    cloth.bumpMap = fabric; cloth.bumpScale = .0014; pants.bumpMap = fabric; pants.bumpScale = .001;
    root.userData.personId = person.id;
    // Sculpted torso profile, shoulders and coat skirt; front points along +z.
    const torso = new T.LatheGeometry([[.145, 0], [.164, .06], [.165, .22], [.185, .38], [.193, .43], [.14, .5], [.10, .525], [.062, .543]].map(p => new T.Vector2(p[0], p[1])), 24); const torsoPosition = torso.attributes.position; for (let v = 0; v < torsoPosition.count; v++) { const blend = T.MathUtils.clamp((torsoPosition.getY(v) - .48) / .063, 0, 1); torsoPosition.setZ(v, torsoPosition.getZ(v) - blend * .032); } torso.computeVertexNormals(); geometry.set(`torso${index}`, torso); mesh(body, torso, cloth, 0, 0, 0).scale.z = .62;
    if (look.coat) {
      const skirt = new T.LatheGeometry([[.205, -.24], [.22, -.16], [.18, .09], [.175, .2]].map(p => new T.Vector2(...p as [number, number])), 24); geometry.set(`coat${index}`, skirt); mesh(body, skirt, cloth, 0, 0, 0).scale.z = .64;
      box(body, .012, .55, .015, 0, .11, .128, mat("#a0aaa9", .8), .003);
      for (const side of [-1, 1]) { const lapel = box(body, .095, .22, .012, side * .075, .35, .13, ceramic, .015); lapel.rotation.z = side * -.27; box(body, .11, .1, .015, side * .12, -.06, .13, white, .008); }
      for (let n = 0; n < 4; n++) sphere(body, .03, -.06 + n * .105, .143, .012, .012, .007, steel);
    }
    cylinder(body, .034, .042, .06, 0, .51, -.02, skin);
    const character = createCharacterHead({ ...look, variant: index, skinMaterial: skin, hairMaterial: hair, frameMaterial: graphite, eyeTexture });
    const head = group(body, 0, .67, 0); head.add(character.root); const eyes = character.eyes;
    character.geometries.forEach((g, i) => geometry.set(`head${index}/${i}`, g));
    textures.push(...character.textures);
    // Name badge and fabric seams stay legible in the closer camera views.
    box(body, .08, .11, .012, -.105, .24, .15, ceramic, .009); box(body, .06, .026, .014, -.105, .264, .158, mat("#73777c", .65), .003); box(body, .047, .006, .014, -.105, .23, .159, steel, .002);
    const tablet = group(body, 0, .12, .36); tablet.rotation.x = -.65;
    box(tablet, .25, .32, .018, 0, 0, 0, graphite, .018); box(tablet, .215, .267, .008, 0, 0, .013, mat("#8f9ba5", .35, .1, .18), .008);
    for (let line = 0; line < 5; line++) box(tablet, .15 - line * .015, .006, .004, -.015, .07 - line * .027, .019, cool, .001);
    const arms: T.Group[] = [], elbows: T.Group[] = [], wrists: T.Group[] = [], fingers: T.Group[] = [], legs: T.Group[] = [], knees: T.Group[] = [], ankles: T.Group[] = [];
    for (const side of [-1, 1]) {
      const arm = group(body, side * .198, .4, 0); arm.rotation.z = side * .1;
      sphere(arm, 0, -.035, 0, .064, .075, .061, cloth); cylinder(arm, .061, .049, .245, 0, -.15, 0, cloth);
      const elbow = group(arm, 0, -.285, 0); sphere(elbow, 0, 0, 0, .049, .05, .048, cloth); cylinder(elbow, .047, .036, .235, 0, -.12, 0, cloth); box(elbow, .085, .042, .08, 0, -.235, 0, look.coat ? white : cloth, .015);
      const wrist = group(elbow, 0, -.285, 0);
      sphere(wrist, 0, -.03, .003, .034, .043, .019, skin);
      for (let f = 0; f < 4; f++) {
        const finger = group(wrist, -.024 + f * .016, -.059, .005), length = f === 3 ? .042 : f === 1 ? .061 : .054;
        cylinder(finger, .008, .009, length * .55, 0, -length * .27, 0, skin, 8);
        sphere(finger, 0, -length * .55, .001, .009, .01, .009, skin);
        const tip = cylinder(finger, .007, .008, length * .45, 0, -length * .76, .005, skin, 8); tip.rotation.x = -.22;
        finger.userData.finger = f; fingers.push(finger); batchRigid(finger);
      }
      const thumb = sphere(wrist, side * .033, -.026, .01, .012, .027, .012, skin); thumb.rotation.z = side * .5;
      box(wrist, .035, .009, .025, -.005, .002, -.016, graphite, .004);
      arms.push(arm); elbows.push(elbow); wrists.push(wrist);
      const leg = group(root, side * .105, .88, 0); sphere(leg, 0, -.04, 0, .09, .12, .09, pants); cylinder(leg, .085, .065, .36, 0, -.21, 0, pants);
      const knee = group(leg, 0, -.41, 0); sphere(knee, 0, 0, 0, .067, .065, .069, pants); cylinder(knee, .063, .048, .37, 0, -.205, 0, pants);
      const ankle = group(knee, 0, -.42, 0); box(ankle, .13, .095, .25, 0, 0, .056, rubber, .045); box(ankle, .13, .017, .25, 0, -.047, .056, graphite, .008);
      for (let n = 0; n < 3; n++) box(ankle, .065, .006, .009, 0, .048 - n * .004, .075 + n * .025, mat("#737579", .8), .002);
      legs.push(leg); knees.push(knee); ankles.push(ankle);
    }
    [body, head, ...eyes, ...arms, ...elbows, ...wrists, ...legs, ...knees, ...ankles, tablet].forEach(batchRigid);
    root.scale.setScalar(look.female ? .98 : 1.04);
    const ringGeo = new T.RingGeometry(.37, .4, 48); geometry.set(`ring${index}`, ringGeo); const ring = mesh(root, ringGeo, new T.MeshBasicMaterial({ color: "#eeeeee", transparent: true, opacity: .75, side: T.DoubleSide }), 0, .09, 0); ring.rotation.x = -Math.PI / 2;
    root.traverse(o => { if (o instanceof T.Mesh) { o.userData.personId = person.id; if (o !== ring) pickTargets.push(o); } });
    const a = world.agents.find(a => a.id === person.id)!, p = station(a.location, a.id); root.position.set(p[0], .08, p[1]); root.rotation.y = a.location === "meeting" ? Math.atan2(-p[0], 5.5 - p[1]) : Math.PI;
    const label = document.createElement("button"), displayPerson = themePerson(worldTheme, person.id, person); label.className = "institute-3d-person"; label.textContent = person.name.split(" ")[0]; label.setAttribute("aria-label", `Inspect ${person.name}, ${displayPerson.role}`); label.addEventListener("click", () => options.onSelect(person.id)); labels.append(label);
    rigs.push({ id: person.id, root, body, head, face: character.face, tablet, arms, elbows, wrists, fingers, eyes, legs, knees, ankles, ring, label, destination: p, path: [], location: a.location, phase: index * 1.7, distance: 0, seat: 0 });
  }
  // Keep the authored skeleton for animation/picking, submit opaque character parts
  // together. Fingers and facial fittings no longer require a draw each, per pass.
  const characterBatches: { mesh: T.BatchedMesh; parts: { source: T.Mesh; instance: number; shown: boolean }[] }[] = [];
  for (const rig of rigs) {
    const byMaterial = new Map<T.Material, T.Mesh[]>();
    rig.root.traverse(object => {
      if (!(object instanceof T.Mesh) || Array.isArray(object.material) || object.material.transparent) return;
      const parts = byMaterial.get(object.material) ?? []; parts.push(object); byMaterial.set(object.material, parts);
    });
    for (const [m, parts] of byMaterial) {
      if (parts.length < 2) continue;
      const batch = new T.BatchedMesh(parts.length, parts.reduce((total, part) => total + (part.geometry.index?.count ?? part.geometry.attributes.position.count), 0), 0, m);
      batch.castShadow = true; batch.receiveShadow = true; batch.frustumCulled = false; batch.sortObjects = false; scene.add(batch);
      const entries = parts.map(source => {
        const geometry = source.geometry.index ? source.geometry.toNonIndexed() : source.geometry.clone();
        const instance = batch.addInstance(batch.addGeometry(geometry)); geometry.dispose(); source.visible = false;
        return { source, instance, shown: true };
      });
      characterBatches.push({ mesh: batch, parts: entries });
    }
  }
  function updateCharacterBatches() {
    rigs.forEach(rig => rig.root.updateMatrixWorld(true));
    for (const batch of characterBatches) for (const part of batch.parts) {
      batch.mesh.setMatrixAt(part.instance, part.source.matrixWorld);
      let shown = true, parent = part.source.parent;
      while (parent && parent !== scene) { if (!parent.visible) { shown = false; break; } parent = parent.parent; }
      if (part.shown !== shown) { batch.mesh.setVisibleAt(part.instance, shown); part.shown = shown; }
    }
  }
  updateCharacterBatches();
  const linkMaterials: T.Material[] = [];
  const handoffLinks = Array.from({ length: 3 }, () => {
    const positions = new Float32Array(33 * 3), geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage)); geometry.set(`exchange${geometry.size}`, geo);
    const lineMaterial = new T.LineBasicMaterial({ color: "#c9d0d5", transparent: true, opacity: .35, depthWrite: false });
    const line = new T.Line(geo, lineMaterial); line.frustumCulled = false; scene.add(line);
    const packetMaterial = new T.MeshBasicMaterial({ color: "#e6e9eb", transparent: true, opacity: .8, depthWrite: false });
    const packet = sphere(scene, 0, 0, 0, .055, .055, .055, packetMaterial);
    linkMaterials.push(lineMaterial); return { line, positions, packet, lineMaterial, packetMaterial };
  });
  // Batch stationary fittings by material. Keyboard keys, cabinet hardware and
  // rack vents stay fully modelled while avoiding thousands of draw calls.
  building.updateMatrixWorld(true);
  const moving = new Set<T.Object3D>([...robotArms, ...instrumentLights, ...fans, ...rackLEDs]);
  const batches = new Map<T.Material, { meshes: T.Mesh[]; parts: T.BufferGeometry[] }>();
  building.traverse(o => {
    if (!(o instanceof T.Mesh) || Array.isArray(o.material) || o.material.transparent) return;
    let ancestor: T.Object3D | null = o; while (ancestor && ancestor !== building) { if (moving.has(ancestor)) return; ancestor = ancestor.parent; }
    const batch = batches.get(o.material) ?? { meshes: [], parts: [] }, part = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    part.applyMatrix4(o.matrixWorld); part.deleteAttribute("uv1"); batch.parts.push(part); batch.meshes.push(o); batches.set(o.material, batch);
  });
  for (const [m, batch] of batches) {
    if (batch.meshes.length < 2) { batch.parts.forEach(p => p.dispose()); continue; }
    const merged = mergeGeometries(batch.parts); batch.parts.forEach(p => p.dispose()); if (!merged) continue;
    batch.meshes.forEach(o => o.removeFromParent()); const combined = new T.Mesh(merged, m); combined.castShadow = true; combined.receiveShadow = true; scene.add(combined); geometry.set(`batch${geometry.size}`, merged);
  }
  // Bake static transforms once, retaining every animated hierarchy and its children.
  scene.updateMatrixWorld(true);
  const animatedRoots = new Set<T.Object3D>([...moving, ...rigs.map(rig => rig.root), signal]);
  scene.traverse(object => {
    let ancestor: T.Object3D | null = object;
    while (ancestor) { if (animatedRoots.has(ancestor)) return; ancestor = ancestor.parent; }
    object.updateMatrix(); object.matrixAutoUpdate = false;
  });
  function redrawScreens() {
    for (const { texture, canvas, type } of screens) {
      const c = canvas.getContext("2d")!, w = canvas.width, h = canvas.height;
      c.fillStyle = theme.background; c.fillRect(0, 0, w, h); c.fillStyle = worldTheme === "operations" ? "#2a241f" : worldTheme === "orbital" ? "#0c1622" : "#202123"; c.fillRect(0, 0, w, 46); c.fillStyle = theme.signal; c.font = "16px monospace"; c.fillText(`FORTIFY / ${theme.shortName.toUpperCase()} / ${type.toUpperCase()}  ·  ${String(world.round).padStart(2, "0")}`, 24, 29);
      c.strokeStyle = worldTheme === "orbital" ? "#1f3448" : "#292a2d"; c.lineWidth = 1; for (let i = 1; i < 8; i++) { c.beginPath(); c.moveTo(28, 72 + i * 40); c.lineTo(740, 72 + i * 40); c.stroke(); }
      if (type === "code" || type === "office") {
        const lines = [`${presentation.screenNamespace} / active`, "", `${presentation.screenRevisionKey} = ${world.revision + 1}`, `${presentation.screenComputeKey} = ${availableCompute(world)}`, `${presentation.screenHealthKey} = ${world.health}`, "", present("for hypothesis in approaches:"), present("  evidence = review(measurement)"), present("  publish(evidence, shared_memory)"), "", `round ${world.round} · ${world.focus}`];
        c.font = "18px monospace"; lines.forEach((line, i) => { c.fillStyle = i % 3 ? "#a0a0a5" : "#ccccce"; c.fillText(line, 35, 82 + i * 28); });
      } else {
        c.font = "18px monospace"; c.fillStyle = "#b9b9bd"; c.fillText(present(type === "instrument" ? "SENSOR / CALIBRATION" : type === "compute" ? "COMPUTE CAPACITY" : "RELIABILITY / CURRENT EVIDENCE"), 30, 88);
        c.font = "52px monospace"; const scores = world.projects.map(p => projectScore(world, p)); c.fillText(type === "instrument" ? `${world.health}%` : type === "compute" ? `${availableCompute(world)} NODES` : scores.some(s => s !== null) ? `${Math.round(Math.max(...scores.map(s => s ?? 0)) * 100)}%` : "AWAITING DATA", 30, 160);
        if (type === "instrument" || type === "compute") {
          const ratio = type === "instrument" ? world.health / 100 : availableCompute(world) / 3;
          c.fillStyle = "#282b2e"; c.fillRect(32, 228, 680, 28);
          c.fillStyle = type === "instrument" && world.health < 60 ? "#d1b288" : "#c6d0d5"; c.fillRect(32, 228, 680 * ratio, 28);
          c.fillStyle = "#c1c6cb"; c.font = "18px monospace"; c.fillText(present(type === "instrument" ? world.health < 60 ? "SERVICE REQUIRED / EXPERIMENTS BLOCKED" : world.benchReady ? "TEST BENCH READY" : "BENCH PREPARATION DUE" : world.outageUntil > world.round ? `LIMITED CAPACITY / ${world.outageUntil - world.round} ROUNDS` : "COMPUTE AVAILABLE"), 32, 315);
        } else {
          const trials = world.projects.flatMap(p => p.trials);
          world.projects.forEach((project, j) => {
            c.strokeStyle = j ? "#a6b0aa" : "#d1d1d4"; c.lineWidth = 3; c.beginPath();
            project.trials.forEach((trial, i) => { const x = 36 + trial.round / 24 * 660, y = 352 - trial.reading * 150; i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke();
            project.trials.forEach(trial => { const x = 36 + trial.round / 24 * 660, y = 352 - trial.reading * 150; c.fillStyle = trial.reviewed ? "#e0e5e8" : "#93989f"; c.beginPath(); c.arc(x, y, trial.reviewed ? 5 : 3, 0, Math.PI * 2); c.fill(); });
          });
          c.fillStyle = "#92999f"; c.font = "16px monospace"; c.fillText(trials.length ? "RECORDED EXPERIMENTS / RELIABILITY BY ROUND" : "NO MEASUREMENTS YET", 32, 380);
        }
        c.font = "15px monospace"; c.fillStyle = "#929297"; c.fillText(`GRANT ${world.treasury}   DATASET ${world.revision + 1}   ${world.status.toUpperCase()}`, 30, 408);
      }
      texture.needsUpdate = true;
    }
  }
  redrawScreens();
  // Allocate post-processing targets only when requested. Auto/Balanced draw directly.
  let composer: EffectComposer | null = null, ao: SSAOPass | null = null;
  function prepareEffects() {
    if (composer) return;
    composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
    ao = new SSAOPass(scene, camera, 1, 1, 8); ao.kernelRadius = .65; ao.minDistance = .002; ao.maxDistance = .18; composer.addPass(ao);
    composer.addPass(new UnrealBloomPass(new T.Vector2(1, 1), .16, .45, 1.5)); composer.addPass(new OutputPass());
  }
  function disposeEffects() {
    // SSAOPass r186 omits these two resources from its own dispose method.
    ao?.noiseTexture?.dispose(); ao?.ssaoMaterial.dispose();
    composer?.passes.forEach(pass => pass.dispose()); composer?.dispose(); composer = null; ao = null;
  }
  function resize() {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderWidth = w; renderHeight = h;
    const dpr = graphicsPixelRatio(window.devicePixelRatio, quality, adaptiveScale);
    renderer.setPixelRatio(dpr); renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    if (composer) { composer.setPixelRatio(dpr); composer.setSize(w, h); ao?.setSize(Math.max(1, Math.floor(w * dpr * .5)), Math.max(1, Math.floor(h * dpr * .5))); }
    renderer.shadowMap.needsUpdate = true;
  }
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  const raycaster = new T.Raycaster(), pointer = new T.Vector2(); let down: [number, number] | null = null;
  function onPointerDown(e: PointerEvent) { down = [e.clientX, e.clientY]; }
  function onPointerUp(e: PointerEvent) { if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return; down = null; const r = renderer.domElement.getBoundingClientRect(); pointer.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects(pickTargets)[0]; if (hit) options.onSelect(hit.object.userData.personId); }
  function onControlStart() { cameraTween = 0; follow = false; teamCamera = false; cinematic = false; }
  function onContextLost(e: Event) { e.preventDefault(); options.onError(present("The 3D view lost its graphics connection. Reload the view to reconnect; your research session is saved.")); }
  let warmed = false;
  function resume() { if (!disposed && warmed && !animation && (firstFrame || (!hidden && visible))) { previous = 0; budgetStarted = 0; budgetFrames = 0; budgetTime = 0; lastProfile = 0; animation = requestAnimationFrame(animate); host.dataset.rendering = "active"; } }
  function suspend() { cancelAnimationFrame(animation); animation = 0; host.dataset.rendering = "suspended"; }
  function visibility() { hidden = document.hidden; if (hidden) suspend(); else resume(); }
  const intersection = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? true; if (visible) resume(); else if (!firstFrame) suspend(); }, { rootMargin: "100px" }); intersection.observe(host);
  renderer.domElement.addEventListener("pointerdown", onPointerDown); renderer.domElement.addEventListener("pointerup", onPointerUp); renderer.domElement.addEventListener("webglcontextlost", onContextLost); controls.addEventListener("start", onControlStart); document.addEventListener("visibilitychange", visibility);
  function followGoals() {
    const rig = rigs.find(r => r.id === selected)!;
    targetGoal.copy(rig.root.position).add(positionScratch.set(0, 1, 0));
    const systems = rig.location === "compute" || rig.location === "maintenance";
    eyeGoal.copy(targetGoal).add(positionScratch.set(systems ? -2.6 : 3.2, systems ? 1.8 : 1.7, systems ? 2.6 : 4.8));
    if (systems) { eyeGoal.x = T.MathUtils.clamp(eyeGoal.x, 4.4, 13.2); eyeGoal.z = T.MathUtils.clamp(eyeGoal.z, -8.3, -1.3); }
  }
  function setView(next: CameraView) {
    view = next; follow = next === "follow"; teamCamera = next === "collaboration"; cinematic = false; cameraTween = 1;
    if (next === "follow") followGoals();
    else if (teamCamera) teamGoals();
    else { const preset = CAMERA_VIEWS[next]; eyeGoal.set(preset.eye[0], preset.eye[1], preset.eye[2]); targetGoal.set(preset.target[0], preset.target[1], preset.target[2]); }
  }
  function teamGoals() {
    const partner = partners.get(selected);
    if (!partner) { const preset = CAMERA_VIEWS.collaboration; eyeGoal.set(...preset.eye); targetGoal.set(...preset.target); return; }
    const from = rigs.find(rig => rig.id === selected)!, to = rigs.find(rig => rig.id === partner)!;
    targetGoal.copy(from.root.position).add(to.root.position).multiplyScalar(.5); targetGoal.y = 1.15;
    const spread = Math.max(0, from.root.position.distanceTo(to.root.position) - 2) * .45;
    const portrait = Math.max(1, .85 / camera.aspect);
    eyeGoal.copy(targetGoal).add(positionScratch.set(-3 - spread * .5, 1.8 + spread * .55, 4.1 + spread).multiplyScalar(portrait));
  }
  function animate(now: number) {
    animation = 0;
    if (disposed || (!firstFrame && (hidden || !visible))) { if (!disposed) host.dataset.rendering = "suspended"; return; }
    const frameStart = performance.now(); renderer.info.reset();
    const updateLabels = firstFrame || now - labelUpdated >= 1000 / 30;
    if (updateLabels) labelUpdated = now;
    const cameraDt = Math.min(previous ? (now - previous) / 1000 : 0, .5), dt = Math.min(cameraDt, .05); previous = now; elapsed += dt;
    if (scifi && !reduced) { signal.rotation.y += dt * .11; signal.position.y = 1.6 + Math.sin(elapsed * .55) * .025; }
    for (const rig of rigs) {
      const a = world.agents.find(a => a.id === rig.id)!, p = rig.root.position, walking = rig.path.length > 0;
      const partnerId = partners.get(rig.id), partner = rigs.find(other => other.id === partnerId);
      if (walking) {
        const dest = rig.path[0], dx = dest[0] - p.x, dz = dest[1] - p.z, distance = Math.hypot(dx, dz), stride = 2.4 * dt;
        if (distance <= stride) { p.x = dest[0]; p.z = dest[1]; rig.path.shift(); }
        else { p.x += dx / distance * stride; p.z += dz / distance * stride; }
        rig.distance += Math.min(distance, stride);
        const angle = Math.atan2(dx, dz), delta = Math.atan2(Math.sin(angle - rig.root.rotation.y), Math.cos(angle - rig.root.rotation.y)); rig.root.rotation.y += delta * Math.min(1, dt * 9);
      } else {
        let angle = Math.PI;
        if (partner && !partner.path.length && (rig.location === "meeting" || !workPose(a, false, world).seated)) angle = Math.atan2(partner.root.position.x - p.x, partner.root.position.z - p.z);
        else if (rig.location === "meeting") angle = Math.atan2(-p.x, 5.5 - p.z);
        else if (rig.location === "workbench" && p.z < -5) angle = 0;
        else if (rig.location === "analysis" && (rig.id === "mira" || rig.id === "ivo")) { const analyst = station("analysis", "ada"); angle = Math.atan2(analyst[0] - p.x, analyst[1] - p.z); }
        const delta = Math.atan2(Math.sin(angle - rig.root.rotation.y), Math.cos(angle - rig.root.rotation.y)); rig.root.rotation.y += delta * Math.min(1, dt * 4);
      }
      const phase = walking ? rig.distance / 1.05 * Math.PI * 2 : elapsed * 2.3 + rig.phase, motion = reduced ? 0 : 1;
      const basePose = workPose(a, walking, world);
      const pose = partner && !walking && !partner.path.length && a.location === "analysis" ? { ...basePose, kind: "discuss" as const } : basePose;
      const blend = reduced ? 1 : 1 - Math.exp(-dt * 8);
      rig.seat = T.MathUtils.lerp(rig.seat, pose.seated ? 1 : 0, blend);
      const hipHeight = .88 - (walking ? Math.abs(Math.cos(phase)) * .042 : 0);
      rig.body.position.y = hipHeight - rig.seat * .17 + (walking ? 0 : Math.sin(phase) * .003) * motion;
      const gaze = partner && !walking && !partner.path.length ? Math.atan2(Math.sin(Math.atan2(partner.root.position.x - p.x, partner.root.position.z - p.z) - rig.root.rotation.y), Math.cos(Math.atan2(partner.root.position.x - p.x, partner.root.position.z - p.z) - rig.root.rotation.y)) : 0;
      rig.body.rotation.y = T.MathUtils.lerp(rig.body.rotation.y, pose.seated ? T.MathUtils.clamp(gaze * .4, -.4, .4) : walking ? Math.sin(phase) * .025 * motion : 0, blend);
      rig.head.rotation.y = T.MathUtils.lerp(rig.head.rotation.y, partner && !walking ? T.MathUtils.clamp(gaze - rig.body.rotation.y, -.7, .7) : Math.sin(elapsed * .65 + rig.phase) * .045 * motion, blend);
      rig.head.rotation.x = pose.kind === "read" ? .25 : pose.kind === "type" ? .11 : pose.kind === "bench" || pose.kind === "repair" ? .18 : -.025;
      rig.body.rotation.x = T.MathUtils.lerp(rig.body.rotation.x, pose.kind === "repair" ? .2 : pose.kind === "bench" ? .08 : pose.kind === "type" ? .035 : 0, blend);
      rig.tablet.visible = pose.kind === "read";
      const blinkPhase = (elapsed / 4.7 + rig.phase * .13) % 1, blink = reduced || blinkPhase < .965 ? 1 : 1 - Math.sin((blinkPhase - .965) / .035 * Math.PI) * .96;
      if (rig.face.morphTargetInfluences) rig.face.morphTargetInfluences[0] = 1 - blink;
      if (updateLabels) {
        if (rig.label.dataset.pose !== pose.kind) rig.label.dataset.pose = pose.kind;
        if (rig.label.dataset.seated !== String(pose.seated)) rig.label.dataset.seated = String(pose.seated);
        if (rig.label.dataset.location !== a.location) rig.label.dataset.location = a.location;
        const nextPartner = partner && !walking ? partner.id : "";
        if (rig.label.dataset.partner !== nextPartner) rig.label.dataset.partner = nextPartner;
      }
      for (let i = 0; i < 2; i++) {
        const s = i ? -1 : 1, beat = Math.sin(phase * 1.8 + i * 1.9) * motion;
        const foot = footCycle(rig.distance, i), stridePose = limbAngles(hipHeight - .052 - foot.lift, foot.forward, .41, .42);
        rig.legs[i].position.y = hipHeight - rig.seat * .23;
        rig.legs[i].rotation.x = walking && !reduced ? stridePose.root : -1.2 * rig.seat;
        rig.knees[i].rotation.x = walking && !reduced ? stridePose.joint : .025 + rig.seat * 1.175;
        rig.knees[i].scale.y = 1 + rig.seat * .08;
        rig.ankles[i].rotation.x = walking ? -rig.legs[i].rotation.x - rig.knees[i].rotation.x : .025;
        let arm = -.1, elbow = -.2, spread = s * .1;
        if (walking) { arm = -Math.sin(phase) * .32 * s * motion; elbow = -.17; }
        else if (pose.kind === "read") { arm = -.4; elbow = -1.25; spread = s * -.04; }
        else if (pose.kind === "type") { arm = -.65 + beat * .022; elbow = -.96 + beat * .035; spread = s * -.08; }
        else if (pose.kind === "bench") { arm = -.7 + beat * .07; elbow = -.93 + beat * .15; spread = s * .04; }
        else if (pose.kind === "repair") { arm = (i ? -1.1 : -.8) + beat * .05; elbow = -.65 + beat * .1; }
        else if (pose.kind === "discuss") { arm = i ? -.35 + beat * .12 : -.1; elbow = i ? -1 + beat * .18 : -.4; spread = i ? -.18 : -.08; }
        const reach = walking ? null : handReach(pose.kind, i, elapsed + rig.phase, reduced);
        if (reach) {
          const surface = pose.kind === "type" && pose.seated ? 1.04 : pose.kind === "bench" ? 1.18 : null;
          const down = surface === null ? reach.down : rig.body.position.y + .4 - (surface - p.y) / rig.root.scale.y;
          const angles = limbAngles(down, reach.forward, .285, .285, -1); arm = angles.root; elbow = angles.joint;
        }
        rig.arms[i].rotation.x = T.MathUtils.lerp(rig.arms[i].rotation.x, arm, blend);
        rig.arms[i].rotation.z = T.MathUtils.lerp(rig.arms[i].rotation.z, spread, blend);
        rig.elbows[i].rotation.x = T.MathUtils.lerp(rig.elbows[i].rotation.x, elbow, blend);
        rig.wrists[i].rotation.x = T.MathUtils.lerp(rig.wrists[i].rotation.x, reach ? reach.wrist - rig.arms[i].rotation.x - rig.elbows[i].rotation.x : .05, blend);
      }
      rig.fingers.forEach((finger, i) => { const curl = pose.kind === "type" ? .35 + Math.sin(elapsed * 9 + i) * .08 * motion : pose.kind === "read" ? .55 : pose.kind === "repair" ? .6 : .16; finger.rotation.x = T.MathUtils.lerp(finger.rotation.x, pose.kind === "type" ? curl : -curl, blend); });
      rig.ring.visible = rig.id === selected;
      if (!updateLabels) continue;
      if (rig.label.classList.contains("selected") !== (rig.id === selected)) rig.label.classList.toggle("selected", rig.id === selected);
      if (rig.label.getAttribute("aria-pressed") !== String(rig.id === selected)) rig.label.setAttribute("aria-pressed", String(rig.id === selected));
      const title = `${PEOPLE.find(p => p.id === rig.id)!.name} · ${present(a.activity)}${walking ? " · walking to station" : ""}`; if (rig.label.title !== title) rig.label.title = title;
      projection.copy(p).add(positionScratch.set(0, 1.94 - rig.seat * .17, 0)).project(camera); const visible = projection.z < 1 && projection.z > -1 && Math.abs(projection.x) < 1 && Math.abs(projection.y) < 1;
      if (rig.label.hidden === visible) rig.label.hidden = !visible; if (visible) rig.label.style.transform = `translate(${((projection.x * .5 + .5) * renderWidth).toFixed(1)}px,${((-projection.y * .5 + .5) * renderHeight).toFixed(1)}px) translate(-50%,-100%)`;
    }
    updateCharacterBatches();
    const age = elapsed - exchangeStarted;
    if (host.dataset.exchangeCount !== String(exchanges.length)) host.dataset.exchangeCount = String(exchanges.length);
    if (host.dataset.visibleLinks !== String(exchangesVisible ? highlighted.length : 0)) host.dataset.visibleLinks = String(exchangesVisible ? highlighted.length : 0);
    handoffLinks.forEach((link, index) => {
      const exchange = highlighted[index]; link.line.visible = link.packet.visible = !!exchange && exchangesVisible;
      if (!exchange || !exchangesVisible) return;
      const from = rigs.find(rig => rig.id === exchange.from)!, to = rigs.find(rig => rig.id === exchange.to)!;
      const rise = .45 + Math.min(from.root.position.distanceTo(to.root.position) * .12, 1.6);
      for (let i = 0; i <= 32; i++) { const t = i / 32; link.positions[i * 3] = T.MathUtils.lerp(from.root.position.x, to.root.position.x, t); link.positions[i * 3 + 1] = 1.25 + Math.sin(t * Math.PI) * rise; link.positions[i * 3 + 2] = T.MathUtils.lerp(from.root.position.z, to.root.position.z, t); }
      link.line.geometry.attributes.position.needsUpdate = true;
      const t = reduced ? 1 : Math.min(1, Math.max(0, (age - index * .25) / 2.6)), segment = Math.min(31, Math.floor(t * 32)), amount = t * 32 - segment;
      link.packet.position.set(T.MathUtils.lerp(link.positions[segment * 3], link.positions[(segment + 1) * 3], amount), T.MathUtils.lerp(link.positions[segment * 3 + 1], link.positions[(segment + 1) * 3 + 1], amount), T.MathUtils.lerp(link.positions[segment * 3 + 2], link.positions[(segment + 1) * 3 + 2], amount));
      link.packet.visible = !reduced && age < 4.5;
      link.lineMaterial.opacity = age < 4.5 ? .35 : .14;
    });
    const activeExperiment = world.agents.some(a => a.location === "workbench" && workPose(a, false, world).kind === "bench") && world.status === "active" && world.health >= 60;
    robotArms.forEach((arm, i) => { arm.rotation.y = reduced ? 0 : Math.sin(elapsed * .65 + i * 2) * (activeExperiment ? .5 : .14); arm.rotation.z = -.4 + (reduced ? 0 : Math.sin(elapsed * .8 + i) * .18); });
    instrumentLights.forEach(o => { o.material = world.health < 70 ? amber : green; });
    taskLights.forEach((light, i) => { light.intensity = i < 2 ? world.health < 60 ? 3.5 : 7 : i === 4 && world.outageUntil > world.round ? 1.2 : i === 4 ? 4 : 5; });
    rackLEDs.forEach((o, i) => { o.material = world.outageUntil > world.round && i > 9 ? black : i % 7 === Math.floor(elapsed * 3) % 7 ? cool : green; });
    if (!reduced) fans.forEach(f => { f.rotation.z += dt * 4; });
    if (follow) { followGoals(); cameraTween = 1; }
    if (teamCamera) { teamGoals(); cameraTween = 1; }
    if (cameraTween) { const amount = reduced ? 1 : 1 - Math.exp(-cameraDt * 3.3); camera.position.lerp(eyeGoal, amount); controls.target.lerp(targetGoal, amount); if (!follow && camera.position.distanceTo(eyeGoal) < .02) cameraTween = 0; }
    controls.autoRotate = cinematic && !reduced; controls.autoRotateSpeed = .35; controls.update();
    // Camera motion does not change a world-space shadow. Resting people need far
    // fewer updates than walking people, even while the camera orbits smoothly.
    const shadowInterval = rigs.some(rig => rig.path.length) ? 50 : quality === "high" ? 100 : 200;
    if (now - shadowUpdated >= shadowInterval || firstFrame) { renderer.shadowMap.needsUpdate = true; shadowUpdated = now; }
    if (quality === "high" && composer) composer.render(); else renderer.render(scene, camera);
    if (profiling) {
      if (lastProfile) samples.push({ interval: now - lastProfile, cpu: performance.now() - frameStart, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles });
      lastProfile = now;
      if (samples.length > 600) samples.shift();
      if (samples.length % 30 === 0) host.dataset.performance = JSON.stringify({ quality, width: renderer.domElement.width, height: renderer.domElement.height, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, programs: renderer.info.programs?.length, samples });
    }
    if (firstFrame) { firstFrame = false; options.onReady(); }
    if (quality === "auto") {
      if (budgetStarted && previous) { budgetFrames++; budgetTime += cameraDt * 1000; }
      else budgetStarted = now;
      if (now - budgetStarted >= 2500 && budgetFrames >= 30) {
        const nextScale = resolutionAfterWindow(adaptiveScale, budgetTime / budgetFrames);
        if (nextScale !== adaptiveScale) { adaptiveScale = nextScale; resize(); }
        budgetStarted = now; budgetFrames = 0; budgetTime = 0;
      }
    }
    if (!hidden && visible) animation = requestAnimationFrame(animate); else host.dataset.rendering = "suspended";
  }
  // Keep the loading state until a frame is drawn; warm material programs asynchronously.
  Promise.all([renderer.compileAsync(scene, camera), eyesReady]).then(() => { if (!disposed) { warmed = true; resume(); } }).catch(() => { if (!disposed) options.onError("The 3D materials could not load. Reload the view to try again."); });
  return {
    update(next: World, nextSelected: PersonId) {
      const reset = next.id !== world.id || next.round < world.round; const changed = next !== world; world = next; selected = nextSelected;
      if (changed) partners = new Map(PEOPLE.map(person => [person.id, conversationPartner(next, person.id)]));
      const nextExchanges = currentExchanges(next);
      if (reset || nextExchanges.map(e => e.id).join() !== exchanges.map(e => e.id).join()) exchangeStarted = elapsed;
      exchanges = nextExchanges;
      highlighted = focusExchanges(next, nextSelected);
      for (const rig of rigs) { const a = next.agents.find(a => a.id === rig.id)!, p = station(a.location, a.id); if (reset || reduced) { rig.path = []; rig.root.position.set(p[0], .08, p[1]); } else if (p[0] !== rig.destination[0] || p[1] !== rig.destination[1]) rig.path = route([rig.root.position.x, rig.root.position.z], p); rig.location = a.location; rig.destination = p; }
      if (changed) redrawScreens();
    },
    setView,
    setExchanges(value: boolean) { exchangesVisible = value; },
    setCinematic(value: boolean) { cinematic = value; follow = false; teamCamera = false; cameraTween = 0; },
    setQuality(value: string) { if (value !== "auto" && value !== "high" && value !== "balanced") return; quality = value; adaptiveScale = 1; budgetStarted = 0; budgetFrames = 0; budgetTime = 0; if (value === "high") prepareEffects(); else disposeEffects(); resize(); },
    dispose() {
      disposed = true; cancelAnimationFrame(animation); observer.disconnect(); intersection.disconnect(); themeObserver.disconnect(); dotMaterial.dispose(); orbitMaterial.dispose(); linkMaterials.forEach(m => m.dispose()); controls.dispose(); document.removeEventListener("visibilitychange", visibility); renderer.domElement.removeEventListener("pointerdown", onPointerDown); renderer.domElement.removeEventListener("pointerup", onPointerUp); renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      scene.traverse(o => { if (o instanceof T.Mesh) { o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => m.dispose()); } }); geometry.forEach(g => g.dispose()); material.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); characterBatches.forEach(batch => batch.mesh.dispose()); glass.dispose(); environment.dispose(); disposeEffects(); renderer.dispose(); renderer.domElement.remove(); labels.remove();
    },
  };
}
