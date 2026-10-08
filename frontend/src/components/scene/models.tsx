"use client";

import { useLoader } from "@react-three/fiber";
import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { V3 } from "./prims";

/*
 * Furniture models from two CC0 packs, Kenney's Furniture Kit (kenney.nl) and
 * KayKit Furniture Bits (kaylousberg.com); the licences sit beside the files in
 * public/models. Every copy of a model is drawn with one instanced mesh per
 * material, so a room full of desks costs a few draw calls.
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

/** Matte Lambert versions of the packs' materials, which cost far less per pixel than physically based shading. */
const matte = new Map<THREE.Material, THREE.Material>();
function toMatte(source: THREE.Material): THREE.Material {
  let m = matte.get(source);
  if (!m) {
    const s = source as THREE.MeshStandardMaterial;
    m = new THREE.MeshLambertMaterial({ color: s.color, map: s.map, vertexColors: s.vertexColors, transparent: s.transparent, opacity: s.opacity, side: s.side });
    matte.set(source, m);
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

function PartInstances({ part, matrices, shadows }: { part: Part; matrices: THREE.Matrix4[]; shadows: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [matrices]);
  return <instancedMesh key={matrices.length} ref={ref} args={[part.geometry, part.material, matrices.length]} castShadow={shadows} receiveShadow />;
}

function ModelInstances({ id, placements, shadows }: { id: ModelId; placements: Placement[]; shadows: boolean }) {
  // Neither pack is compressed, so three's plain loader is enough.
  const { scene } = useLoader(GLTFLoader, MODELS[id]);
  const prep = useMemo(() => prepare(MODELS[id], scene), [id, scene]);
  const matrices = useMemo(() => placements.map((pl) => matrixFor(pl, prep)), [placements, prep]);
  return (
    <>
      {prep.parts.map((part, i) => (
        <PartInstances key={i} part={part} matrices={matrices} shadows={shadows} />
      ))}
    </>
  );
}

/** Draw placed models; each model loads on its own, so the rest of the room never waits for it. */
export function ModelBatch({ placements, shadows = true }: { placements: Placement[]; shadows?: boolean }) {
  const byId = useMemo(() => {
    const out = new Map<ModelId, Placement[]>();
    for (const p of placements) out.set(p.id, [...(out.get(p.id) ?? []), p]);
    return [...out.entries()];
  }, [placements]);
  return (
    <group>
      {byId.map(([id, list]) => (
        <Suspense key={id} fallback={null}>
          <ModelInstances id={id} placements={list} shadows={shadows} />
        </Suspense>
      ))}
    </group>
  );
}

/** Start fetching every model as soon as the 3D scene's code loads. */
export function preloadModels(): void {
  for (const url of Object.values(MODELS)) useLoader.preload(GLTFLoader, url);
}
