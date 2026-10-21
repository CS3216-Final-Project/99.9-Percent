import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Detail } from "./detail";
import { toFloatAttributes } from "./gltf";
import { HD_MODELS, HD_SWAPS, MODELS, packScale, type HdId, type ModelId, type Swap } from "./modelCatalog";
import type { V3 } from "./shapes";

export interface Placement {
  id: ModelId;
  /** Where the bottom centre of the model's bounding box goes. */
  p: V3;
  /** Sits on top of this placement as drawn, so it stays on its support when an HD stand-in has a different height. Must come earlier in the list. */
  on?: Placement;
  /** Turn about the vertical, in radians. */
  rot?: number;
  /** A number scales the model's natural size; [w, h, d] stretches it to exactly that size in metres. */
  s?: number | V3;
}

interface Part {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

interface Prepared {
  parts: Part[];
  size: THREE.Vector3;
  /** Bottom centre of the bounding box, in model units. */
  base: THREE.Vector3;
}

/**
 * The packs' materials, shared across models when they look the same so they
 * can be drawn together. Basic detail turns them matte Lambert, which costs far
 * less per pixel; HD keeps them physically based, at least satin-rough so the
 * low-poly furniture does not look like wet plastic. Every KayKit model brings
 * its own copy of the same texture atlas, so a texture is known by its name and size.
 */
const shared = new Map<string, THREE.Material>();
function toShared(source: THREE.Material, detail: Detail): THREE.Material {
  const s = source as THREE.MeshStandardMaterial;
  const image = s.map?.image as { width?: number; height?: number } | undefined;
  const map = s.map ? `${s.map.name}:${image?.width}x${image?.height}` : "";
  const key = [detail, s.color.getHexString(), map, s.vertexColors, s.transparent, s.opacity, s.side, s.roughness, s.metalness].join("|");
  let m = shared.get(key);
  if (!m) {
    const common = { color: s.color, map: s.map, vertexColors: s.vertexColors, transparent: s.transparent, opacity: s.opacity, side: s.side };
    m =
      detail === "hd"
        ? new THREE.MeshStandardMaterial({ ...common, roughness: Math.max(0.5, s.roughness ?? 1), metalness: Math.min(0.3, s.metalness ?? 0) })
        : new THREE.MeshLambertMaterial(common);
    shared.set(key, m);
  }
  return m;
}

const prepared = new Map<string, Prepared>();
/** A model's parts in its own frame. Photo-scanned models keep their own materials: their maps are what makes them look real. */
function prepare(url: string, scene: THREE.Object3D, detail: Detail, keepMaterials = false): Prepared {
  const hit = prepared.get(`${detail}|${url}`);
  if (hit) return hit;
  scene.updateMatrixWorld(true);
  const parts: Part[] = [];
  const box = new THREE.Box3();
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geometry = toFloatAttributes(mesh.geometry.clone()).applyMatrix4(mesh.matrixWorld);
    geometry.computeBoundingBox();
    box.union(geometry.boundingBox!);
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    parts.push({ geometry, material: keepMaterials ? materials[0] : toShared(materials[0], detail) });
  });
  const out = { parts, size: box.getSize(new THREE.Vector3()), base: new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2) };
  prepared.set(`${detail}|${url}`, out);
  return out;
}

const UP = new THREE.Vector3(0, 1, 0);

function matrixFor(pl: Placement, prep: Prepared): THREE.Matrix4 {
  const k = packScale(pl.id);
  const scale = Array.isArray(pl.s)
    ? new THREE.Vector3(pl.s[0] / prep.size.x, pl.s[1] / prep.size.y, pl.s[2] / prep.size.z)
    : new THREE.Vector3(1, 1, 1).multiplyScalar(k * (pl.s ?? 1));
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...pl.p), new THREE.Quaternion().setFromAxisAngle(UP, pl.rot ?? 0), scale);
  return m.multiply(new THREE.Matrix4().makeTranslation(-prep.base.x, -prep.base.y, -prep.base.z));
}

/** Where a stand-in goes: inside the box the original would fill, turned the same way. */
function standInMatrix(pl: Placement, original: Prepared, standIn: Prepared, swap: Swap): THREE.Matrix4 {
  const k = packScale(pl.id);
  const want = Array.isArray(pl.s) ? new THREE.Vector3(...pl.s) : original.size.clone().multiplyScalar(k * (pl.s ?? 1));
  const turn = swap.turn ?? 0;
  // A quarter turn swaps which side of the stand-in lines up with the original's width.
  const quarter = Math.abs(Math.round(turn / (Math.PI / 2))) % 2 === 1;
  const have = quarter ? new THREE.Vector3(standIn.size.z, standIn.size.y, standIn.size.x) : standIn.size;
  const f = swap.fit === "height" ? want.y / have.y : Math.min(want.x / have.x, want.y / have.y, want.z / have.z);
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...pl.p), new THREE.Quaternion().setFromAxisAngle(UP, (pl.rot ?? 0) + turn), new THREE.Vector3(f, f, f));
  return m.multiply(new THREE.Matrix4().makeTranslation(-standIn.base.x, -standIn.base.y, -standIn.base.z));
}

interface Batch {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

/** Every placed model baked into one mesh per material, with photo-scanned stand-ins where they have loaded. */
export function bake(placements: Placement[], scenes: Map<ModelId, THREE.Object3D>, standIns: Map<HdId, THREE.Object3D> | null, detail: Detail): Batch[] {
  const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const tops = new Map<Placement, number>();
  for (const pl of placements) {
    const original = prepare(MODELS[pl.id], scenes.get(pl.id)!, detail);
    const swap = HD_SWAPS[pl.id];
    const standIn = swap && standIns?.get(swap.id);
    const prep = swap && standIn ? prepare(HD_MODELS[swap.id], standIn, detail, true) : original;
    const y = pl.on ? tops.get(pl.on) ?? pl.p[1] : pl.p[1];
    const positioned = pl.on ? { ...pl, p: [pl.p[0], y, pl.p[2]] as V3 } : pl;
    const m = swap && standIn ? standInMatrix(positioned, original, prep, swap) : matrixFor(positioned, original);
    tops.set(pl, new THREE.Vector3(prep.base.x, prep.base.y + prep.size.y, prep.base.z).applyMatrix4(m).y);
    for (const part of prep.parts) byMaterial.set(part.material, [...(byMaterial.get(part.material) ?? []), part.geometry.clone().applyMatrix4(m)]);
  }
  return [...byMaterial].map(([material, list]) => {
    const geometry = mergeGeometries(list);
    if (!geometry) throw new Error("Furniture models with one material have different vertex attributes");
    for (const g of list) g.dispose();
    return { geometry, material };
  });
}
