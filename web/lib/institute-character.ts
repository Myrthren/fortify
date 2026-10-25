import * as T from "three";
import packed from "./institute-head-data.json";

export const INSTITUTE_CHARACTER_LOOKS = [
    { skin: "#c79a7e", hair: "#272428", shirt: "#eceeea", female: true, coat: true, glasses: true },
    { skin: "#78513d", hair: "#231e1b", shirt: "#c9cacc", female: false, coat: true, glasses: false },
    { skin: "#c2977e", hair: "#292a2b", shirt: "#55585c", female: false, coat: false, glasses: true },
    { skin: "#bb8867", hair: "#47342b", shirt: "#777b78", female: true, coat: false, glasses: true },
    { skin: "#e0bba1", hair: "#8e795d", shirt: "#d4dad7", female: false, coat: true, glasses: false },
    { skin: "#835941", hair: "#252324", shirt: "#484b4f", female: true, coat: false, glasses: false },
  ];


type Look = { skin: string; female: boolean; glasses: boolean; variant: number; skinMaterial: T.MeshStandardMaterial; hairMaterial: T.MeshStandardMaterial; frameMaterial: T.MeshStandardMaterial; eyeTexture: T.Texture };
const bytes = (encoded: string) => Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
const signed = (encoded: string) => new Int16Array(bytes(encoded).buffer);
const unsigned = (encoded: string) => new Uint16Array(bytes(encoded).buffer);
const cache = new Map<number, ReturnType<typeof unpackHead>>();
function unpackHead(variant: number) {
  const data = packed.variants[variant];
  return { position: Float32Array.from(signed(data.positions), value => value / packed.scale), normal: Float32Array.from(new Int8Array(bytes(data.normals).buffer), value => value / 127), uv: Float32Array.from(unsigned(data.uv), value => value / 65535), index: unsigned(packed.indices), hairIndex: unsigned(data.hairIndices), hairPosition: Float32Array.from(signed(data.hairPositions), value => value / packed.scale), hairNormal: Float32Array.from(new Int8Array(bytes(data.hairNormals).buffer), value => value / 127), hairUv: Float32Array.from(unsigned(data.hairUv), value => value / 65535), blink: Float32Array.from(signed(data.blink), value => value / packed.scale), eyes: data.eyes, lips: bytes(packed.lips) };
}
export function anatomicalHead(variant: number) { if (!cache.has(variant)) cache.set(variant, unpackHead(variant)); return cache.get(variant)!; }
export function anatomicalEye(side: number) { const source = packed.eyes[side]; return { position: Float32Array.from(signed(source.positions), value => value / packed.scale), uv: Float32Array.from(unsigned(source.uv), value => value / 65535), index: unsigned(source.indices) }; }
export function createCharacterHead(look: Look) {
  const root = new T.Group(), eyes: T.Group[] = [], geometries: T.BufferGeometry[] = [], materials: T.Material[] = [], textures: T.Texture[] = [], data = anatomicalHead(look.variant);
  function add(parent: T.Object3D, geometry: T.BufferGeometry, material: T.Material, x = 0, y = 0, z = 0) { geometries.push(geometry); const mesh = new T.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh; }
  const colors = new Float32Array(data.position.length), base = new T.Color(look.skin), lip = new T.Color(look.skin).lerp(new T.Color("#92594f"), .42), blush = new T.Color(look.skin).lerp(new T.Color("#bb7867"), .12);
  for (let i = 0; i < colors.length; i += 3) {
    const x = data.position[i], y = data.position[i + 1], z = data.position[i + 2], color = base.clone();
    const cheek = Math.exp(-Math.pow((Math.abs(x) - .035) / .025, 2) - Math.pow((y + .004) / .025, 2)) * T.MathUtils.smoothstep(z, .035, .075);
    color.lerp(blush, cheek).lerp(lip, data.lips[i / 3] / 255 * .7); colors.set([color.r, color.g, color.b], i);
  }
  const geometry = new T.BufferGeometry(); geometry.setAttribute("position", new T.BufferAttribute(data.position, 3)); geometry.setAttribute("normal", new T.BufferAttribute(data.normal, 3)); geometry.setAttribute("uv", new T.BufferAttribute(data.uv, 2)); geometry.setAttribute("color", new T.BufferAttribute(colors, 3)); geometry.setIndex(new T.BufferAttribute(data.index, 1)); geometry.morphAttributes.position = [new T.BufferAttribute(data.blink, 3)]; geometry.morphTargetsRelative = true;
  const skin = new T.MeshStandardMaterial({ vertexColors: true, roughness: .72, metalness: 0 }); materials.push(skin);
  const face = add(root, geometry, skin); face.userData.characterSurface = "anatomical";
  // The cap copies the actual scalp topology and moves out along its normals.
  const scalp = new T.BufferGeometry(); scalp.setAttribute("position", new T.BufferAttribute(data.hairPosition, 3)); scalp.setAttribute("normal", new T.BufferAttribute(data.hairNormal, 3)); scalp.setAttribute("uv", new T.BufferAttribute(data.hairUv, 2)); scalp.setIndex(new T.BufferAttribute(data.hairIndex, 1)); add(root, scalp, look.hairMaterial).userData.characterSurface = "scalp";
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256; const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#888"; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 150; i++) { ctx.strokeStyle = i % 3 ? "#999" : "#666"; ctx.lineWidth = i % 3 ? .6 : .9; ctx.beginPath(); ctx.moveTo(i * 1.73, 256); ctx.bezierCurveTo(i * 1.73 - 7, 180, i * 1.73 + 12, 90, i * 1.73 + 9, 0); ctx.stroke(); }
  const strands = new T.CanvasTexture(canvas); strands.colorSpace = T.NoColorSpace; strands.wrapS = strands.wrapT = T.RepeatWrapping; strands.repeat.set(3, 2); textures.push(strands); look.hairMaterial.bumpMap = strands; look.hairMaterial.bumpScale = .00025; look.hairMaterial.roughness = .79;
  if (look.female) { const bun = add(root, new T.SphereGeometry(1, 16, 12), look.hairMaterial, look.variant === 3 ? .012 : 0, .005, -.105); bun.scale.set(.037, .042, .029); }
  const eyeMaterial = new T.MeshStandardMaterial({ map: look.eyeTexture, alphaTest: .5, roughness: .38, metalness: 0 }); materials.push(eyeMaterial);
  for (let side = 0; side < 2; side++) {
    const source = anatomicalEye(side), eyeGeometry = new T.BufferGeometry(); eyeGeometry.setAttribute("position", new T.Float32BufferAttribute(source.position, 3)); eyeGeometry.setAttribute("uv", new T.Float32BufferAttribute(source.uv, 2)); eyeGeometry.setIndex(new T.BufferAttribute(source.index, 1)); eyeGeometry.computeVertexNormals();
    const eye = new T.Group(); eye.position.set(...data.eyes[side] as [number, number, number]); eye.scale.setScalar(look.female ? .94 : .97); root.add(eye); eyes.push(eye); add(eye, eyeGeometry, eyeMaterial).castShadow = false;
  }
  face.updateMatrixWorld(true); const ray = new T.Raycaster(), direction = new T.Vector3(0, 0, -1);
  function front(x: number, y: number) { ray.set(new T.Vector3(x, y, .35), direction); return (ray.intersectObject(face, false)[0]?.point.z ?? .075) + .0016; }
  for (const sign of [-1, 1]) {
    const browPositions: number[] = [], browUv: number[] = [], browIndex: number[] = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12, x = sign * (.012 + .036 * t), y = .048 + (look.female ? .004 : .0025) * Math.sin(t * Math.PI) - t * .001, thickness = .0017 * Math.pow(.2 + .8 * Math.sin(t * Math.PI), .4); for (const offset of [-thickness, thickness]) { browPositions.push(x, y + offset, front(x, y + offset)); browUv.push(t, offset < 0 ? 0 : 1); } if (i < 12) { const a = i * 2; if (sign > 0) browIndex.push(a, a + 2, a + 1, a + 2, a + 3, a + 1); else browIndex.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); } }
    const brow = new T.BufferGeometry(); brow.setAttribute("position", new T.Float32BufferAttribute(browPositions, 3)); brow.setAttribute("uv", new T.Float32BufferAttribute(browUv, 2)); brow.setIndex(browIndex); brow.computeVertexNormals(); add(root, brow, look.hairMaterial).castShadow = false;
    if (look.glasses) {
      const x = sign * Math.abs(data.eyes[0][0]), y = .028, z = .091, shape = new T.Shape();
      shape.moveTo(-.020, -.012); shape.lineTo(.018, -.012); shape.quadraticCurveTo(.024, -.012, .024, -.006); shape.lineTo(.024, .008); shape.quadraticCurveTo(.024, .014, .018, .014); shape.lineTo(-.018, .014); shape.quadraticCurveTo(-.024, .014, -.024, .008); shape.lineTo(-.024, -.006); shape.quadraticCurveTo(-.024, -.012, -.020, -.012);
      const hole = new T.Path(); hole.moveTo(-.0195, -.010); hole.quadraticCurveTo(-.022, -.010, -.022, -.006); hole.lineTo(-.022, .008); hole.quadraticCurveTo(-.022, .012, -.018, .012); hole.lineTo(.018, .012); hole.quadraticCurveTo(.022, .012, .022, .008); hole.lineTo(.022, -.006); hole.quadraticCurveTo(.022, -.010, .018, -.010); hole.closePath(); shape.holes.push(hole);
      const rim = add(root, new T.ExtrudeGeometry(shape, { depth: .0015, bevelEnabled: false, curveSegments: 4 }), look.frameMaterial, x, y, z); rim.rotation.y = sign * .1;
      add(root, new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(sign * (Math.abs(x) + .023), y + .006, z), new T.Vector3(sign * .080, y + .003, -.005), new T.Vector3(sign * .079, y - .012, -.021)]), 8, .0012, 4, false), look.frameMaterial);
    }
  }
  if (look.glasses) { const width = Math.abs(data.eyes[0][0]) - .022; add(root, new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(-width, .033, .092), new T.Vector3(0, .035, front(0, .035) + .0008), new T.Vector3(width, .033, .092)]), 8, .0011, 4, false), look.frameMaterial); }
  return { root, eyes, face, geometries, materials, textures };
}
