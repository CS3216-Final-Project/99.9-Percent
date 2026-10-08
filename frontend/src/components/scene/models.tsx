"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
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
 */

const KENNEY = "/models/kenney/";
const KAYKIT = "/models/kaykit/";

const kenney = (name: string) => `${KENNEY}${name}.glb`;
const kaykit = (name: string) => `${KAYKIT}${name}.gltf`;

const MODELS = {
  desk: kenney("desk"),
  chairDesk: kenney("chairDesk"),
  screen: kenney("computerScreen"),
  keyboard: kenney("computerKeyboard"),
  mouse: kenney("computerMouse"),
  cabinet: kenney("kitchenCabinet"),
  cabinetDrawer: kenney("kitchenCabinetDrawer"),
  sink: kenney("kitchenSink"),
  stove: kenney("kitchenStove"),
  fridge: kenney("kitchenFridgeLarge"),
  coffeeMachine: kenney("kitchenCoffeeMachine"),
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
 * Matte Lambert versions of the packs' materials, which cost far less per pixel
 * than physically based shading. Materials that look the same are shared across
 * models so they can be drawn together. Every KayKit model brings its own copy
 * of the same texture atlas, so a texture is known by its name and size.
 */
const matte = new Map<string, THREE.Material>();
function toMatte(source: THREE.Material): THREE.Material {
  const s = source as THREE.MeshStandardMaterial;
  const image = s.map?.image as { width?: number; height?: number } | undefined;
  const map = s.map ? `${s.map.name}:${image?.width}x${image?.height}` : "";
  const key = [s.color.getHexString(), map, s.vertexColors, s.transparent, s.opacity, s.side].join("|");
  let m = matte.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color: s.color, map: s.map, vertexColors: s.vertexColors, transparent: s.transparent, opacity: s.opacity, side: s.side });
    matte.set(key, m);
  }
  return m;
}

const prepared = new Map<string, Prepared>();
function prepare(url: string, scene: THREE.Object3D): Prepared {
  const hit = prepared.get(url);
  if (hit) return hit;
  scene.updateMatrixWorld(true);
  const parts: Part[] = [];
  const box = new THREE.Box3();
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    geometry.computeBoundingBox();
    box.union(geometry.boundingBox!);
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    parts.push({ geometry, material: toMatte(materials[0]) });
  });
  const out = { parts, size: box.getSize(new THREE.Vector3()), base: new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2) };
  prepared.set(url, out);
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

// Neither pack is compressed, so three's plain loader is enough.
const loader = new GLTFLoader();
const loads = new Map<string, Promise<THREE.Object3D>>();

/** Fetch a model once however often it is asked for. A failed fetch is forgotten, so a later mount tries again. */
function loadModel(url: string): Promise<THREE.Object3D> {
  let load = loads.get(url);
  if (!load) {
    load = loader.loadAsync(url).then((gltf) => gltf.scene);
    load.catch(() => loads.delete(url));
    loads.set(url, load);
  }
  return load;
}

interface Batch {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

/** Every placed model baked into one mesh per material. */
function bake(placements: Placement[], scenes: Map<ModelId, THREE.Object3D>): Batch[] {
  const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const pl of placements) {
    const prep = prepare(MODELS[pl.id], scenes.get(pl.id)!);
    const m = matrixFor(pl, prep);
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
  const batches = useMemo(() => (scenes ? bake(placements, scenes) : []), [placements, scenes]);
  return (
    <group>
      {batches.map((b, i) => (
        <mesh key={i} geometry={b.geometry} material={b.material} castShadow={shadows} receiveShadow />
      ))}
    </group>
  );
}

/** Start fetching every model as soon as the 3D scene's code loads. */
export function preloadModels(): void {
  for (const url of Object.values(MODELS)) void loadModel(url);
}
