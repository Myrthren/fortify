import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { PEOPLE, availableCompute, projectScore, type World, type PersonId, type Location } from "./research-institute";
import { station, route, CAMERA_VIEWS, type CameraView, type Point } from "./institute-space";

type Rig = { id: PersonId; root: T.Group; body: T.Group; head: T.Group; arms: T.Group[]; elbows: T.Group[]; legs: T.Group[]; knees: T.Group[]; destination: Point; path: Point[]; location: Location; phase: number; ring: T.Mesh; label: HTMLButtonElement };
type Options = { world: World; selected: PersonId; onSelect: (id: PersonId) => void; onReady: () => void; onError: (message: string) => void };

// Authored geometry and procedural materials: no remote models, trackers or asset requests.
export function createInstituteScene(host: HTMLElement, options: Options) {
  let world = options.world, selected = options.selected, disposed = false, animation = 0, previous = 0, elapsed = 0, hidden = document.hidden;
  let view: CameraView = "overview", follow = false, cinematic = false, quality = "high", cameraTween = 0;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scene = new T.Scene(); scene.background = new T.Color("#070707"); scene.fog = new T.FogExp2("#070707", .008);
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.domElement.setAttribute("aria-label", "Interactive 3D Research Institute. Drag to orbit, scroll to zoom. Select a researcher in the scene or the people controls.");
  renderer.domElement.setAttribute("role", "img"); renderer.domElement.tabIndex = 0; host.prepend(renderer.domElement);
  const camera = new T.PerspectiveCamera(40, 1, .1, 160); camera.position.set(24, 24, 29);
  const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, 0, 0); controls.enableDamping = true; controls.dampingFactor = .065;
  controls.minDistance = 3; controls.maxDistance = 56; controls.maxPolarAngle = Math.PI / 2.07; controls.minPolarAngle = .15; controls.zoomSpeed = .75; controls.panSpeed = .6;
  const eyeGoal = camera.position.clone(), targetGoal = controls.target.clone(), positionScratch = new T.Vector3(), projection = new T.Vector3();
  const geometry = new Map<string, T.BufferGeometry>(), material = new Map<string, T.MeshStandardMaterial>(); const textures: T.Texture[] = [];
  const group = (parent: T.Object3D, x = 0, y = 0, z = 0, rotation = 0) => { const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = rotation; parent.add(g); return g; };
  function mat(color: string, roughness = .6, metalness = 0, glow = 0) { const key = `${color}/${roughness}/${metalness}/${glow}`; if (!material.has(key)) material.set(key, new T.MeshStandardMaterial({ color, roughness, metalness, emissive: color, emissiveIntensity: glow })); return material.get(key)!; }
  const white = mat("#37393c", .43, .32), ceramic = mat("#67696c", .32, .27), graphite = mat("#1c1d1f", .43, .55), black = mat("#101112", .51, .2), steel = mat("#6b6d70", .3, .85), rubber = mat("#101011", .88), wood = mat("#353332", .63), cool = mat("#e3e3e3", .22, .3, 1.8), green = mat("#a3b5aa", .3, .15, 1.6), amber = mat("#d1b288", .35, .1, 1.6);
  const glass = new T.MeshPhysicalMaterial({ color: "#adadaf", metalness: .15, roughness: .12, transparent: true, opacity: .075, side: T.DoubleSide, depthWrite: false });
  function mesh(parent: T.Object3D, geo: T.BufferGeometry, m: T.Material, x: number, y: number, z: number) { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = m !== glass; o.receiveShadow = true; parent.add(o); return o; }
  function box(parent: T.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, m: T.Material, radius = .025) { const key = `b${w}/${h}/${d}/${radius}`; if (!geometry.has(key)) geometry.set(key, radius ? new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3)) : new T.BoxGeometry(w, h, d)); return mesh(parent, geometry.get(key)!, m, x, y, z); }
  function cylinder(parent: T.Object3D, top: number, bottom: number, h: number, x: number, y: number, z: number, m: T.Material, segments = 20) { const key = `c${top}/${bottom}/${h}/${segments}`; if (!geometry.has(key)) geometry.set(key, new T.CylinderGeometry(top, bottom, h, segments)); return mesh(parent, geometry.get(key)!, m, x, y, z); }
  function sphere(parent: T.Object3D, x: number, y: number, z: number, sx: number, sy: number, sz: number, m: T.Material) { if (!geometry.has("sphere")) geometry.set("sphere", new T.SphereGeometry(1, 20, 14)); const o = mesh(parent, geometry.get("sphere")!, m, x, y, z); o.scale.set(sx, sy, sz); return o; }
  function tube(parent: T.Object3D, points: number[][], radius: number, m: T.Material) { const geo = new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p as [number, number, number]))), 16, radius, 6, false); const o = mesh(parent, geo, m, 0, 0, 0); geometry.set(`tube${geometry.size}`, geo); return o; }
  function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) { const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h; draw(canvas.getContext("2d")!); const tx = new T.CanvasTexture(canvas); tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 4; textures.push(tx); return tx; }
  const floorTexture = canvasTexture(512, 512, c => { c.fillStyle = "#27282b"; c.fillRect(0, 0, 512, 512); let seed = 318; for (let i = 0; i < 20000; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const x = seed >>> 23; seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const y = seed >>> 23; c.fillStyle = i % 2 ? "#ffffff07" : "#00000007"; c.fillRect(x, y, 1, 1); } c.strokeStyle = "#121214"; c.lineWidth = 2; c.strokeRect(1, 1, 510, 510); }); floorTexture.wrapS = floorTexture.wrapT = T.RepeatWrapping; floorTexture.repeat.set(14, 9);
  const floorMat = new T.MeshStandardMaterial({ map: floorTexture, roughness: .47, metalness: .2 }); material.set("floor", floorMat);
  function sign(parent: T.Object3D, text: string, x: number, y: number, z: number, width = 2, color = "#b9b9bb", floor = false) { const tx = canvasTexture(1024, 128, c => { c.clearRect(0, 0, 1024, 128); c.fillStyle = color; c.font = '500 48px "Chakra Petch", monospace'; c.textAlign = "center"; c.fillText(text, 512, 82); }); const m = new T.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false, side: T.DoubleSide }); const o = mesh(parent, new T.PlaneGeometry(width, width / 8), m, x, y, z); geometry.set(`sign${geometry.size}`, o.geometry); if (floor) o.rotation.x = -Math.PI / 2; return o; }
  const lighting = new T.HemisphereLight("#dedede", "#252527", 1.65); scene.add(lighting);
  const sun = new T.DirectionalLight("#f1efeb", 3.6); sun.position.set(-8, 19, -6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 18, bottom: -18, near: .5, far: 70 }); sun.shadow.normalBias = .035; sun.shadow.bias = -.00015; scene.add(sun);
  const fill = new T.DirectionalLight("#dadbdf", 1.4); fill.position.set(10, 8, 13); scene.add(fill);
  const pmrem = new T.PMREMGenerator(renderer), roomEnvironment = new RoomEnvironment(), environment = pmrem.fromScene(roomEnvironment, .04); scene.environment = environment.texture; scene.environmentIntensity = .55; roomEnvironment.dispose(); pmrem.dispose();
  const building = group(scene);
  box(scene, 150, .4, 150, 0, -.9, 0, new T.MeshBasicMaterial({ color: "#070707" }), 0);
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
  const glazingTexture = canvasTexture(1024, 512, c => { const gradient = c.createLinearGradient(0, 0, 0, 512); gradient.addColorStop(0, "#111214"); gradient.addColorStop(.65, "#25272a"); gradient.addColorStop(1, "#3e4043"); c.fillStyle = gradient; c.fillRect(0, 0, 1024, 512); for (let i = 0; i < 45; i++) { const x = i * 31 % 1024, h = 35 + i * 17 % 120; c.fillStyle = i % 2 ? "#73737325" : "#92929225"; c.fillRect(x, 512 - h, 22, h); } });
  box(building, 28, 3.2, .02, 0, 2.65, -9.5, new T.MeshBasicMaterial({ map: glazingTexture }));
  // Server suite enclosure with a real opening onto the aisle.
  for (const x of [3.6, 14.1]) {
    box(building, .12, 1, 8.7, x, .5, -4.9, white);
    box(building, .055, 2.7, 8.7, x, 2.4, -4.9, glass);
    for (const z of [-9.2, -6.2, -3.2, -.6]) box(building, .12, 3.8, .12, x, 1.9, z, steel);
    box(building, .17, .12, 8.7, x, 3.83, -4.9, graphite);
  }
  for (const [x, w] of [[4.8, 2.5], [12.5, 3.3]]) { box(building, w, 1, .13, x, .5, -.55, white); box(building, w, 2.7, .06, x, 2.4, -.55, glass); box(building, w, .12, .16, x, 3.83, -.55, graphite); }
  box(building, 2.2, .07, .11, 8.5, 3.5, -.55, cool); sign(building, "COMPUTE / 03", 8.5, 3.16, -.45, 2.1);
  // Low glass partitions leave a readable cutaway from the default camera.
  for (const [x, z, w] of [[-8.2, 2, 9.7], [8.8, 2, 7.5]]) { box(building, w, .4, .13, x, .2, z, graphite); box(building, w, .95, .055, x, .9, z, glass); box(building, w, .04, .08, x, 1.4, z, steel); }
  for (const [x, z, text] of [[-7, -1.25, "01 / EXPERIMENTAL LAB"], [8.5, -1.3, "03 / COMPUTE"], [-8.3, 8.5, "02 / RESEARCH OFFICE"], [.2, 8.5, "COLLABORATION"], [8.7, 8.5, "04 / EVIDENCE & ANALYSIS"]] as [number, number, string][]) sign(building, text, x, .09, z, 4.1, "#a2a2a5", true);
  sign(building, "F O R T I F Y   /   R E S E A R C H   S Y S T E M S", -4.6, 3.85, -9.12, 9.2, "#e3e3e3");
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
    keyboard(g, -.33, .986, .32); mug(g, 1.05, .97, .35);
    box(g, .3, .35, .58, -.97, 1.15, -.22, graphite); for (let i = 0; i < 5; i++) box(g, .2, .008, .01, -.97, 1.1 + i * .04, .078, steel, 0);
    box(g, .27, .025, .35, -.96, .992, .34, mat("#aaa9a7", .9)); box(g, .25, .005, .32, -.96, 1.008, .34, ceramic); chair(g, .3, 1.3, Math.PI);
    tube(g, [[-.35, 1.1, -.37], [-.35, .55, -.5], [.95, .5, -.5], [1.2, .1, -.55]], .015, rubber);
  }
  desk(-10.6, 3.4, "office"); desk(-6.9, 3.4, "office"); desk(6.7, 3.65, "analysis"); desk(10.5, 3.65, "analysis"); desk(6.4, -4.65, "compute");
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
    box(g, .07, .2, .045, .85, 1.48, .39, steel); sign(g, "OPTICAL / 01", .55, 1.82, .331, .7, "#dae6e6");
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
  const dotMaterial = new T.PointsMaterial({ color: "#ededed", size: .019, transparent: true, opacity: .68, depthWrite: false }); signal.add(new T.Points(cloud, dotMaterial));
  const orbitMaterial = new T.MeshBasicMaterial({ color: "#aaaaaa", transparent: true, opacity: .28 });
  for (const tilt of [.5, -1]) { const orbit = mesh(signal, new T.TorusGeometry(.66, .003, 4, 100), orbitMaterial, 0, 0, 0); geometry.set(`orbit${tilt}`, orbit.geometry); orbit.rotation.set(tilt, 0, .35); }
  cylinder(table, .33, .37, .045, 0, .97, 0, black); cylinder(table, .27, .27, .008, 0, .996, 0, cool);
  let scifi = document.documentElement.dataset.theme === "scifi";
  function updateTheme() { scifi = document.documentElement.dataset.theme === "scifi"; signal.visible = scifi; }
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
  // Researchers use articulated anatomical rigs with tailored clothing and faces.
  const labels = document.createElement("div"); labels.className = "institute-3d-labels"; host.append(labels);
  const rigs: Rig[] = [], pickTargets: T.Object3D[] = [];
  const looks = [
    { skin: "#c79a7e", hair: "#272428", shirt: "#eceeea", female: true, coat: true, glasses: true },
    { skin: "#78513d", hair: "#231e1b", shirt: "#c9cacc", female: false, coat: true, glasses: false },
    { skin: "#c2977e", hair: "#292a2b", shirt: "#55585c", female: false, coat: false, glasses: true },
    { skin: "#bb8867", hair: "#47342b", shirt: "#777b78", female: true, coat: false, glasses: true },
    { skin: "#e0bba1", hair: "#8e795d", shirt: "#d4dad7", female: false, coat: true, glasses: false },
    { skin: "#835941", hair: "#252324", shirt: "#484b4f", female: true, coat: false, glasses: false },
  ];
  for (const [index, person] of PEOPLE.entries()) {
    const look = looks[index], root = group(scene), body = group(root, 0, .91, 0), skin = mat(look.skin, .75), hair = mat(look.hair, .92), cloth = mat(look.shirt, .83), pants = mat(index === 3 ? "#656660" : "#303134", .91);
    root.userData.personId = person.id;
    // Sculpted torso profile, shoulders and coat skirt; front points along +z.
    const torso = new T.LatheGeometry([[.15, 0], [.18, .06], [.175, .22], [.215, .38], [.23, .43], [.16, .5]].map(p => new T.Vector2(p[0], p[1])), 24); geometry.set(`torso${index}`, torso); mesh(body, torso, cloth, 0, 0, 0).scale.z = .62;
    if (look.coat) {
      const skirt = new T.LatheGeometry([[.205, -.24], [.22, -.16], [.18, .09], [.175, .2]].map(p => new T.Vector2(...p as [number, number])), 24); geometry.set(`coat${index}`, skirt); mesh(body, skirt, cloth, 0, 0, 0).scale.z = .64;
      box(body, .012, .55, .015, 0, .11, .128, mat("#a0aaa9", .8), .003);
      for (const side of [-1, 1]) { const lapel = box(body, .095, .22, .012, side * .075, .35, .13, ceramic, .015); lapel.rotation.z = side * -.27; box(body, .11, .1, .015, side * .12, -.06, .13, white, .008); }
      for (let n = 0; n < 4; n++) sphere(body, .03, -.06 + n * .105, .143, .012, .012, .007, steel);
    }
    cylinder(body, .065, .07, .11, 0, .54, 0, skin);
    const head = group(body, 0, .67, 0); sphere(head, 0, 0, 0, .117, .155, .115, skin); sphere(head, 0, -.075, .032, .085, .08, .09, skin);
    sphere(head, 0, -.015, .111, .025, .04, .029, skin); // bridge and nose
    sphere(head, 0, -.037, .131, .027, .015, .016, skin);
    for (const side of [-1, 1]) {
      sphere(head, side * .117, -.015, 0, .022, .04, .022, skin);
      sphere(head, side * .047, .017, .102, .027, .013, .012, ceramic); sphere(head, side * .047, .017, .113, .009, .01, .004, mat("#33332e", .5));
      const brow = box(head, .05, .009, .008, side * .047, .044, .109, hair, .004); brow.rotation.z = side * -.1;
      if (look.glasses) { const frame = new T.TorusGeometry(.031, .0035, 5, 16); geometry.set(`glasses${index}/${side}`, frame); const o = mesh(head, frame, graphite, side * .047, .018, .121); o.scale.y = .7; tube(head, [[side * .076, .02, .12], [side * .12, .025, .06], [side * .12, .015, 0]], .0035, graphite); }
    }
    if (look.glasses) box(head, .03, .005, .006, 0, .02, .123, graphite, .002);
    box(head, .045, .006, .009, 0, -.078, .103, mat("#86534b", .9), .003);
    const cap = new T.SphereGeometry(.124, 24, 16, 0, Math.PI * 2, 0, look.female ? 1.8 : 1.5); geometry.set(`hair${index}`, cap); mesh(head, cap, hair, 0, .03, -.01).scale.set(1, .98, 1);
    if (look.female) { sphere(head, 0, -.03, -.11, .09, .13, .07, hair); sphere(head, .02, -.14, -.145, .055, .14, .055, hair); }
    // Name badge and fabric seams stay legible in the closer camera views.
    box(body, .08, .11, .012, -.105, .24, .15, ceramic, .009); box(body, .06, .026, .014, -.105, .264, .158, mat("#73777c", .65), .003); box(body, .047, .006, .014, -.105, .23, .159, steel, .002);
    const arms: T.Group[] = [], elbows: T.Group[] = [], legs: T.Group[] = [], knees: T.Group[] = [];
    for (const side of [-1, 1]) {
      const arm = group(body, side * .225, .4, 0); arm.rotation.z = side * .1;
      sphere(arm, 0, -.035, 0, .08, .09, .075, cloth); cylinder(arm, .071, .055, .245, 0, -.15, 0, cloth);
      const elbow = group(arm, 0, -.285, 0); sphere(elbow, 0, 0, 0, .054, .056, .055, cloth); cylinder(elbow, .05, .04, .235, 0, -.12, 0, cloth); box(elbow, .085, .042, .08, 0, -.235, 0, look.coat ? white : cloth, .015);
      sphere(elbow, 0, -.293, .005, .041, .067, .025, skin); for (let f = 0; f < 4; f++) { const finger = cylinder(elbow, .009, .008, .055, -.026 + f * .016, -.345, .006, skin, 8); finger.rotation.x = -.12; } sphere(elbow, side * .038, -.28, .013, .015, .036, .014, skin);
      arms.push(arm); elbows.push(elbow);
      const leg = group(root, side * .105, .91, 0); sphere(leg, 0, -.04, 0, .09, .12, .09, pants); cylinder(leg, .085, .065, .36, 0, -.21, 0, pants);
      const knee = group(leg, 0, -.41, 0); sphere(knee, 0, 0, 0, .067, .065, .069, pants); cylinder(knee, .063, .048, .34, 0, -.18, 0, pants); box(knee, .13, .095, .25, 0, -.38, .056, rubber, .045); box(knee, .13, .02, .25, 0, -.427, .056, graphite, .008);
      legs.push(leg); knees.push(knee);
    }
    root.scale.setScalar(look.female ? .98 : 1.04);
    const ringGeo = new T.RingGeometry(.37, .4, 48); geometry.set(`ring${index}`, ringGeo); const ring = mesh(root, ringGeo, new T.MeshBasicMaterial({ color: "#eeeeee", transparent: true, opacity: .75, side: T.DoubleSide }), 0, .09, 0); ring.rotation.x = -Math.PI / 2;
    root.traverse(o => { if (o instanceof T.Mesh) { o.userData.personId = person.id; if (o !== ring) pickTargets.push(o); } });
    const a = world.agents.find(a => a.id === person.id)!, p = station(a.location, a.id); root.position.set(p[0], .08, p[1]); root.rotation.y = a.location === "meeting" ? Math.atan2(-p[0], 5.5 - p[1]) : Math.PI;
    const label = document.createElement("button"); label.className = "institute-3d-person"; label.textContent = person.name.split(" ")[0]; label.setAttribute("aria-label", `Inspect ${person.name}, ${person.role}`); label.addEventListener("click", () => options.onSelect(person.id)); labels.append(label);
    rigs.push({ id: person.id, root, body, head, arms, elbows, legs, knees, ring, label, destination: p, path: [], location: a.location, phase: index * 1.7 });
  }
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
  function redrawScreens() {
    for (const { texture, canvas, type } of screens) {
      const c = canvas.getContext("2d")!, w = canvas.width, h = canvas.height;
      c.fillStyle = "#080909"; c.fillRect(0, 0, w, h); c.fillStyle = "#202123"; c.fillRect(0, 0, w, 46); c.fillStyle = "#d0d0d2"; c.font = "16px monospace"; c.fillText(`FORTIFY / ${type.toUpperCase()}  ·  ${String(world.round).padStart(2, "0")}`, 24, 29);
      c.strokeStyle = "#292a2d"; c.lineWidth = 1; for (let i = 1; i < 8; i++) { c.beginPath(); c.moveTo(28, 72 + i * 40); c.lineTo(740, 72 + i * 40); c.stroke(); }
      if (type === "code" || type === "office") {
        const lines = ["institute.research / active", "", `dataset_revision = ${world.revision + 1}`, `available_compute = ${availableCompute(world)}`, `instrument_health = ${world.health}`, "", "for hypothesis in approaches:", "  evidence = review(measurement)", "  publish(evidence, shared_memory)", "", `round ${world.round} · ${world.focus}`];
        c.font = "18px monospace"; lines.forEach((line, i) => { c.fillStyle = i % 3 ? "#a0a0a5" : "#ccccce"; c.fillText(line, 35, 82 + i * 28); });
      } else {
        c.font = "18px monospace"; c.fillStyle = "#b9b9bd"; c.fillText(type === "instrument" ? "SENSOR / CALIBRATION" : type === "compute" ? "COMPUTE CAPACITY" : "RELIABILITY / CURRENT EVIDENCE", 30, 88);
        c.font = "52px monospace"; const scores = world.projects.map(p => projectScore(world, p)); c.fillText(type === "instrument" ? `${world.health}%` : type === "compute" ? `${availableCompute(world)} NODES` : scores.some(s => s !== null) ? `${Math.round(Math.max(...scores.map(s => s ?? 0)) * 100)}%` : "AWAITING DATA", 30, 160);
        for (let j = 0; j < 2; j++) { c.beginPath(); c.strokeStyle = j ? "#a6b0aa" : "#d1d1d4"; c.lineWidth = 3; for (let i = 0; i < 75; i++) { const y = 270 + j * 40 + Math.sin(i * .19 + world.round * .7 + j) * (22 + j * 8) + Math.sin(i * .63) * 9; i ? c.lineTo(32 + i * 9.4, y) : c.moveTo(32, y); } c.stroke(); }
        c.font = "15px monospace"; c.fillStyle = "#929297"; c.fillText(`GRANT ${world.treasury}   DATASET ${world.revision + 1}   ${world.status.toUpperCase()}`, 30, 408);
      }
      texture.needsUpdate = true;
    }
  }
  redrawScreens();
  const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
  const ao = new SSAOPass(scene, camera, 1, 1, 8); ao.kernelRadius = .65; ao.minDistance = .002; ao.maxDistance = .18; composer.addPass(ao);
  const bloom = new UnrealBloomPass(new T.Vector2(1, 1), .16, .45, 1.5); composer.addPass(bloom); composer.addPass(new OutputPass());
  function resize() { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; const dpr = Math.min(window.devicePixelRatio || 1, quality === "high" ? 1.5 : 1); renderer.setPixelRatio(dpr); renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); composer.setPixelRatio(dpr); composer.setSize(w, h); }
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  const raycaster = new T.Raycaster(), pointer = new T.Vector2(); let down: [number, number] | null = null;
  function onPointerDown(e: PointerEvent) { down = [e.clientX, e.clientY]; }
  function onPointerUp(e: PointerEvent) { if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return; down = null; const r = renderer.domElement.getBoundingClientRect(); pointer.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects(pickTargets)[0]; if (hit) options.onSelect(hit.object.userData.personId); }
  function onControlStart() { cameraTween = 0; follow = false; cinematic = false; }
  function onContextLost(e: Event) { e.preventDefault(); options.onError("The 3D view lost its graphics connection. Reload the view to reconnect; your research session is saved."); }
  function visibility() { hidden = document.hidden; previous = 0; }
  renderer.domElement.addEventListener("pointerdown", onPointerDown); renderer.domElement.addEventListener("pointerup", onPointerUp); renderer.domElement.addEventListener("webglcontextlost", onContextLost); controls.addEventListener("start", onControlStart); document.addEventListener("visibilitychange", visibility);
  function followGoals() {
    const rig = rigs.find(r => r.id === selected)!;
    targetGoal.copy(rig.root.position).add(positionScratch.set(0, 1, 0));
    const systems = rig.location === "compute" || rig.location === "maintenance";
    eyeGoal.copy(targetGoal).add(positionScratch.set(systems ? -2.6 : 3.2, systems ? 1.8 : 1.7, systems ? 2.6 : 4.8));
    if (systems) { eyeGoal.x = T.MathUtils.clamp(eyeGoal.x, 4.4, 13.2); eyeGoal.z = T.MathUtils.clamp(eyeGoal.z, -8.3, -1.3); }
  }
  function setView(next: CameraView) {
    view = next; follow = next === "follow"; cinematic = false; cameraTween = 1;
    if (next === "follow") followGoals();
    else { const preset = CAMERA_VIEWS[next]; eyeGoal.set(preset.eye[0], preset.eye[1], preset.eye[2]); targetGoal.set(preset.target[0], preset.target[1], preset.target[2]); }
  }
  function animate(now: number) {
    if (disposed) return; animation = requestAnimationFrame(animate); if (hidden) return;
    const cameraDt = Math.min(previous ? (now - previous) / 1000 : 0, .5), dt = Math.min(cameraDt, .05); previous = now; elapsed += dt;
    if (scifi && !reduced) { signal.rotation.y += dt * .11; signal.position.y = 1.6 + Math.sin(elapsed * .55) * .025; }
    for (const rig of rigs) {
      const a = world.agents.find(a => a.id === rig.id)!, p = rig.root.position, walking = rig.path.length > 0;
      if (walking) {
        const dest = rig.path[0], dx = dest[0] - p.x, dz = dest[1] - p.z, distance = Math.hypot(dx, dz), stride = 2.4 * dt;
        if (distance <= stride) { p.x = dest[0]; p.z = dest[1]; rig.path.shift(); }
        else { p.x += dx / distance * stride; p.z += dz / distance * stride; }
        const angle = Math.atan2(dx, dz), delta = Math.atan2(Math.sin(angle - rig.root.rotation.y), Math.cos(angle - rig.root.rotation.y)); rig.root.rotation.y += delta * Math.min(1, dt * 9);
      } else {
        const angle = rig.location === "meeting" ? Math.atan2(-p.x, 5.5 - p.z) : Math.PI, delta = Math.atan2(Math.sin(angle - rig.root.rotation.y), Math.cos(angle - rig.root.rotation.y)); rig.root.rotation.y += delta * Math.min(1, dt * 4);
      }
      const phase = elapsed * (walking ? 8 : 2.3) + rig.phase, motion = reduced ? 0 : 1;
      const working = !walking && (rig.location === "workbench" || rig.location === "analysis" || rig.location === "compute" || rig.location === "maintenance");
      rig.body.position.y = .91 + (walking ? Math.abs(Math.sin(phase)) * .025 : Math.sin(phase) * .004) * motion;
      rig.head.rotation.y = Math.sin(elapsed * .65 + rig.phase) * .12 * motion; rig.head.rotation.x = working ? .12 : -.025;
      rig.body.rotation.x = working ? .055 : 0;
      for (let i = 0; i < 2; i++) { const s = i ? -1 : 1; rig.legs[i].rotation.x = walking ? Math.sin(phase) * .39 * s * motion : 0; rig.knees[i].rotation.x = walking ? Math.max(0, -Math.sin(phase) * s) * .55 * motion : .025; rig.arms[i].rotation.x = walking ? -Math.sin(phase) * .32 * s * motion : working ? -.75 + Math.sin(phase + i) * .075 * motion : rig.location === "meeting" ? -.25 + Math.sin(phase + i) * .14 * motion : -.1; rig.elbows[i].rotation.x = working ? -.85 + Math.sin(phase * 1.4 + i) * .12 * motion : walking ? -.17 : -.2; }
      rig.ring.visible = rig.id === selected; rig.label.classList.toggle("selected", rig.id === selected); rig.label.setAttribute("aria-pressed", String(rig.id === selected)); rig.label.title = `${PEOPLE.find(p => p.id === rig.id)!.name} · ${a.activity}${walking ? " · walking to station" : ""}`;
      projection.copy(p).add(positionScratch.set(0, 2.08, 0)).project(camera); const visible = projection.z < 1 && projection.z > -1 && Math.abs(projection.x) < 1 && Math.abs(projection.y) < 1;
      rig.label.hidden = !visible; if (visible) rig.label.style.transform = `translate(${(projection.x * .5 + .5) * host.clientWidth}px,${(-projection.y * .5 + .5) * host.clientHeight}px) translate(-50%,-100%)`;
    }
    const activeExperiment = world.agents.some(a => a.location === "compute") && world.status === "active";
    robotArms.forEach((arm, i) => { arm.rotation.y = reduced ? 0 : Math.sin(elapsed * .65 + i * 2) * (activeExperiment ? .5 : .14); arm.rotation.z = -.4 + (reduced ? 0 : Math.sin(elapsed * .8 + i) * .18); });
    instrumentLights.forEach(o => { o.material = world.health < 70 ? amber : green; });
    rackLEDs.forEach((o, i) => { o.material = world.outageUntil > world.round && i > 9 ? black : i % 7 === Math.floor(elapsed * 3) % 7 ? cool : green; });
    if (!reduced) fans.forEach(f => { f.rotation.z += dt * 4; });
    if (follow) { followGoals(); cameraTween = 1; }
    if (cameraTween) { const amount = reduced ? 1 : 1 - Math.exp(-cameraDt * 3.3); camera.position.lerp(eyeGoal, amount); controls.target.lerp(targetGoal, amount); if (!follow && camera.position.distanceTo(eyeGoal) < .02) cameraTween = 0; }
    controls.autoRotate = cinematic && !reduced; controls.autoRotateSpeed = .35; controls.update(); composer.render();
  }
  animation = requestAnimationFrame(animate); options.onReady();
  return {
    update(next: World, nextSelected: PersonId) {
      const reset = next.id !== world.id || next.round < world.round; const changed = next !== world; world = next; selected = nextSelected;
      for (const rig of rigs) { const a = next.agents.find(a => a.id === rig.id)!, p = station(a.location, a.id); if (reset || reduced) { rig.path = []; rig.root.position.set(p[0], .08, p[1]); } else if (p[0] !== rig.destination[0] || p[1] !== rig.destination[1]) rig.path = route([rig.root.position.x, rig.root.position.z], p); rig.location = a.location; rig.destination = p; }
      if (changed) redrawScreens();
    },
    setView,
    setCinematic(value: boolean) { cinematic = value; follow = false; cameraTween = 0; },
    setQuality(value: string) { quality = value; ao.enabled = value === "high"; bloom.enabled = value === "high"; renderer.shadowMap.enabled = value === "high"; resize(); },
    dispose() {
      disposed = true; cancelAnimationFrame(animation); observer.disconnect(); themeObserver.disconnect(); dotMaterial.dispose(); orbitMaterial.dispose(); controls.dispose(); document.removeEventListener("visibilitychange", visibility); renderer.domElement.removeEventListener("pointerdown", onPointerDown); renderer.domElement.removeEventListener("pointerup", onPointerUp); renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      scene.traverse(o => { if (o instanceof T.Mesh) { o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => m.dispose()); } }); geometry.forEach(g => g.dispose()); material.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); glass.dispose(); environment.dispose(); composer.passes.forEach(p => p.dispose()); composer.dispose(); renderer.dispose(); renderer.domElement.remove(); labels.remove();
    },
  };
}
