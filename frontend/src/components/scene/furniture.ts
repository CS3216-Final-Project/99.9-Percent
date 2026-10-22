import * as THREE from "three";
import { CHAIR_OFFSET, GLASS_H } from "./floorplan";
import type { ModelId } from "./modelCatalog";
import type { Placement } from "./models";
import { FURNITURE } from "./palette";
import { MAC, MAC_COLOUR_NAMES, type PropItem } from "./propModels";
import { bx, type Prim, type V3 } from "./shapes";

/*
 * Helpers both floors furnish with (Office.tsx and ServerFloor.tsx): placing models, props and prims, desks and their
 * Macs, bookshelves and glass partitions. Kept apart from the components so the room can be edited live.
 */

const WOOD_DARK = FURNITURE.woodDark;
const ALU = FURNITURE.alu;
const BOOKS = ["#ff4d5e", "#4cb8ff", "#ffc53d", "#3ddc84", "#a985ff", "#ff9f43", "#f4f1ea", "#2dd4bf", "#ff7ad9"];

/** Where a point in a group's own frame ends up once the group is placed at (x, z) and turned by rot. */
export function at(x: number, z: number, rot: number, l: V3): V3 {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return [x + l[0] * c + l[2] * s, l[1], z - l[0] * s + l[2] * c];
}

/** Deterministic pseudo-random, so the office looks the same on every load. */
export function rand(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** A bookshelf against a wall, facing +z. */
export function shelf(w: number, h: number, seed: number): Prim[] {
  const out: Prim[] = [
    bx([0, h / 2, -0.18], [w, h, 0.04], WOOD_DARK),
    bx([-w / 2, h / 2, 0], [0.04, h, 0.4], WOOD_DARK),
    bx([w / 2, h / 2, 0], [0.04, h, 0.4], WOOD_DARK),
  ];
  const rows = Math.round(h / 0.45);
  for (let r = 0; r <= rows; r++) out.push(bx([0, (r * h) / rows, 0], [w, 0.04, 0.4], WOOD_DARK));
  for (let r = 0; r < rows; r++) {
    let x = -w / 2 + 0.06;
    let n = 0;
    while (x < w / 2 - 0.12) {
      const bw = 0.05 + rand(seed + r * 31 + n) * 0.06;
      const bh = 0.24 + rand(seed + r * 17 + n * 3) * 0.12;
      if (rand(seed + n * 7 + r) > 0.12) out.push(bx([x + bw / 2, (r * h) / rows + 0.02 + bh / 2, 0], [bw, bh, 0.26], BOOKS[Math.floor(rand(seed + n + r * 5) * BOOKS.length)]));
      x += bw + 0.01;
      n++;
    }
  }
  return out;
}

/** The aluminium rails and posts of glass partition runs. */
export function glassFrames(runs: [number, number, number, number][]): Prim[] {
  const out: Prim[] = [];
  for (const [x1, z1, x2, z2] of runs) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const alongX = z1 === z2;
    const mid: V3 = [(x1 + x2) / 2, 0, (z1 + z2) / 2];
    const rail = (y: number, h: number) => bx([mid[0], y, mid[2]], alongX ? [len, h, 0.08] : [0.08, h, len], ALU);
    out.push(rail(0.04, 0.08), rail(GLASS_H, 0.08));
    const posts = Math.max(1, Math.round(len / 2.2));
    for (let i = 0; i <= posts; i++) {
      const f = i / posts;
      out.push(bx([x1 + (x2 - x1) * f, GLASS_H / 2, z1 + (z2 - z1) * f], [0.07, GLASS_H, 0.07], ALU));
    }
  }
  return out;
}

export const GLASS_MATERIAL = new THREE.MeshStandardMaterial({ color: "#a8d8ff", transparent: true, opacity: 0.14, roughness: 0.1, metalness: 0, depthWrite: false, side: THREE.DoubleSide });

export function mdl(id: ModelId, x: number, z: number, rot = 0, s?: number | V3, y = 0): Placement {
  return { id, p: [x, y, z], rot, s };
}

export function atop(under: Placement, pl: Placement): Placement {
  return { ...pl, on: under };
}

/** Models built around the origin, placed at (x, z) and turned by rot. */
export function placeModels(items: Placement[], x: number, z: number, rot = 0): Placement[] {
  const placed = new Map<Placement, Placement>();
  for (const it of items) placed.set(it, { ...it, p: at(x, z, rot, it.p), rot: (it.rot ?? 0) + rot });
  return items.map((it) => {
    const copy = placed.get(it)!;
    return it.on ? { ...copy, on: placed.get(it.on) ?? it.on } : copy;
  });
}

export const DESK_TOP = 0.74;
/** The picture on a desk's Mac relative to its desk: centre height, front face and size. */
export const PANEL = { y: DESK_TOP + MAC.displayY, z: -0.168, w: MAC.screenW, h: MAC.screenH };

const DESK_PLANTS: [ModelId, number][] = [
  ["plantSmall1", 1],
  ["cactusSmallA", 0.7],
  ["plantSmall3", 1],
  ["cactusSmallB", 0.7],
];

/**
 * A desk facing -z with its chair on the +z side, unless whoever works there is too big for a chair. Its Macs come
 * from `deskGear`; their pictures are drawn by `Staff`.
 */
export function deskModels(w: number, i: number, chair = true): Placement[] {
  const out = [mdl("desk", 0, 0, 0, [w, DESK_TOP, 0.78]), ...(chair ? [mdl("chairDesk", 0, CHAIR_OFFSET, Math.PI)] : [])];
  if (i % 2 === 1) {
    const [id, s] = DESK_PLANTS[(i >> 1) % DESK_PLANTS.length];
    out.push(mdl(id, -w / 2 + 0.2, -0.18, i, s, DESK_TOP));
  }
  return out;
}

/** The Macs, keyboard and mouse on a desk, in the desk's frame. Each desk gets its own colour. */
export function deskGear(i: number, monitors = 1): PropItem[] {
  const variant = MAC_COLOUR_NAMES[(i * 3) % MAC_COLOUR_NAMES.length];
  const xs = monitors === 1 ? [0] : [-0.45, 0.45];
  return [
    // Each Mac stands just behind where its picture is drawn.
    ...xs.map((x): PropItem => ({ kind: "imac", variant, p: [x, DESK_TOP, PANEL.z - MAC.gap] })),
    { kind: "keyboard", variant, p: [0, DESK_TOP, 0.14] },
    { kind: "mouse", variant, p: [0.36, DESK_TOP, 0.16] },
  ];
}

/** Props built around the origin, placed at (x, z) and turned by rot. */
export function placeProps(items: PropItem[], x: number, z: number, rot = 0): PropItem[] {
  return items.map((it) => ({ ...it, p: at(x, z, rot, it.p), rot: (it.rot ?? 0) + rot }));
}

/** For things drawn in the room that clicks should pass through. */
export const ignoreRay = () => {};
