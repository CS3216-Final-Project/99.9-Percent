"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useDetail, type Detail } from "./detail";
import { loadGltf, toFloatAttributes } from "./gltf";
import type { V3 } from "./prims";

/*
 * Furniture models from two CC0 packs, Kenney's Furniture Kit (kenney.nl) and
 * KayKit Furniture Bits (kaylousberg.com); the licences sit beside the files in
 * public/models. Nothing here moves, so every placed model is baked into one
 * mesh per material: the whole office's furniture costs a dozen draw calls.
 *
 * Models are placed by their bounding box: `p` is where the bottom centre of
 * the box goes, so it does not matter where each artist put the origin. Both
 * packs face +z.
 *
 * At HD detail the most visible pieces (plants, sofas, armchairs, tables,
 * boxes, a lamp) are swapped for photo-scanned CC0 models from Poly Haven.
 * Each stand-in is scaled to fit inside the box of the model it replaces, so
 * the layout is the same at both levels of detail.
 */

const KENNEY = "/models/kenney/";
const KAYKIT = "/models/kaykit/";

const kenney = (name: string) => `${KENNEY}${name}.glb`;
const kaykit = (name: string) => `${KAYKIT}${name}.gltf`;

const MODELS = {
  desk: kenney("desk"),
  chairDesk: kenney("chairDesk"),
  cabinet: kenney("kitchenCabinet"),
  cabinetDrawer: kenney("kitchenCabinetDrawer"),
  sink: kenney("kitchenSink"),
  stove: kenney("kitchenStove"),
  microwave: kenney("kitchenMicrowave"),
  blender: kenney("kitchenBlender"),
  toaster: kenney("toaster"),
  cabinetUpper: kenney("kitchenCabinetUpper"),
  bar: kenney("kitchenBar"),
  barEnd: kenney("kitchenBarEnd"),
  stoolBar: kenney("stoolBar"),
  trashcan: kenney("trashcan"),
  tableCoffee: kenney("tableCoffee"),
  tableCoffeeGlass: kenney("tableCoffeeGlass"),
  chairModern: kenney("chairModernCushion"),
  chairCushion: kenney("chairCushion"),
  bench: kenney("benchCushion"),
  loungeChair: kenney("loungeChairRelax"),
  tvCabinet: kenney("cabinetTelevision"),
  tv: kenney("televisionModern"),
  speaker: kenney("speaker"),
  lampRoundFloor: kenney("lampRoundFloor"),
  lampSquareFloor: kenney("lampSquareFloor"),
  lampTable: kenney("lampRoundTable"),
  pottedPlant: kenney("pottedPlant"),
  plantSmall1: kenney("plantSmall1"),
  plantSmall3: kenney("plantSmall3"),
  boxClosed: kenney("cardboardBoxClosed"),
  boxOpen: kenney("cardboardBoxOpen"),
  coatRack: kenney("coatRackStanding"),
  sideTable: kenney("sideTable"),
  couch: kaykit("couch_pillows"),
  armchair: kaykit("armchair_pillows"),
  cactusSmallA: kaykit("cactus_small_A"),
  cactusSmallB: kaykit("cactus_small_B"),
  cactusMedium: kaykit("cactus_medium_A"),
  frameLargeA: kaykit("pictureframe_large_A"),
  frameMedium: kaykit("pictureframe_medium"),
  pillowA: kaykit("pillow_A"),
  pillowB: kaykit("pillow_B"),
  tableLong: kaykit("table_medium_long"),
} as const;

export type ModelId = keyof typeof MODELS;

/** How many metres one model unit is: Kenney models are about half size, KayKit about one and a half. */
function packScale(id: ModelId): number {
  return MODELS[id].startsWith(KAYKIT) ? 0.62 : 1.93;
}

const POLYHAVEN = "/models/polyhaven/";

/** Photo-scanned stand-ins for HD detail. */
const HD_MODELS = {
  plantLarge: `${POLYHAVEN}potted_plant_02.glb`,
  plantSmall: `${POLYHAVEN}potted_plant_04.glb`,
  loungeChair: `${POLYHAVEN}mid_century_lounge_chair.glb`,
  armchair: `${POLYHAVEN}modern_arm_chair_01.glb`,
  sofa: `${POLYHAVEN}sofa_02.glb`,
  coffeeTable: `${POLYHAVEN}coffee_table_round_01.glb`,
  sideTable: `${POLYHAVEN}side_table_01.glb`,
  box: `${POLYHAVEN}cardboard_box_01.glb`,
  deskLamp: `${POLYHAVEN}desk_lamp_arm_01.glb`,
} as const;

type HdId = keyof typeof HD_MODELS;

interface Swap {
  id: HdId;
  /** Extra turn so the stand-in faces the same way as the model it replaces. */
  turn?: number;
  /** "height" matches the original's height; "box" fits inside its whole box. */
  fit?: "height" | "box";
}

/** Which models get a photo-scanned stand-in at HD detail. */
const HD_SWAPS: Partial<Record<ModelId, Swap>> = {
  pottedPlant: { id: "plantLarge", fit: "height" },
  cactusMedium: { id: "plantLarge", fit: "height" },
  plantSmall1: { id: "plantSmall", fit: "height" },
  plantSmall3: { id: "plantSmall", fit: "height" },
  cactusSmallA: { id: "plantSmall", fit: "height" },
  cactusSmallB: { id: "plantSmall", fit: "height" },
  loungeChair: { id: "loungeChair" },
  armchair: { id: "armchair" },
  couch: { id: "sofa" },
  tableCoffee: { id: "coffeeTable" },
  tableCoffeeGlass: { id: "coffeeTable" },
  sideTable: { id: "sideTable" },
  boxClosed: { id: "box" },
  boxOpen: { id: "box" },
  lampTable: { id: "deskLamp", fit: "height" },
};

export interface Placement {
  id: ModelId;
  /** Where the bottom centre of the model's bounding box goes. */
  p: V3;
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

/** Fetch a model's scene once however often it is asked for. A failed fetch is forgotten, so a later mount tries again. */
function loadModel(url: string): Promise<THREE.Object3D> {
  return loadGltf(url).then((gltf) => gltf.scene);
}

interface Batch {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

/** Every placed model baked into one mesh per material, with photo-scanned stand-ins where they have loaded. */
function bake(placements: Placement[], scenes: Map<ModelId, THREE.Object3D>, standIns: Map<HdId, THREE.Object3D> | null, detail: Detail): Batch[] {
  const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const pl of placements) {
    const original = prepare(MODELS[pl.id], scenes.get(pl.id)!, detail);
    const swap = HD_SWAPS[pl.id];
    const standIn = swap && standIns?.get(swap.id);
    const prep = swap && standIn ? prepare(HD_MODELS[swap.id], standIn, detail, true) : original;
    const m = swap && standIn ? standInMatrix(pl, original, prep, swap) : matrixFor(pl, original);
    for (const part of prep.parts) byMaterial.set(part.material, [...(byMaterial.get(part.material) ?? []), part.geometry.clone().applyMatrix4(m)]);
  }
  return [...byMaterial].map(([material, list]) => {
    const geometry = mergeGeometries(list);
    if (!geometry) throw new Error("Furniture models with one material have different vertex attributes");
    for (const g of list) g.dispose();
    return { geometry, material };
  });
}

/**
 * Draw placed models. They appear together once all have loaded, and the rest
 * of the room never waits for them. If they cannot be downloaded, the office is
 * drawn without them and the game carries on.
 */
export function ModelBatch({ placements, shadows = true }: { placements: Placement[]; shadows?: boolean }) {
  const [scenes, setScenes] = useState<Map<ModelId, THREE.Object3D> | null>(null);
  useEffect(() => {
    const ids = [...new Set(placements.map((p) => p.id))];
    let live = true;
    Promise.all(ids.map((id) => loadModel(MODELS[id]))).then(
      (loaded) => {
        if (live) setScenes(new Map(ids.map((id, i) => [id, loaded[i]])));
      },
      (error: unknown) => {
        if (live) console.warn("Furniture models failed to load; drawing the office without them.", error);
      },
    );
    return () => {
      live = false;
    };
  }, [placements]);
  const detail = useDetail();
  const standIns = useStandIns(placements, detail);
  const batches = useMemo(() => (scenes ? bake(placements, scenes, standIns, detail) : []), [placements, scenes, standIns, detail]);
  useEffect(() => () => batches.forEach((b) => b.geometry.dispose()), [batches]);
  return (
    <group>
      {batches.map((b, i) => (
        <mesh key={i} geometry={b.geometry} material={b.material} castShadow={shadows} receiveShadow />
      ))}
    </group>
  );
}

/**
 * The photo-scanned stand-ins these placements need, at HD detail only. Until
 * they load, or if they cannot be downloaded, the stylised models stay.
 */
function useStandIns(placements: Placement[], detail: Detail): Map<HdId, THREE.Object3D> | null {
  const [loaded, setLoaded] = useState<Map<HdId, THREE.Object3D> | null>(null);
  const ids = useMemo(() => [...new Set(placements.flatMap((p) => HD_SWAPS[p.id]?.id ?? []))], [placements]);
  useEffect(() => {
    if (detail !== "hd" || ids.length === 0) return;
    let live = true;
    Promise.all(ids.map((id) => loadModel(HD_MODELS[id]))).then(
      (list) => {
        if (live) setLoaded(new Map(ids.map((id, i) => [id, list[i]])));
      },
      (error: unknown) => {
        if (live) console.warn("HD furniture failed to load; keeping the stylised models.", error);
      },
    );
    return () => {
      live = false;
    };
  }, [ids, detail]);
  return detail === "hd" ? loaded : null;
}

/** Start fetching every model as soon as the 3D scene's code loads. */
export function preloadModels(): void {
  // A failure here is reported by whichever batch needed the model, so the preload itself stays quiet.
  for (const url of Object.values(MODELS)) loadGltf(url).catch(() => {});
}
