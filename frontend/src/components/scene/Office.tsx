"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { deskSlot, POS, ROOM } from "./layout";
import { look, Person, Walker, type Activity } from "./people";
import { ball, bx, cone, cy, place, PrimBatch, type Prim, type V3 } from "./prims";
import { carpet, floorTiles, kitchenTiles, logoSign, screenTexture, skyline, whiteboard, woodFloor, type ScreenKind } from "./textures";
import { OnWall } from "./walls";

/*
 * Everything human in the building. The equipment sits on a glass-walled
 * server floor in the middle; around it are the engineering pods, the release
 * and growth desks, a monitoring room, a network and power room, townhall
 * steps, a library, a meeting room, reception, a kitchen, a dining table, a
 * lounge with games, and the people who use them.
 *
 * Static furniture is data (see prims.tsx) drawn in a few instanced meshes.
 * Only screens, glass, signs and moving things are separate meshes.
 */

const INK = "#1d1834";
const TRIM = "#2a2450";
const STEEL = "#34305c";
const WOOD = "#c98b55";
const WOOD_DARK = "#8a5a3c";
const CHAIR = "#ff9f43";
const LILAC = "#e8e4ff";
const PALE = "#d9d4f0";
const WHITE = "#f4f1ea";
const ALU = "#b9b2d9";
const MUGS = ["#4cb8ff", "#ff7ad9", "#3ddc84", "#ffc53d", "#a985ff", "#ff9f43"];
const BOOKS = ["#ff4d5e", "#4cb8ff", "#ffc53d", "#3ddc84", "#a985ff", "#ff9f43", "#f4f1ea", "#2dd4bf", "#ff7ad9"];

/** Where a point in a group's own frame ends up once the group is placed at (x, z) and turned by rot. */
function at(x: number, z: number, rot: number, l: V3): V3 {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return [x + l[0] * c + l[2] * s, l[1], z - l[0] * s + l[2] * c];
}

/** Deterministic pseudo-random, so the office looks the same on every load. */
function rand(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/* ------------------------------------------------------------------ */
/* Furniture, as prims around their own origin                          */
/* ------------------------------------------------------------------ */

function plant(k = 1): Prim[] {
  return [
    cy([0, 0.2 * k, 0], 0.48 * k, 0.4 * k, "#c96b4a"),
    cy([0, 0.41 * k, 0], 0.44 * k, 0.03 * k, "#3b2a1e"),
    cone([0, 0.85 * k, 0], 0.84 * k, 0.95 * k, "#2f9e5f"),
    cone([0.12 * k, 1.3 * k, -0.05 * k], 0.56 * k, 0.7 * k, "#3ddc84"),
    cone([-0.16 * k, 1.05 * k, 0.1 * k], 0.44 * k, 0.55 * k, "#26834e"),
  ];
}

/** A leafy floor plant in a white pot. */
function bush(k = 1): Prim[] {
  return [
    cy([0, 0.22 * k, 0], 0.46 * k, 0.44 * k, WHITE),
    ball([0, 0.68 * k, 0], [0.7 * k, 0.55 * k, 0.7 * k], "#2f9e5f"),
    ball([0.2 * k, 0.95 * k, 0.05 * k], [0.45 * k, 0.4 * k, 0.45 * k], "#3ddc84"),
    ball([-0.18 * k, 0.9 * k, -0.1 * k], [0.4 * k, 0.36 * k, 0.4 * k], "#26834e"),
  ];
}

function chair(color = CHAIR): Prim[] {
  return [
    bx([0, 0.46, 0], [0.48, 0.08, 0.46], color),
    bx([0, 0.8, 0.21], [0.46, 0.5, 0.06], color),
    cy([0, 0.24, 0], 0.08, 0.42, INK),
    cy([0, 0.035, 0], 0.5, 0.04, INK),
  ];
}

/** A desk facing -z with its chair on the +z side. The monitors' screens are drawn separately. */
function desk(w: number, i: number, monitors = 1): Prim[] {
  const out: Prim[] = [
    bx([0, 0.74, 0], [w, 0.05, 0.8], WOOD),
    bx([-(w / 2 - 0.04), 0.37, 0], [0.05, 0.72, 0.72], TRIM),
    bx([w / 2 - 0.04, 0.37, 0], [0.05, 0.72, 0.72], TRIM),
    bx([0, 0.45, -0.36], [w - 0.1, 0.5, 0.03], TRIM),
    bx([0, 0.775, 0.2], [0.46, 0.02, 0.15], INK),
    bx([0.34, 0.772, 0.22], [0.07, 0.02, 0.1], INK),
    cy([w / 2 - 0.2, 0.81, 0.08], 0.09, 0.09, MUGS[(i * 4 + 2) % MUGS.length]),
    ...place(chair(), 0, 0.72),
  ];
  const xs = monitors === 1 ? [0] : [-0.45, 0.45];
  for (const x of xs) {
    out.push(bx([x, 0.87, -0.22], [0.07, 0.2, 0.07], INK), bx([x, 0.77, -0.22], [0.25, 0.02, 0.18], INK), bx([x, 1.13, -0.2], [0.67, 0.43, 0.045], INK));
  }
  if (i % 2 === 0) out.push(bx([-w / 2 + 0.3, 0.768, 0.12], [0.22, 0.01, 0.3], "#fff7e8", [0, 0.25, 0]));
  if (i % 3 === 1) out.push(...place(plant(0.28), -w / 2 + 0.2, -0.2, 0, 0.765));
  return out;
}

/** A sofa whose seat faces +z. */
function sofa(w: number, color: string): Prim[] {
  const dark = `#${new THREE.Color(color).multiplyScalar(0.82).getHexString()}`;
  const light = `#${new THREE.Color(color).multiplyScalar(1.12).getHexString()}`;
  return [
    bx([0, 0.2, 0], [w, 0.36, 0.86], color),
    bx([-w / 4, 0.44, 0.08], [w / 2 - 0.04, 0.12, 0.7], light),
    bx([w / 4, 0.44, 0.08], [w / 2 - 0.04, 0.12, 0.7], light),
    bx([0, 0.66, -0.33], [w, 0.56, 0.22], color),
    bx([-w / 2 + 0.1, 0.38, 0], [0.2, 0.5, 0.86], dark),
    bx([w / 2 - 0.1, 0.38, 0], [0.2, 0.5, 0.86], dark),
    bx([w / 2 - 0.4, 0.6, -0.15], [0.4, 0.3, 0.14], "#ffc53d", [-0.2, 0.2, 0]),
  ];
}

function armchair(color: string): Prim[] {
  return [
    bx([0, 0.22, 0], [0.9, 0.4, 0.84], color),
    bx([0, 0.66, -0.32], [0.9, 0.5, 0.2], color),
    bx([-0.4, 0.42, 0], [0.12, 0.4, 0.84], color),
    bx([0.4, 0.42, 0], [0.12, 0.4, 0.84], color),
    bx([0, 0.45, 0.06], [0.66, 0.1, 0.66], WHITE),
  ];
}

function coffeeTable(w = 1.2, d = 0.6): Prim[] {
  return [
    bx([0, 0.42, 0], [w, 0.06, d], WOOD),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => bx([(sx * (w - 0.12)) / 2, 0.2, (sz * (d - 0.12)) / 2], [0.06, 0.4, 0.06], TRIM))),
  ];
}

function pizza(): Prim[] {
  return [
    bx([0, 0.025, 0], [0.46, 0.05, 0.46], "#e9d3a8", [0, 0.2, 0]),
    bx([0.03, 0.08, 0.02], [0.46, 0.05, 0.46], "#e9d3a8", [0, -0.15, 0]),
    bx([0.03, 0.108, 0.02], [0.2, 0.008, 0.2], "#ff4d5e", [0, -0.15, 0]),
    cy([0.42, 0.065, -0.1], 0.08, 0.13, "#ff4d5e"),
    cy([0.5, 0.065, 0.12], 0.08, 0.13, "#3ddc84"),
  ];
}

/** A bookshelf against a wall, facing +z. */
function shelf(w: number, h: number, seed: number): Prim[] {
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

function stool(): Prim[] {
  return [cy([0, 0.72, 0], 0.38, 0.06, CHAIR), cy([0, 0.36, 0], 0.06, 0.7, INK), cy([0, 0.015, 0], 0.32, 0.03, INK)];
}

/** Arcade cabinet facing +z. Its screen is drawn separately. */
function arcade(color: string): Prim[] {
  return [
    bx([0, 0.9, 0], [0.72, 1.8, 0.75], color),
    bx([0, 1.25, 0.39], [0.6, 0.5, 0.04], INK, [-0.2, 0, 0]),
    bx([0, 0.93, 0.42], [0.66, 0.08, 0.3], INK),
    cy([-0.15, 0.99, 0.45], 0.04, 0.08, "#ff4d5e"),
    cy([0.1, 0.98, 0.45], 0.05, 0.03, "#ffd84a"),
    cy([0.22, 0.98, 0.45], 0.05, 0.03, "#4cb8ff"),
    bx([0, 1.68, 0.3], [0.66, 0.2, 0.22], "#ffd84a"),
  ];
}

function pingPong(): Prim[] {
  return [
    bx([0, 0.76, 0], [2.74, 0.06, 1.52], "#1f7a5c"),
    bx([0, 0.795, 0.745], [2.74, 0.012, 0.03], "#fff7e8"),
    bx([0, 0.795, -0.745], [2.74, 0.012, 0.03], "#fff7e8"),
    bx([1.355, 0.795, 0], [0.03, 0.012, 1.52], "#fff7e8"),
    bx([-1.355, 0.795, 0], [0.03, 0.012, 1.52], "#fff7e8"),
    bx([0, 0.795, 0], [2.74, 0.012, 0.015], "#fff7e8"),
    bx([0, 0.87, 0], [0.02, 0.15, 1.64], LILAC),
    ...[-1.1, 1.1].flatMap((dx) => [-0.6, 0.6].map((dz) => bx([dx, 0.37, dz], [0.07, 0.74, 0.07], TRIM))),
    cy([-0.9, 0.8, 0.45], 0.18, 0.02, "#ff4d5e"),
    cy([0.95, 0.8, -0.4], 0.18, 0.02, INK),
  ];
}

/** A phone booth facing +z, glazed at the front. */
function booth(color: string): Prim[] {
  return [
    bx([0, 1.15, -0.55], [1.2, 2.3, 0.08], color),
    bx([-0.6, 1.15, 0], [0.08, 2.3, 1.2], color),
    bx([0.6, 1.15, 0], [0.08, 2.3, 1.2], color),
    bx([0, 2.32, 0], [1.28, 0.08, 1.28], color),
    bx([0, 0.45, -0.3], [0.9, 0.08, 0.4], WHITE),
    bx([0, 0.02, 0], [1.2, 0.04, 1.2], TRIM),
    bx([0.3, 1.0, -0.45], [0.3, 0.2, 0.12], WOOD),
  ];
}

function rug(w: number, d: number, outer: string, inner: string): Prim[] {
  return [bx([0, 0.007, 0], [w, 0.012, d], outer), bx([0, 0.009, 0], [w - 0.4, 0.013, d - 0.4], inner)];
}

function floorLamp(): Prim[] {
  return [cy([0, 0.85, 0], 0.05, 1.7, TRIM), cy([0, 0.02, 0], 0.4, 0.04, TRIM), cone([0, 1.75, 0], 0.55, 0.32, "#ffe3b0")];
}

/* ------------------------------------------------------------------ */
/* The whole floor plan                                                */
/* ------------------------------------------------------------------ */

/** Glass partition runs as [x1, z1, x2, z2]. Gaps for doors are already left out. */
const GLASS: [number, number, number, number][] = [
  // Server floor
  [-13, 5, -2.0, 5],
  [-0.8, 5, 9, 5],
  [9, -4.6, 9, -0.2],
  [9, 1.0, 9, 5],
  [-13, -9.5, -13, -0.6],
  [-13, 0.6, -13, 5],
  // Monitoring room
  [5.5, -9.5, 5.5, -4.6],
  [5.5, -4.6, 9.6, -4.6],
  [10.6, -4.6, 11.5, -4.6],
  [11.5, -9.5, 11.5, -4.6],
  // Network and power room
  [-22, -1, -15.2, -1],
  [-14.0, -1, -13, -1],
  // Meeting room
  [-13, 10.2, -6.8, 10.2],
  [-5.9, 10.2, -5.5, 10.2],
  [-5.5, 10.2, -5.5, 14.5],
  [-13, 10.2, -13, 14.5],
];

const GLASS_H = 2.6;

function glassFrames(): Prim[] {
  const out: Prim[] = [];
  for (const [x1, z1, x2, z2] of GLASS) {
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

const GLASS_MATERIAL = new THREE.MeshStandardMaterial({ color: "#a8d8ff", transparent: true, opacity: 0.14, roughness: 0.1, metalness: 0, depthWrite: false, side: THREE.DoubleSide });

function Glass() {
  return (
    <group>
      {GLASS.map(([x1, z1, x2, z2], i) => {
        const len = Math.hypot(x2 - x1, z2 - z1);
        return (
          <mesh key={i} position={[(x1 + x2) / 2, GLASS_H / 2, (z1 + z2) / 2]} rotation={[0, z1 === z2 ? 0 : Math.PI / 2, 0]} material={GLASS_MATERIAL}>
            <planeGeometry args={[len, GLASS_H - 0.08]} />
          </mesh>
        );
      })}
      {/* Phone booth fronts */}
      {[-16.2, -14.8].map((x) => (
        <mesh key={x} position={[x, 1.15, 14.2]} material={GLASS_MATERIAL}>
          <planeGeometry args={[1.12, 2.2]} />
        </mesh>
      ))}
    </group>
  );
}

/** Everything that never moves, as one list of prims. */
function buildStatic(): Prim[] {
  const out: Prim[] = [...glassFrames()];
  const add = (prims: Prim[], x: number, z: number, rot = 0, y = 0) => out.push(...place(prims, x, z, rot, y));

  // Engineering pods: all eight desks, so the office has room to grow.
  for (let i = 0; i < 8; i++) {
    const s = deskSlot(i);
    add(desk(1.55, i), s.x, s.z, s.rot);
  }
  add(plant(), -12.4, 5.6);
  add(plant(), -12.4, 9.5);
  add([bx([0, 0.45, 0], [0.06, 0.9, 1.3], ALU), bx([0, 1.4, 0], [0.04, 1.1, 2.1], ALU)], -12.32, 7.4);

  // Release console and the growth desk
  add([bx([0, 0.5, 0], [1.5, 1, 0.8], STEEL), bx([0, 1.28, -0.12], [1.17, 0.69, 0.05], INK, [-0.35, 0, 0]), bx([0.95, 0.6, 0.05], [0.3, 1.2, 0.6], TRIM)], POS.deploy.x, POS.deploy.z);
  add(desk(2.2, 9, 2), POS.growth.x - 0.4, POS.growth.z + 0.2);
  add([cy([0, 0.55, 0], 0.08, 1.1, INK), bx([0, 1.5, 0], [1.27, 0.82, 0.05], INK)], POS.growth.x + 1.15, POS.growth.z - 0.55);
  add(plant(), 2.2, 8.9);
  add(bush(), 8.9, 5.6);

  // Monitoring room: the on-call desk faces the screens
  add(desk(1.8, 12, 2), 8.2, -6.9);
  add(rug(4.4, 2.4, "#26335e", "#2f3f73"), 8.4, -6.6);

  // Server floor: cooling units, an extinguisher, a crash cart, boxes, floor vents
  for (const z of [-2.6, 2.2]) {
    add(
      [
        bx([0, 1.0, 0], [0.9, 2.0, 1.4], "#cbc4ea"),
        ...Array.from({ length: 7 }, (_, i) => bx([0.46, 0.45 + i * 0.18, 0], [0.02, 0.06, 1.1], "#5d5399")),
        bx([0.47, 1.75, -0.35], [0.02, 0.18, 0.3], INK),
        bx([0.48, 1.75, -0.35], [0.01, 0.06, 0.1], "#3ddc84"),
      ],
      -12.45,
      z,
    );
  }
  add([cy([0, 0.3, 0], 0.2, 0.55, "#ff4d5e"), cy([0, 0.62, 0], 0.08, 0.1, INK)], -12.6, 4.4);
  add(
    [
      bx([0, 0.27, 0], [0.8, 0.04, 0.55], ALU),
      bx([0, 0.77, 0], [0.8, 0.04, 0.55], ALU),
      ...[-0.37, 0.37].flatMap((dx) => [-0.24, 0.24].map((dz) => bx([dx, 0.42, dz], [0.04, 0.7, 0.04], "#5d5399"))),
      ...[-0.33, 0.33].flatMap((dx) => [-0.2, 0.2].map((dz) => cy([dx, 0.06, dz], 0.12, 0.05, INK))),
      bx([0, 0.8, 0.02], [0.4, 0.02, 0.28], PALE),
      bx([0, 0.93, -0.12], [0.4, 0.24, 0.02], PALE, [-0.3, 0, 0]),
      bx([0.2, 0.33, 0], [0.3, 0.12, 0.3], CHAIR),
    ],
    5.3,
    -2.6,
    0.4,
  );
  add([bx([0, 0.22, 0], [0.7, 0.44, 0.55], "#c9a272"), bx([0.05, 0.6, 0.02], [0.6, 0.32, 0.5], "#d4ae7e", [0, 0.15, 0]), bx([0.75, 0.18, 0.15], [0.55, 0.36, 0.45], "#c9a272", [0, -0.3, 0])], 7.5, -4.2);
  for (const [x, z] of [
    [-3.5, -4.95],
    [-0.9, -4.95],
    [4.3, -4.2],
    [6.4, -1.0],
    [0.9, 0.6],
  ]) {
    out.push(bx([x, 0.006, z], [0.86, 0.012, 0.86], "#8f87c9"));
    for (let i = 0; i < 16; i++) out.push(bx([x - 0.3 + (i % 4) * 0.2, 0.013, z - 0.3 + Math.floor(i / 4) * 0.2], [0.07, 0.004, 0.07], TRIM));
  }

  // Network and power room: batteries, UPS cabinets, fire suppression and a patch panel
  for (const z of [-8.6, -7.6, -6.6]) {
    add([bx([0, 0.95, 0], [0.9, 1.9, 0.95], LILAC), bx([0.46, 1.5, 0.1], [0.02, 0.14, 0.32], "#3ddc84"), ...Array.from({ length: 5 }, (_, i) => bx([0.46, 0.35 + i * 0.12, 0], [0.02, 0.05, 0.7], ALU))], -21.45, z);
  }
  for (const x of [-19.0, -17.0]) {
    out.push(bx([x, 0.8, -9.1], [1.7, 1.6, 0.04], ALU));
    for (let r = 0; r < 3; r++) {
      out.push(bx([x, 0.1 + r * 0.55, -8.95], [1.7, 0.04, 0.55], "#5d5399"));
      for (let c = 0; c < 6; c++) {
        out.push(bx([x - 0.68 + c * 0.27, 0.32 + r * 0.55, -8.95], [0.22, 0.36, 0.42], INK));
        out.push(bx([x - 0.72 + c * 0.27, 0.51 + r * 0.55, -9.05], [0.04, 0.03, 0.04], c % 2 ? "#ff4d5e" : INK));
      }
    }
  }
  add([cy([0, 0.8, 0], 0.5, 1.6, "#ff4d5e"), ball([0, 1.6, 0], [0.5, 0.3, 0.5], "#ff4d5e"), cy([0, 1.85, 0], 0.08, 0.2, ALU)], -14.2, -8.9);
  add([bx([0, 1.0, 0], [0.62, 2.0, 0.62], INK), ...Array.from({ length: 8 }, (_, i) => bx([0, 0.4 + i * 0.18, 0.32], [0.5, 0.06, 0.01], i % 3 ? "#3ddc84" : "#ffd84a"))], -14.3, -6.6);
  out.push(bx([-21.0, 0.008, -7.6], [0.06, 0.012, 3.6], "#ffc53d"), bx([-20.0, 0.008, -5.8], [2.0, 0.012, 0.06], "#ffc53d"));

  // Townhall steps facing a screen
  [
    [-21.3, 1.6],
    [-20.1, 1.2],
    [-18.9, 0.8],
    [-17.7, 0.4],
  ].forEach(([x, h], tier) => {
    out.push(bx([x, h / 2, 4.5], [1.2, h, 6.6], tier % 2 ? WOOD : WOOD_DARK));
    for (let k = 0; k < 4; k++) {
      if (rand(tier * 9 + k) > 0.35) out.push(bx([x + 0.1, h + 0.05, 2.2 + k * 1.5], [0.6, 0.1, 0.6], MUGS[(tier + k) % MUGS.length]));
    }
  });
  add([bx([0, 0.45, 0], [0.4, 0.9, 1.4], TRIM), bx([0, 1.5, 0], [0.08, 1.22, 2.3], INK)], -14.3, 4.5);

  // Library corner
  add(shelf(1.9, 2.0, 11), -21.75, 10.6, Math.PI / 2);
  add(shelf(1.9, 2.0, 23), -21.75, 12.7, Math.PI / 2);
  add(rug(3.2, 2.6, "#6b4aa0", "#7d5bb8"), -19.2, 11.6);
  add(armchair("#4cb8ff"), -19.6, 10.8, Math.PI / 2);
  add(armchair("#ff7ad9"), -18.4, 12.5, Math.PI);
  add(coffeeTable(0.7, 0.7), -19.1, 11.9);
  add(floorLamp(), -20.9, 13.7);
  add(bush(), -14.0, 9.5);

  // Phone booths
  add(booth("#3e3570"), -16.2, 13.6);
  add(booth("#a985ff"), -14.8, 13.6);

  // Meeting room
  add([bx([0, 0.74, 0], [3.4, 0.06, 1.3], WHITE), bx([-1.3, 0.37, 0], [0.08, 0.72, 0.9], TRIM), bx([1.3, 0.37, 0], [0.08, 0.72, 0.9], TRIM)], -9.2, 12.35);
  for (const x of [-10.4, -9.2, -8.0]) {
    add(chair("#4cb8ff"), x, 11.42, Math.PI);
    add(chair("#4cb8ff"), x, 13.28);
  }
  add([bx([0, 0.45, 0], [0.4, 0.9, 1.2], TRIM), bx([0, 1.35, 0], [0.08, 0.95, 1.6], INK)], -12.7, 12.35);
  add(plant(), -6.0, 14.0);

  // Reception and a waiting area by the front door
  add(
    [
      bx([0, 0.525, 0], [3.2, 1.05, 0.7], WHITE),
      bx([0, 1.075, 0.02], [3.3, 0.05, 0.8], WOOD),
      bx([0, 0.74, -0.52], [3.0, 0.04, 0.36], WOOD),
      bx([0, 1.0, -0.5], [0.55, 0.33, 0.04], INK),
      bx([0, 0.84, -0.5], [0.06, 0.16, 0.06], INK),
      ...place(chair("#3e3570"), 0, -1.0, Math.PI),
      bx([0.9, 1.12, 0.1], [0.3, 0.06, 0.2], "#ff7ad9"),
    ],
    3.2,
    12.3,
  );
  add(armchair("#2dd4bf"), -3.2, 12.6, Math.PI / 2);
  add(armchair("#2dd4bf"), -1.2, 12.6, -Math.PI / 2);
  add([...coffeeTable(0.8, 0.8), bx([0.1, 0.46, 0], [0.3, 0.02, 0.4], "#ffc53d", [0, 0.3, 0])], -2.2, 12.6);
  add(bush(1.1), -4.4, 13.9);
  add(plant(), 6.4, 13.9);
  out.push(bx([3.2, 0.006, 13.95], [1.8, 0.012, 1.0], TRIM));

  // Corridor and product corner
  add(shelf(2.4, 1.1, 37), 11.6, 5.45);
  add(bush(), 13.9, 9.6);
  add(plant(), 13.9, -4.0);
  add(plant(0.8), 9.6, 4.4);
  add([bx([0, 0.95, 0], [0.9, 1.9, 0.8], "#ff4d5e"), bx([0, 1.25, 0.41], [0.6, 0.9, 0.02], "#a8d8ff"), bx([0, 0.35, 0.41], [0.6, 0.12, 0.02], INK)], 12.6, -9.0);
  add([bx([0, 0.95, 0], [0.9, 1.9, 0.8], "#4cb8ff"), bx([0, 1.25, 0.41], [0.6, 0.9, 0.02], "#a8d8ff"), bx([0, 0.35, 0.41], [0.6, 0.12, 0.02], INK)], 13.7, -9.0);
  add([bx([0, 0.22, 0], [1.6, 0.06, 0.45], WOOD), bx([-0.7, 0.1, 0], [0.06, 0.2, 0.4], TRIM), bx([0.7, 0.1, 0], [0.06, 0.2, 0.4], TRIM)], 14.0, 1.6, Math.PI / 2);

  // Kitchen
  out.push(bx([18.8, 0.45, -9.18], [5.6, 0.9, 0.6], WOOD), bx([18.8, 0.93, -9.18], [5.64, 0.06, 0.64], TRIM));
  for (let i = 0; i < 7; i++) out.push(bx([16.4 + i * 0.8, 0.55, -8.875], [0.04, 0.3, 0.02], TRIM));
  out.push(bx([21.5, 0.45, -6.9], [0.6, 0.9, 3.4], WOOD), bx([21.5, 0.93, -6.9], [0.64, 0.06, 3.44], TRIM));
  out.push(bx([19.6, 0.965, -9.2], [0.6, 0.02, 0.4], ALU), cy([19.6, 1.12, -9.4], 0.04, 0.3, ALU));
  out.push(bx([17.0, 1.17, -9.25], [0.32, 0.42, 0.32], INK), bx([17.08, 1.3, -9.08], [0.05, 0.05, 0.02], "#ff4d5e"), cy([17.25, 1.01, -9.05], 0.09, 0.09, "#ffc53d"), cy([17.4, 1.01, -9.12], 0.09, 0.09, "#4cb8ff"));
  out.push(bx([20.9, 1.1, -9.24], [0.55, 0.3, 0.38], PALE), bx([20.83, 1.1, -9.04], [0.32, 0.2, 0.01], INK));
  out.push(bx([21.45, 1.2, -7.2], [0.3, 0.5, 0.3], "#3ddc84"), ball([21.45, 1.02, -6.3], [0.4, 0.14, 0.4], WHITE));
  add([bx([0, 0.95, 0], [0.7, 1.9, 0.66], LILAC), bx([0, 1.3, 0.34], [0.66, 0.02, 0.02], ALU), bx([0.28, 1.0, 0.35], [0.04, 0.4, 0.04], "#8f87c9"), bx([0.28, 1.55, 0.35], [0.04, 0.2, 0.04], "#8f87c9")], 15.15, -9.12);
  out.push(bx([18.4, 0.47, -6.2], [2.6, 0.94, 1.0], PALE), bx([18.4, 0.97, -6.2], [2.8, 0.06, 1.15], WOOD));
  out.push(ball([18.9, 1.05, -6.2], [0.36, 0.12, 0.36], WHITE), ball([18.85, 1.12, -6.15], [0.1, 0.1, 0.1], "#ff4d5e"), ball([18.98, 1.12, -6.25], [0.1, 0.1, 0.1], "#ffc53d"));
  for (const x of [17.6, 18.4, 19.2]) add(stool(), x, -5.35);
  add([bx([0, 0.5, 0], [0.38, 1.0, 0.38], LILAC), cy([0, 1.22, 0], 0.32, 0.42, "#4cb8ff")], 15.0, -4.0);

  // Dining table with the remains of pizza night
  out.push(bx([18.5, 0.75, 0], [4.2, 0.06, 1.1], WOOD));
  for (const x of [16.6, 20.4]) out.push(bx([x, 0.37, 0], [0.08, 0.72, 0.9], TRIM));
  for (const z of [-0.85, 0.85]) out.push(bx([18.5, 0.45, z], [4.0, 0.08, 0.36], WOOD_DARK), bx([16.8, 0.22, z], [0.06, 0.44, 0.3], TRIM), bx([20.2, 0.22, z], [0.06, 0.44, 0.3], TRIM));
  add(pizza(), 17.8, -0.1, 0, 0.78);
  add(pizza(), 19.4, 0.15, 1.2, 0.78);
  add(bush(), 15.0, 2.6);
  add(bush(0.9), 21.4, -2.6);

  // Lounge: a sofa facing a games console
  add(rug(5.0, 4.6, "#6b4aa0", "#7d5bb8"), 18.4, 6.5);
  add([bx([0, 0.25, 0], [0.5, 0.5, 2.4], WOOD_DARK), bx([0.05, 1.15, 0], [0.08, 1.0, 1.8], INK), bx([0.1, 0.56, 0.6], [0.3, 0.08, 0.36], PALE), bx([0.26, 0.56, 0.6], [0.02, 0.03, 0.2], "#3ddc84")], 15.4, 6.5);
  add(sofa(2.6, "#2a9d8f"), 19.8, 6.5, -Math.PI / 2);
  add(armchair("#ff7ad9"), 17.6, 8.8, Math.PI);
  add([...coffeeTable(1.1, 0.6), bx([0.2, 0.47, 0], [0.16, 0.04, 0.1], INK), bx([-0.2, 0.47, 0.1], [0.16, 0.04, 0.1], INK)], 18.0, 6.5, Math.PI / 2);
  out.push(ball([16.9, 0.26, 4.4], [0.96, 0.58, 0.96], "#ffc53d"), ball([16.6, 0.26, 8.6], [0.96, 0.58, 0.96], "#ff7ad9"));
  add(floorLamp(), 21.3, 4.1);
  add(plant(), 21.4, 9.3);

  // Games corner
  add(pingPong(), 18.2, 12.6);
  add(arcade("#a985ff"), 20.4, 10.5);
  add(arcade("#ff4d5e"), 21.3, 10.5);
  add(plant(), 15.0, 13.9);
  return out;
}

/** Cabinets and panels fixed to a wall, drawn only while the wall stands. */
function buildWallMounted(): Record<"back" | "left", Prim[]> {
  return {
    back: [bx([16.8, 2.1, -9.3], [1.6, 0.7, 0.35], WOOD), bx([20.8, 2.1, -9.3], [1.6, 0.7, 0.35], WOOD)],
    left: [bx([-21.93, 1.5, -3.2], [0.1, 1.2, 0.9], ALU), bx([-21.87, 1.7, -3.0], [0.02, 0.2, 0.3], "#ffd84a")],
  };
}

/* ------------------------------------------------------------------ */
/* Screens, signs and other special surfaces                           */
/* ------------------------------------------------------------------ */

function ScreenPlane({ kind, w, h, position, rot = 0, tilt = 0 }: { kind: ScreenKind; w: number; h: number; position: V3; rot?: number; tilt?: number }) {
  const map = useMemo(() => screenTexture(kind), [kind]);
  const rotation = useMemo(() => new THREE.Euler(tilt, rot, 0, "YXZ"), [tilt, rot]);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={map} toneMapped={false} />
    </mesh>
  );
}

/** A window onto the city at night. Faces +z before rotation. */
function CityWindow({ position, rot = 0, w, h }: { position: V3; rot?: number; w: number; h: number }) {
  const tex = useMemo(() => skyline(), []);
  return (
    <group position={position} rotation={[0, rot, 0]}>
      <mesh>
        <boxGeometry args={[w + 0.16, h + 0.16, 0.06]} />
        <meshStandardMaterial color={TRIM} />
      </mesh>
      <mesh position={[0, 0, 0.035]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[0.06, h, 0.03]} />
        <meshStandardMaterial color={TRIM} />
      </mesh>
    </group>
  );
}

function NeonLogo({ position, rot }: { position: V3; rot: number }) {
  const tex = useMemo(() => logoSign(), []);
  return (
    <group position={position} rotation={[0, rot, 0]}>
      <mesh>
        <boxGeometry args={[3.6, 1.2, 0.05]} />
        <meshStandardMaterial color={INK} />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[3.5, 1.1]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

function WhiteboardFace({ position, rot }: { position: V3; rot: number }) {
  const tex = useMemo(() => whiteboard(), []);
  return (
    <mesh position={position} rotation={[0, rot, 0]}>
      <planeGeometry args={[2.0, 1.0]} />
      <meshStandardMaterial map={tex} roughness={0.6} />
    </mesh>
  );
}

type FloorKey = "server" | "wood" | "noc" | "meeting" | "kitchen";

/** Floor finishes by zone, as [finish, centre x, centre z, width, depth, tile size]. */
const ZONES: [FloorKey, number, number, number, number, number][] = [
  ["server", -3.75, -2.25, 18.5, 14.5, 0.9],
  ["server", 7.25, 0.2, 3.5, 9.6, 0.9],
  ["noc", 8.5, -7.05, 6, 4.9, 1.2],
  ["wood", 0.75, 7.6, 27.5, 5.2, 1.6],
  ["wood", 4.5, 12.35, 20, 4.3, 1.6],
  ["wood", -17.5, 6.75, 9, 15.5, 1.6],
  ["wood", 18.25, 5.75, 7.5, 17.5, 1.6],
  ["meeting", -9.25, 12.35, 7.5, 4.3, 1.2],
  ["kitchen", 18.25, -6.25, 7.5, 6.5, 0.8],
];

function Floors() {
  const textures = useMemo(() => {
    const base: Record<FloorKey, THREE.CanvasTexture> = {
      server: floorTiles(),
      wood: woodFloor(),
      noc: carpet("#2f3f73", "#26335e"),
      meeting: carpet("#7d5bb8", "#6b4aa0"),
      kitchen: kitchenTiles(),
    };
    return ZONES.map(([key, , , w, d, tile]) => {
      const t = base[key].clone();
      t.repeat.set(w / tile, d / tile);
      t.needsUpdate = true;
      return t;
    });
  }, []);
  return (
    <group>
      {ZONES.map(([, x, z, w, d], i) => (
        <mesh key={i} position={[x, 0.004, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[w, d]} />
          <meshLambertMaterial map={textures[i]} />
        </mesh>
      ))}
    </group>
  );
}

function PingPongBall() {
  const ball = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ball.current) return;
    // A rally that never ends: the ball crosses the net and bounces on each side.
    const t = clock.elapsedTime * 0.9;
    const f = t % 2;
    const x = f < 1 ? -1.1 + f * 2.2 : 1.1 - (f - 1) * 2.2;
    ball.current.position.set(18.2 + x, 0.82 + Math.abs(Math.sin(t * Math.PI * 2)) * 0.3, 12.6 + Math.sin(t * 1.3) * 0.35);
  });
  return (
    <mesh ref={ball}>
      <sphereGeometry args={[0.035, 8, 6]} />
      <meshBasicMaterial color="#fff7e8" />
    </mesh>
  );
}

/** Red beacon above the monitoring wall that spins up during an incident. */
function Beacon({ on }: { on: boolean }) {
  const lamp = useRef<THREE.MeshStandardMaterial>(null);
  const halo = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const pulse = on ? 0.5 + 0.5 * Math.sin(clock.elapsedTime * 8) : 0;
    if (lamp.current) lamp.current.emissiveIntensity = on ? 0.6 + pulse * 2.4 : 0.15;
    if (halo.current) halo.current.opacity = pulse * 0.45;
  });
  return (
    <group position={[5.9, 2.9, ROOM.z0 + 0.2]}>
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[0.3, 0.08, 0.3]} />
        <meshStandardMaterial color={TRIM} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <sphereGeometry args={[0.16, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial ref={lamp} color="#ff4d5e" emissive="#ff4d5e" emissiveIntensity={0.15} toneMapped={false} />
      </mesh>
      {/* A soft red glow on the wall behind it, standing in for a light. */}
      <mesh position={[0, 0, 0.02]}>
        <circleGeometry args={[1.4, 24]} />
        <meshBasicMaterial ref={halo} color="#ff4d5e" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function WallClock({ position }: { position: V3 }) {
  const hand = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (hand.current) hand.current.rotation.z = -clock.elapsedTime * 0.6;
  });
  return (
    <group position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 0.05, 16]} />
        <meshStandardMaterial color="#fff7e8" roughness={0.7} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.005]}>
        <cylinderGeometry args={[0.36, 0.36, 0.04, 16]} />
        <meshStandardMaterial color={INK} />
      </mesh>
      <mesh ref={hand} position={[0, 0, 0.04]}>
        <boxGeometry args={[0.02, 0.5, 0.01]} />
        <meshBasicMaterial color="#ff4d5e" />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

export interface Crew {
  engineers: number;
  busy: number;
  incident: boolean;
  releases: number;
  promos: number;
}

type Seat = "type" | "relax" | "mug" | "kitchen" | "lounge";

/**
 * Where engineer i is. Assigned engineers code at their desks. The first free
 * engineer is in the kitchen and the second on the lounge sofa, so idle staff
 * show up in the building. During an incident everyone is back at a keyboard.
 */
function seatFor(i: number, crew: Crew): Seat {
  if (crew.incident || i < crew.busy) return "type";
  const free = i - crew.busy;
  if (free === 0) return "kitchen";
  if (free === 1) return "lounge";
  return free % 2 ? "mug" : "relax";
}

function People({ crew }: { crew: Crew }) {
  return (
    <group>
      {Array.from({ length: 8 }, (_, i) => {
        const slot = deskSlot(i);
        const hired = i < crew.engineers;
        const seat = hired ? seatFor(i, crew) : null;
        const screen: ScreenKind = !hired ? "off" : seat === "type" ? "code" : "idle";
        return (
          <group key={i}>
            <ScreenPlane kind={screen} w={0.6} h={0.36} position={at(slot.x, slot.z, slot.rot, [0, 1.13, -0.174])} rot={slot.rot} />
            {seat && seat !== "kitchen" && seat !== "lounge" && (
              <Person pose="sit" activity={seat as Activity} look={look(i)} position={at(slot.x, slot.z, slot.rot, [0, 0, 0.72])} rotation={slot.rot} phase={i * 1.7} />
            )}
            {seat === "kitchen" && <Person pose="stand" activity="mug" look={look(i)} position={[16.6, 0, -5.7]} rotation={-2.4} phase={i} />}
            {seat === "lounge" && <Person pose="sit" activity="laptop" look={look(i)} position={[19.9, 0, 5.9]} rotation={Math.PI / 2} phase={i} />}
          </group>
        );
      })}

      {/* Release engineer, marketer, on-call engineer and receptionist */}
      <ScreenPlane kind={crew.releases > 0 ? "deploy-busy" : "deploy"} w={1.1} h={0.62} position={[POS.deploy.x, 1.28, POS.deploy.z - 0.09]} tilt={-0.35} />
      <Person pose="stand" activity={crew.releases > 0 || crew.incident ? "type" : "chat"} look={look(11)} position={[POS.deploy.x, 0, POS.deploy.z + 0.78]} phase={3} />
      {[-0.45, 0.45].map((dx) => (
        <ScreenPlane key={dx} kind={crew.promos > 0 ? "chart" : "idle"} w={0.6} h={0.36} position={[POS.growth.x - 0.4 + dx, 1.13, POS.growth.z + 0.2 - 0.174]} />
      ))}
      <ScreenPlane kind="chart" w={1.2} h={0.75} position={[POS.growth.x + 1.15, 1.5, POS.growth.z - 0.52]} />
      <Person pose="sit" activity={crew.promos > 0 ? "type" : "mug"} look={look(14)} position={[POS.growth.x - 0.4, 0, POS.growth.z + 0.92]} phase={5} />
      {[-0.45, 0.45].map((dx) => (
        <ScreenPlane key={dx} kind={crew.incident ? "alert" : "dash"} w={0.6} h={0.36} position={[8.2 + dx, 1.13, -6.9 - 0.174]} />
      ))}
      <Person pose="sit" activity={crew.incident ? "type" : "mug"} look={look(12)} position={[8.2, 0, -6.18]} phase={7} />
      <ScreenPlane kind="idle" w={0.5} h={0.29} position={[3.2, 1.0, 11.775]} rot={Math.PI} />
      <Person pose="sit" activity="type" look={look(18)} position={[3.2, 0, 11.3]} rotation={Math.PI} phase={2} />

      {/* A meeting in progress */}
      <ScreenPlane kind="slides" w={1.5} h={0.86} position={[-12.65, 1.35, 12.35]} rot={Math.PI / 2} />
      <Person pose="stand" activity="present" look={look(36)} position={[-12.1, 0, 12.0]} rotation={-Math.PI / 2} phase={1} />
      <Person pose="sit" activity="listen" look={look(33)} position={[-10.4, 0, 11.42]} rotation={Math.PI} phase={2} />
      <Person pose="sit" activity="listen" look={look(34)} position={[-8.0, 0, 13.28]} phase={4} />
      <Person pose="sit" activity="listen" look={look(35)} position={[-9.2, 0, 13.28]} phase={6} />

      {/* Kitchen chat, the lounge, a phone call and the townhall */}
      <Person pose="stand" activity="chat" look={look(31)} position={[17.5, 0, -4.85]} rotation={0.81} phase={8} />
      <Person pose="sit" activity="listen" look={look(27)} position={[19.9, 0, 7.1]} rotation={Math.PI / 2} phase={9} />
      <Person pose="stand" activity="chat" look={look(38)} position={[-14.8, 0, 13.7]} rotation={Math.PI} phase={10} />
      <Person pose="sit" activity="laptop" look={look(40)} position={[-18.6, 0, 3.6]} rotation={-Math.PI / 2} phase={11} seat={0.87} />
      <ScreenPlane kind="slides" w={2.1} h={1.12} position={[-14.35, 1.5, 4.5]} rot={-Math.PI / 2} />
      <ScreenPlane kind="game" w={1.7} h={0.92} position={[15.5, 1.15, 6.5]} rot={Math.PI / 2} />
      {[20.4, 21.3].map((x) => (
        <ScreenPlane key={x} kind="game" w={0.54} h={0.44} position={[x, 1.25, 10.92]} tilt={-0.2} />
      ))}

      {/* People walking the corridors */}
      <Walker from={[12.6, -3.6]} to={[12.6, 12.8]} speed={0.6} look={look(21)} />
      <Walker from={[-4.4, 9.7]} to={[12.4, 9.7]} speed={0.55} look={look(16)} phase={4} />
      <Walker from={[4.4, -0.9]} to={[8.0, -0.9]} speed={0.45} look={look(23)} phase={2} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* The office                                                          */
/* ------------------------------------------------------------------ */

export function Office({ crew }: { crew: Crew }) {
  const prims = useMemo(() => buildStatic(), []);
  const wall = useMemo(() => buildWallMounted(), []);
  return (
    <group>
      <Floors />
      <PrimBatch prims={prims} />
      <Glass />
      <WhiteboardFace position={[-12.27, 1.45, 7.4]} rot={Math.PI / 2} />
      <People crew={crew} />
      <PingPongBall />

      <OnWall wall="left">
        <PrimBatch prims={wall.left} shadows={false} />
        <NeonLogo position={[ROOM.x0 + 0.08, 2.5, 4.5]} rot={Math.PI / 2} />
        <CityWindow position={[ROOM.x0 + 0.06, 1.8, -0.2]} rot={Math.PI / 2} w={1.6} h={1.5} />
        <CityWindow position={[ROOM.x0 + 0.06, 1.8, 8.9]} rot={Math.PI / 2} w={1.6} h={1.5} />
      </OnWall>
      <OnWall wall="back">
        <PrimBatch prims={wall.back} shadows={false} />
        <CityWindow position={[18.8, 2.1, ROOM.z0 + 0.08]} w={2.2} h={1.2} />
        <WallClock position={[4.2, 2.35, ROOM.z0 + 0.06]} />
        <Beacon on={crew.incident} />
      </OnWall>
      <OnWall wall="right">
        <CityWindow position={[ROOM.x1 - 0.06, 1.8, 2.0]} rot={-Math.PI / 2} w={2.2} h={1.5} />
        <CityWindow position={[ROOM.x1 - 0.06, 1.8, 7.5]} rot={-Math.PI / 2} w={2.2} h={1.5} />
      </OnWall>

    </group>
  );
}
