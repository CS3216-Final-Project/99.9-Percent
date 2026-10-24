"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { deskSlot, POS, ROOM } from "./layout";
import { creature, standsAtDesk, type Activity, type Species } from "./cast";
import { daylightNow } from "./dayClock";
import { Creature, Wanderer } from "./creatures";
import { preloadCreatures } from "./creatureCatalog";
import { Conversation } from "./chatter";
import { GROUPS } from "./conversations";
import {
  ARCADE_Z,
  ARCADES,
  BREAKOUT,
  deskSeat,
  FIXTURES,
  FOOSBALL,
  GLASS,
  GLASS_H,
  HUDDLE_ROOM,
  MEETING_CHAIRS,
  NAP_MATTRESS,
  NAP_PODS,
  NAP_ROOM,
  OPEN_DESKS,
  openDeskSlot,
  QUIET_DESKS,
  QUIET_ROOM,
  RESPONDERS,
  SHARED_TABLE,
  SPOTS,
  STAGE,
  STANDING_TABLE,
  ZONE_NAME_HEIGHT,
  ZONE_NAMES,
  type Spot,
} from "./floorplan";
import { planLoop, type WaypointId } from "./routes";
import { BALL_RADIUS, ballAt, RALLY, RALLY_PERIOD, TABLE } from "./rally";
import { preloadModels, type ModelId } from "./modelCatalog";
import { ModelBatch, type Placement } from "./models";
import { PrimBatch } from "./prims";
import { ball, bx, cy, place, type Prim, type V3 } from "./shapes";
import { ARCADE_SCREEN, MAC, type PropItem } from "./propModels";
import { at, atop, deskGear, deskModels, GLASS_MATERIAL, glassFrames, ignoreRay, mdl, PANEL, placeModels, placeProps, shelf } from "./furniture";
import { DetailedProps } from "./props";
import { FURNITURE, PIXEL_FLOORS, ROOM_PALETTE } from "./palette";
import { projectUV, surfaceMaterial, useSurfaces, type SurfaceId } from "./surfaces";
import { arcadeScreen, carpet, floorTiles, kitchenTiles, logoSign, poster, puffTexture, screenTexture, skyline, skylineDay, whiteboard, zoneName, zzzTexture, type PosterKind, type ScreenKind } from "./textures";
import { OnWall } from "./walls";
import { arcadeGame, startArcade, stepArcade, stopArcade } from "./arcade";
import { drawBreakout } from "./breakout";
import { now } from "./ride";
import { avatar, napBlend, onBusy } from "./walk";
import { viewFocus } from "./zoneSounds";

/*
 * The office floor, on top of the building: an open floor of desks where the
 * server room used to be, the engineering pods, the release and growth desks,
 * a quiet room, a huddle room by the elevator, townhall steps and a stage, a
 * library, a meeting room, reception, a kitchen, a dining table, a lounge with
 * games, nap pods, and the monster crew who use them (see creatures.tsx). The
 * machines are on the server floor below (see ServerFloor.tsx), which borrows
 * the helpers exported here.
 *
 * Furniture comes from CC0 model packs, with photo-scanned stand-ins at HD
 * detail (see models.tsx); fittings with no matching model are boxes and
 * cylinders (see prims.tsx). Both are batched. Only screens, glass, signs and
 * moving things are separate.
 */

const INK = FURNITURE.ink;
const TRIM = FURNITURE.trim;
const STEEL = FURNITURE.steel;
const WOOD = "#c98b55";
const WOOD_DARK = FURNITURE.woodDark;
const LILAC = FURNITURE.light;
const PALE = FURNITURE.pale;
const WHITE = "#f4f1ea";
const ALU = FURNITURE.alu;
const MUGS = ["#4cb8ff", "#ff7ad9", "#3ddc84", "#ffc53d", "#a985ff", "#ff9f43"];


/* ------------------------------------------------------------------ */
/* Fittings with no matching model, as prims around their own origin   */
/* ------------------------------------------------------------------ */

function rug(w: number, d: number, outer: string, inner: string): Prim[] {
  return [bx([0, 0.007, 0], [w, 0.012, d], outer), bx([0, 0.009, 0], [w - 0.4, 0.013, d - 0.4], inner)];
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


function pingPong(): Prim[] {
  const { length: l, width: w, top, netTop } = TABLE;
  const line = top + 0.005;
  return [
    bx([0, top - 0.03, 0], [l, 0.06, w], "#1f7a5c"),
    bx([0, line, w / 2 - 0.015], [l, 0.012, 0.03], "#fff7e8"),
    bx([0, line, -w / 2 + 0.015], [l, 0.012, 0.03], "#fff7e8"),
    bx([l / 2 - 0.015, line, 0], [0.03, 0.012, w], "#fff7e8"),
    bx([-l / 2 + 0.015, line, 0], [0.03, 0.012, w], "#fff7e8"),
    bx([0, line, 0], [l, 0.012, 0.015], "#fff7e8"),
    bx([0, (top + netTop) / 2, 0], [0.02, netTop - top, w + 0.12], LILAC),
    ...[-1.1, 1.1].flatMap((dx) => [-0.6, 0.6].map((dz) => bx([dx, 0.37, dz], [0.07, 0.74, 0.07], TRIM))),
  ];
}

/** The top of the mug under the espresso machine, where its steam rises from. */
const ESPRESSO_MUG: V3 = [17.31, 0.96, -8.91];

/** A nap pod 2 m long along x and 0.82 m wide, its hooded head at the +x end, with a mattress, a pillow and a reading light. */
function napPod(accent: string): Prim[] {
  const W = 0.82;
  return [
    bx([0, 0.22, 0], [2.0, 0.44, W], WHITE),
    bx([0, 0.3, W / 2 + 0.003], [2.0, 0.06, 0.006], accent),
    bx([0, 0.3, -W / 2 - 0.003], [2.0, 0.06, 0.006], accent),
    bx([-0.05, NAP_MATTRESS - 0.06, 0], [1.8, 0.12, W - 0.14], accent),
    bx([0.72, 0.6, 0], [0.32, 0.09, W - 0.32], WHITE),
    // The hood over the head end: a roof, two sides and a back.
    bx([0.45, 1.06, 0], [1.1, 0.06, W], PALE),
    bx([0.45, 0.78, W / 2 - 0.025], [1.1, 0.56, 0.05], PALE),
    bx([0.45, 0.78, -W / 2 + 0.025], [1.1, 0.56, 0.05], PALE),
    bx([0.98, 0.78, 0], [0.05, 0.56, W], PALE),
    bx([0.6, 1.02, 0], [0.12, 0.02, 0.12], "#ffd84a"),
  ];
}

/** A foosball table's frame and pitch, 1.2 m along x; its rods turn in `FoosballRods`. */
function foosballTable(): Prim[] {
  return [
    ...[-0.5, 0.5].flatMap((dx) => [-0.28, 0.28].map((dz) => bx([dx, 0.35, dz], [0.08, 0.7, 0.08], TRIM))),
    bx([0, 0.69, 0], [1.16, 0.02, 0.71], "#3d8b5a"),
    bx([0, 0.702, 0], [0.02, 0.004, 0.68], WHITE),
    bx([0, 0.78, 0.37], [1.2, 0.2, 0.03], WOOD),
    bx([0, 0.78, -0.37], [1.2, 0.2, 0.03], WOOD),
    bx([0.59, 0.78, 0], [0.03, 0.2, 0.75], WOOD),
    bx([-0.59, 0.78, 0], [0.03, 0.2, 0.75], WOOD),
  ];
}

/** The events stage in front of the townhall screen, with a lectern facing the steps. */
function stage(): Prim[] {
  return [
    bx([0, STAGE.h / 2, 0], [STAGE.w, STAGE.h, STAGE.d], WOOD_DARK),
    bx([0, STAGE.h + 0.005, 0], [STAGE.w - 0.1, 0.01, STAGE.d - 0.1], WOOD),
    // The lectern near the stage's north end, its sloped top towards the screen.
    bx([-0.35, STAGE.h + 0.55, 1.4], [0.45, 1.1, 0.42], WOOD),
    bx([-0.35, STAGE.h + 1.12, 1.4], [0.5, 0.04, 0.48], WOOD_DARK, [0, 0, 0.3]),
    cy([-0.48, STAGE.h + 1.3, 1.4], 0.03, 0.3, INK),
  ];
}

/** A row of tall lockers against a wall, facing +z, each door with a handle and a name card. */
function lockers(n: number): Prim[] {
  const w = 0.6;
  const out: Prim[] = [];
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * w;
    out.push(bx([x, 0.95, 0], [w - 0.02, 1.9, 0.5], i % 2 ? PALE : LILAC), bx([x + 0.2, 1.0, 0.26], [0.03, 0.18, 0.03], TRIM), bx([x, 1.6, 0.255], [0.16, 0.08, 0.01], WHITE));
  }
  return out;
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

/* ------------------------------------------------------------------ */
/* The whole floor plan                                                */
/* ------------------------------------------------------------------ */




/** The panes of glass partition runs. */
export function GlassPanes({ runs }: { runs: [number, number, number, number][] }) {
  return (
    <group>
      {runs.map(([x1, z1, x2, z2], i) => {
        const len = Math.hypot(x2 - x1, z2 - z1);
        return (
          <mesh key={i} position={[(x1 + x2) / 2, GLASS_H / 2, (z1 + z2) / 2]} rotation={[0, z1 === z2 ? 0 : Math.PI / 2, 0]} material={GLASS_MATERIAL}>
            <planeGeometry args={[len, GLASS_H - 0.08]} />
          </mesh>
        );
      })}
    </group>
  );
}

function Glass() {
  return (
    <group>
      <GlassPanes runs={GLASS} />
      {/* Phone booth fronts */}
      {[-16.2, -14.8].map((x) => (
        <mesh key={x} position={[x, 1.15, 14.2]} material={GLASS_MATERIAL}>
          <planeGeometry args={[1.12, 2.2]} />
        </mesh>
      ))}
    </group>
  );
}



/** The smaller Mac at reception: the centre and width of its picture. */
const RECEPTION_SCREEN = { y: 1.0, z: 11.771, w: 0.52 };

/** The receptionist, who has a desk of their own. */
const RECEPTIONIST = creature(18, "frontdesk");

/** Who works on the open floor, in the quiet room and in the huddle room, and where. */
const OPEN_CREW: { species: Species; spot: Spot; pose: "sit" | "stand"; activity: Activity; desk?: number }[] = [
  { species: creature(50, "dev"), spot: SPOTS.openDeskA, pose: "sit", activity: "type", desk: 1 },
  { species: creature(53, "designer"), spot: SPOTS.openDeskB, pose: "sit", activity: "type", desk: 14 },
  { species: creature(56, "pm"), spot: SPOTS.standing, pose: "stand", activity: "chat" },
  { species: creature(59, "data"), spot: SPOTS.breakout, pose: "sit", activity: "laptop" },
  { species: creature(62, "dev"), spot: SPOTS.quietDesk, pose: "sit", activity: "type" },
  { species: creature(65, "marketer"), spot: SPOTS.huddleCall, pose: "sit", activity: "listen" },
];




/** The detailed machines: Macs on every desk, vending machines, kitchen appliances and arcade cabinets. */
function buildProps(): PropItem[] {
  const out: PropItem[] = [];
  const add = (items: PropItem[], x: number, z: number, rot = 0) => out.push(...placeProps(items, x, z, rot));
  for (let i = 0; i < 8; i++) {
    const s = deskSlot(i);
    add(deskGear(i), s.x, s.z, s.rot);
  }
  for (let i = 0; i < OPEN_DESKS; i++) {
    const s = openDeskSlot(i);
    add(deskGear(20 + i), s.x, s.z, s.rot);
  }
  QUIET_DESKS.forEach((s, i) => add(deskGear(31 + i), s.x, s.z, s.rot));
  add(deskGear(9, 2), POS.growth.x - 0.4, POS.growth.z + 0.2);
  // Reception: a smaller Mac on the lower work surface, facing the receptionist.
  const rs = RECEPTION_SCREEN.w / MAC.screenW;
  out.push(
    { kind: "imac", variant: "orange", p: [3.2, RECEPTION_SCREEN.y - MAC.displayY * rs, RECEPTION_SCREEN.z + MAC.gap * rs], rot: Math.PI, s: rs },
    { kind: "keyboard", variant: "orange", p: [3.2, 0.76, 11.65], rot: Math.PI },
    { kind: "mouse", variant: "orange", p: [2.95, 0.76, 11.66], rot: Math.PI },
  );
  out.push({ kind: "vending", variant: "red", p: [12.6, 0, -9.0] }, { kind: "vending", variant: "blue", p: [13.7, 0, -9.0] });
  out.push({ kind: "cooler", p: [15.0, 0, -4.0], rot: Math.PI / 2 });
  out.push({ kind: "fridge", p: [15.35, 0, -9.1] }, { kind: "espresso", p: [17.23, 0.87, -9.15] });
  for (const [variant, x] of ARCADES) out.push({ kind: "arcade", variant, p: [x, 0, ARCADE_Z] });
  return out;
}

/** Everything that never moves and is not a model, as one list of prims. */
function buildStatic(): Prim[] {
  const out: Prim[] = [...glassFrames(GLASS)];
  const add = (prims: Prim[], x: number, z: number, rot = 0, y = 0) => out.push(...place(prims, x, z, rot, y));

  // Mugs and papers on the engineers' desks, and the whiteboard's stand
  for (let i = 0; i < 8; i++) {
    const s = deskSlot(i);
    add([cy([0.55, 0.785, 0.08], 0.09, 0.09, MUGS[(i * 4 + 2) % MUGS.length]), ...(i % 2 === 0 ? [bx([-0.45, 0.745, 0.12], [0.22, 0.01, 0.3], "#fff7e8", [0, 0.25, 0])] : [])], s.x, s.z, s.rot);
  }
  add([bx([0, 0.45, 0], [0.06, 0.9, 1.3], ALU), bx([0, 1.4, 0], [0.04, 1.1, 2.1], ALU)], -12.32, 7.4);

  // Release console and the growth results board
  add([bx([0, 0.5, 0], [1.5, 1, 0.8], STEEL), bx([0, 1.28, -0.12], [1.17, 0.69, 0.05], INK, [-0.35, 0, 0]), bx([0.95, 0.6, 0.05], [0.3, 1.2, 0.6], TRIM)], POS.deploy.x, POS.deploy.z);
  add([cy([0, 0.55, 0], 0.08, 1.1, INK), bx([0, 1.5, 0], [1.27, 0.82, 0.05], INK)], POS.growth.x + 1.15, POS.growth.z - 0.55);

  // The open floor: mugs and papers on the desks people use, lockers along the back wall and the breakout rug
  for (const i of [1, 6, 9, 14, 17]) {
    const s = openDeskSlot(i);
    add([cy([0.55, 0.785, 0.08], 0.09, 0.09, MUGS[(i * 3 + 1) % MUGS.length]), bx([-0.45, 0.745, 0.12], [0.22, 0.01, 0.3], "#fff7e8", [0, 0.4, 0])], s.x, s.z, s.rot);
  }
  add(lockers(5), 3.6, -9.2);
  add(rug(3.6, 3.6, FURNITURE.rug[0], FURNITURE.rug[1]), BREAKOUT.x, BREAKOUT.z + 0.2);

  // The quiet room: low screens between its desks, a bookshelf and a reading corner
  QUIET_DESKS.slice(0, -1).forEach((s) => out.push(bx([s.x + 1.0, 0.62, s.z + 0.15], [0.05, 1.24, 1.05], FURNITURE.booths[0])));
  add(shelf(1.9, 2.0, 41), -21.75, -4.4, Math.PI / 2);
  add(rug(2.4, 2.0, FURNITURE.rug[0], FURNITURE.rug[1]), -18.6, -3.2);

  // The huddle room: a screen on the back wall for calls
  add([bx([0, 1.45, 0], [1.9, 1.1, 0.05], INK), bx([0, 0.45, 0.05], [0.1, 0.9, 0.1], TRIM), bx([0, 0.02, 0.1], [0.8, 0.04, 0.4], TRIM)], (HUDDLE_ROOM[0] + HUDDLE_ROOM[2]) / 2, HUDDLE_ROOM[1] + 0.35);

  // Townhall steps facing a screen, and the stage in front of it
  TIERS.forEach(([x, h], tier) => out.push(bx([x, h / 2, 4.5], [1.2, h, 6.6], tier % 2 ? WOOD : WOOD_DARK)));
  add([bx([0, 0.45, 0], [0.4, 0.9, 1.4], TRIM), bx([0, 1.5, 0], [0.08, 1.22, 2.3], INK)], -14.3, 4.5);
  add(stage(), STAGE.x, STAGE.z);

  // The nap room's pods and the foosball table
  NAP_PODS.forEach(([x, z], i) => add(napPod(FURNITURE.booths[i % FURNITURE.booths.length]), x, z));
  add(foosballTable(), FOOSBALL.x, FOOSBALL.z);

  // Library shelves and phone booths
  add(shelf(1.9, 2.0, 11), -21.75, 10.6, Math.PI / 2);
  add(shelf(1.9, 2.0, 23), -21.75, 12.7, Math.PI / 2);
  add(booth(FURNITURE.booths[0]), -16.2, 13.6);
  add(booth(FURNITURE.booths[1]), -14.8, 13.6);

  // Reception desk, a magazine in the waiting area and the doormat
  add([bx([0, 0.525, 0], [3.2, 1.05, 0.7], WHITE), bx([0, 1.075, 0.02], [3.3, 0.05, 0.8], WOOD), bx([0, 0.74, -0.52], [3.0, 0.04, 0.36], WOOD), bx([0.9, 1.12, 0.1], [0.3, 0.06, 0.2], "#ff7ad9")], 3.2, 12.3);
  out.push(bx([-2.1, 0.41, 12.6], [0.3, 0.02, 0.4], "#ffc53d", [0, 0.3, 0]));
  out.push(bx([3.2, 0.006, 13.95], [1.8, 0.012, 1.0], TRIM));

  // Corridor: a low bookshelf
  add(shelf(2.4, 1.1, 37), 11.6, 5.45);

  // Fruit on the kitchen island
  out.push(ball([18.4, 0.86, -6.2], [0.36, 0.12, 0.36], WHITE), ball([18.35, 0.93, -6.15], [0.1, 0.1, 0.1], "#ff4d5e"), ball([18.48, 0.93, -6.25], [0.1, 0.1, 0.1], "#ffc53d"));

  // The remains of pizza night
  add(pizza(), 17.8, -0.1, 0, 0.76);
  add(pizza(), 19.4, 0.15, 1.2, 0.76);

  // The standing table on the open floor, its top raised on two legs
  add([bx([0, 1.05, 0], [STANDING_TABLE.w, 0.05, STANDING_TABLE.d], WOOD), ...[-0.9, 0.9].map((dx) => bx([dx, 0.52, 0], [0.08, 1.04, 0.6], TRIM))], STANDING_TABLE.x, STANDING_TABLE.z);

  // Rugs in the lounge and the library, beanbags and the games corner
  add(rug(5.0, 4.6, FURNITURE.rug[0], FURNITURE.rug[1]), 18.4, 6.5);
  out.push(cy([-19.2, 0.007, 11.7], 2.8, 0.012, FURNITURE.rug[0]), cy([-19.2, 0.009, 11.7], 2.4, 0.013, FURNITURE.rug[1]));
  out.push(ball([16.9, 0.26, 4.4], [0.96, 0.58, 0.96], "#2dd4bf"), ball([16.6, 0.26, 8.6], [0.96, 0.58, 0.96], "#ff7ad9"));
  add(pingPong(), RALLY.x, RALLY.z);
  return out;
}

/** Townhall tiers as [x, height]. */
const TIERS: [number, number][] = [
  [-21.3, 1.6],
  [-20.1, 1.2],
  [-18.9, 0.8],
  [-17.7, 0.4],
];

/** The two televisions: where they stand and their scale. */
const MEETING_TV = { x: -12.75, z: 12.35, y: 0.54, s: 1.15 };
const LOUNGE_TV = { x: 15.3, z: 6.5, y: 0.6, s: 1.25 };

/** The picture on a television model turned to face +x: centre and size. */
function tvPicture(tv: { x: number; z: number; y: number; s: number }): { position: V3; w: number; h: number } {
  return { position: [tv.x + 0.041 * tv.s + 0.006, tv.y + 0.506 * tv.s, tv.z], w: 1.25 * tv.s, h: 0.69 * tv.s };
}

/** Furniture models: desks, chairs, the kitchen, sofas, tables, lamps, plants and more. */
function buildModels(): Placement[] {
  const out: Placement[] = [];
  const add = (items: Placement[], x: number, z: number, rot = 0) => out.push(...placeModels(items, x, z, rot));

  // Engineering pods, the growth desk and the on-call desk
  for (let i = 0; i < 8; i++) {
    const s = deskSlot(i);
    // A desk whose engineer is too big for a chair is a standing desk.
    add(deskModels(1.5, i, !standsAtDesk(creature(i))), s.x, s.z, s.rot);
  }
  add(deskModels(2.2, 9), POS.growth.x - 0.4, POS.growth.z + 0.2);
  // The open floor's pods, whoever sits there sitting on a chair or standing at a standing desk
  const seated = new Map(OPEN_CREW.filter((c) => c.desk !== undefined).map((c) => [c.desk as number, c.species]));
  for (let i = 0; i < OPEN_DESKS; i++) {
    const s = openDeskSlot(i);
    const who = seated.get(i);
    add(deskModels(1.5, 20 + i, !who || !standsAtDesk(who)), s.x, s.z, s.rot);
  }
  for (const dx of [-0.8, 0, 0.8]) out.push(mdl("stoolBar", STANDING_TABLE.x + dx, STANDING_TABLE.z - 0.8, 0, 1.15));
  out.push(mdl("tableLong", SHARED_TABLE.x, SHARED_TABLE.z, 0, [SHARED_TABLE.w, 0.74, SHARED_TABLE.d]));
  for (const x of SHARED_TABLE.chairs) out.push(mdl("chairCushion", x, SHARED_TABLE.z - 0.85, 0, 1.15), mdl("chairCushion", x, SHARED_TABLE.z + 0.85, Math.PI, 1.15));
  out.push(mdl("couch", BREAKOUT.x, BREAKOUT.z + 1.75, Math.PI, 1.2), mdl("tableCoffee", BREAKOUT.x, BREAKOUT.z, 0, 0.9));
  out.push(mdl("armchair", BREAKOUT.x - 0.8, BREAKOUT.z - 1.3, 0, 0.85), mdl("armchair", BREAKOUT.x + 0.8, BREAKOUT.z - 1.3, 0, 0.85));
  out.push(mdl("lampSquareFloor", BREAKOUT.x + 1.6, BREAKOUT.z + 2.1), mdl("pottedPlant", 8.3, -0.6, 0, 1.2), mdl("pottedPlant", 1.6, -9.05));
  // The quiet room's desks facing the back wall, a reading chair and plants
  QUIET_DESKS.forEach((s, i) => add(deskModels(1.4, 31 + i), s.x, s.z, s.rot));
  out.push(mdl("armchair", -18.6, -3.0, Math.PI, 0.9), mdl("lampRoundFloor", -20.9, -2.0), mdl("pottedPlant", QUIET_ROOM[2] - 0.5, QUIET_ROOM[1] + 0.5), mdl("pottedPlant", QUIET_ROOM[0] + 0.5, QUIET_ROOM[3] - 0.5));
  // The huddle room's table and four chairs
  const huddle = (HUDDLE_ROOM[0] + HUDDLE_ROOM[2]) / 2;
  out.push(mdl("tableLong", huddle, -7.3, 0, [1.8, 0.74, 1.0]));
  for (const x of [huddle - 0.6, huddle + 0.6]) out.push(mdl("chairModern", x, -8.15, 0, 1.2), mdl("chairModern", x, -6.45, Math.PI, 1.2));
  out.push(mdl("pottedPlant", HUDDLE_ROOM[0] + 0.45, HUDDLE_ROOM[3] - 0.45));
  out.push(mdl("pottedPlant", -12.4, 5.6), mdl("pottedPlant", FIXTURES.plantByWhiteboard.x, FIXTURES.plantByWhiteboard.z), mdl("coatRack", -3.0, 5.6), mdl("trashcan", -3.0, 9.0, 0, 0.8));
  out.push(mdl("pottedPlant", 2.2, 8.9), mdl("cactusMedium", 8.9, 5.6, 0, 1.5));

  // Cushions on the townhall steps, leaving room for the reader
  TIERS.forEach(([x, h], tier) => {
    for (let k = 0; k < 4; k++) {
      if ((tier * 3 + k) % 4 === 1 || (tier === 2 && k === 1)) continue;
      out.push(mdl(k % 2 ? "pillowA" : "pillowB", x + 0.1, 2.2 + k * 1.5, tier * 0.7 + k, 1.4, h));
    }
  });

  // Library corner
  out.push(mdl("armchair", -19.6, 10.8, Math.PI / 2, 0.95), mdl("armchair", -18.4, 12.6, Math.PI, 0.95));
  const libraryTable = mdl("sideTable", -19.1, 11.9, Math.PI / 4, 0.7);
  out.push(libraryTable, atop(libraryTable, mdl("lampTable", -19.1, 11.9, 0, 0.9)), mdl("lampRoundFloor", -20.9, 13.7), mdl("pottedPlant", FIXTURES.plantByLibrary.x, FIXTURES.plantByLibrary.z, 0, 1.1));

  // The nap room: a side table with a lamp by the door, and a plant
  const napTable = mdl("sideTable", NAP_ROOM[0] + 0.5, NAP_ROOM[3] - 0.5, 0, 0.6);
  out.push(napTable, atop(napTable, mdl("lampTable", NAP_ROOM[0] + 0.5, NAP_ROOM[3] - 0.5, 0, 0.8)));
  out.push(mdl("pottedPlant", NAP_ROOM[0] + 0.45, NAP_ROOM[1] + 0.45, 0, 0.9));

  // Meeting room
  out.push(mdl("tableLong", -9.2, 12.35, 0, [3.4, 0.74, 1.3]));
  for (const x of MEETING_CHAIRS.xs) out.push(mdl("chairModern", x, MEETING_CHAIRS.near, 0, 1.2), mdl("chairModern", x, MEETING_CHAIRS.far, Math.PI, 1.2));
  out.push(mdl("tvCabinet", MEETING_TV.x, MEETING_TV.z, Math.PI / 2, 0.9), mdl("tv", MEETING_TV.x, MEETING_TV.z, Math.PI / 2, MEETING_TV.s, MEETING_TV.y), mdl("pottedPlant", -6.0, 14.0));

  // Reception and the waiting area
  if (!standsAtDesk(RECEPTIONIST)) out.push(mdl("chairDesk", SPOTS.receptionist.x, SPOTS.receptionist.z));
  out.push(mdl("pottedPlant", 6.4, 13.9), mdl("coatRack", 5.6, 13.9));
  out.push(mdl("armchair", -3.2, 12.6, Math.PI / 2, 0.85), mdl("armchair", -1.2, 12.6, -Math.PI / 2, 0.85), mdl("tableCoffee", -2.2, 12.6, Math.PI / 2, 0.9), mdl("cactusMedium", -4.4, 13.9, 0, 1.6));

  // Corridor
  out.push(mdl("bench", 14.0, 1.2, -Math.PI / 2), mdl("bench", 14.0, 2.0, -Math.PI / 2), mdl("pottedPlant", 13.9, 9.6), mdl("pottedPlant", 13.9, -4.0), mdl("cactusMedium", 9.6, 4.4, 0, 1.4));

  // Kitchen: cabinets along the back and side walls, an island with stools
  const run: ModelId[] = ["cabinetDrawer", "cabinet", "sink", "cabinet", "stove", "cabinetDrawer", "cabinet"];
  run.forEach((id, i) => out.push(mdl(id, 16.4 + i * 0.83, -9.06)));
  for (const z of [-8.2, -7.37, -6.54]) out.push(mdl("cabinet", 21.565, z, -Math.PI / 2));
  out.push(mdl("microwave", 20.55, -9.15, 0, 1, 0.87), mdl("blender", 16.4, -9.2, 0, 1, 0.87), mdl("toaster", 21.5, -7.37, -Math.PI / 2, 1, 0.87));
  for (const x of [17.57, 18.4, 19.23]) out.push(mdl("bar", x, -6.0), mdl("bar", x, -6.4, Math.PI));
  for (const x of [17.06, 19.74]) out.push(mdl("barEnd", x, -6.0), mdl("barEnd", x, -6.4, Math.PI));
  for (const x of [18.0, 18.9]) out.push(mdl("stoolBar", x, -5.35, Math.PI));
  out.push(mdl("trashcan", FIXTURES.kitchenBin.x, FIXTURES.kitchenBin.z, -Math.PI / 2, 0.8));

  // Dining table and chairs
  out.push(mdl("tableLong", 18.5, 0, 0, [4.0, 0.75, 1.1]));
  for (const x of [17.1, 18.5, 19.9]) out.push(mdl("chairCushion", x, -0.85, 0, 1.15), mdl("chairCushion", x, 0.85, Math.PI, 1.15));
  out.push(mdl("pottedPlant", 15.0, 2.6), mdl("cactusMedium", 21.4, -2.6, 0, 1.5));

  // Lounge: a couch facing the TV, an armchair and a lamp
  out.push(mdl("couch", 19.8, 6.5, -Math.PI / 2, 1.2), mdl("loungeChair", 17.6, 8.8, Math.PI, 0.9), mdl("tableCoffeeGlass", 18.0, 6.5, Math.PI / 2, 0.9));
  out.push(mdl("tvCabinet", LOUNGE_TV.x, LOUNGE_TV.z, Math.PI / 2), mdl("tv", LOUNGE_TV.x, LOUNGE_TV.z, Math.PI / 2, LOUNGE_TV.s, LOUNGE_TV.y), mdl("speaker", 15.3, 5.1), mdl("speaker", 15.3, 7.9));
  out.push(mdl("lampSquareFloor", 21.3, 4.1), mdl("pottedPlant", 21.4, 9.3), mdl("pottedPlant", 15.0, 13.9));
  return out;
}

/** Picture frames on the left wall (frame bottoms at y) and the posters inside them (centred at mid). */
const FRAMES: { id: ModelId; z: number; y: number; poster: PosterKind; w: number; h: number; mid: number }[] = [
  { id: "frameLargeA", z: 1.3, y: 1.75, poster: "launch", w: 0.72, h: 0.88, mid: 2.305 },
  { id: "frameMedium", z: 7.6, y: 1.8, poster: "growth", w: 0.47, h: 0.64, mid: 2.22 },
];
const FRAME_X = ROOM.x0 + 0.1;

/** Fixed to a wall, drawn only while the wall stands. */
function buildWallMounted(): { back: Placement[]; left: Placement[] } {
  return {
    back: [16.4, 17.23, 20.55, 21.38].map((x) => mdl("cabinetUpper", x, -9.29, 0, 1, 1.55)),
    left: FRAMES.map((f) => mdl(f.id, FRAME_X, f.z, Math.PI / 2, 1.5, f.y)),
  };
}

/* ------------------------------------------------------------------ */
/* Screens, signs and other special surfaces                           */
/* ------------------------------------------------------------------ */

export function ScreenPlane({ kind, w, h, position, rot = 0, tilt = 0 }: { kind: ScreenKind; w: number; h: number; position: V3; rot?: number; tilt?: number }) {
  const map = useMemo(() => screenTexture(kind), [kind]);
  const rotation = useMemo(() => new THREE.Euler(tilt, rot, 0, "YXZ"), [tilt, rot]);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={map} toneMapped={false} />
    </mesh>
  );
}

/** A window onto the city: the view by day fades into the view by night with the time of day. Faces +z before rotation. */
function CityWindow({ position, rot = 0, w, h }: { position: V3; rot?: number; w: number; h: number }) {
  const tex = useMemo(() => skyline(), []);
  const dayTex = useMemo(() => skylineDay(), []);
  const day = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    if (day.current) day.current.opacity = 1 - daylightNow().dark;
  });
  useEffect(
    () => () => {
      tex.dispose();
      dayTex.dispose();
    },
    [tex, dayTex],
  );
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
      <mesh position={[0, 0, 0.04]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial ref={day} map={dayTex} transparent depthWrite={false} toneMapped={false} />
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

/** A poster inside one of the wall frames, just behind the frame's front edge. */
function Poster({ kind, position, w, h }: { kind: PosterKind; position: V3; w: number; h: number }) {
  const map = useMemo(() => poster(kind), [kind]);
  return (
    <mesh position={position} rotation={[0, Math.PI / 2, 0]}>
      <planeGeometry args={[w, h]} />
      <meshLambertMaterial map={map} />
    </mesh>
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

type FloorKey = "server" | "work" | "noc" | "meeting" | "kitchen" | "events" | "library" | "reception" | "dining" | "lounge" | "games" | "nap" | "quiet";

/** A floor finish over a zone: the finish, its centre x and z, width, depth and tile size. */
export type Zone = [FloorKey, number, number, number, number, number];

/**
 * The office's floor finishes by zone. Each zone has a floor of its own, so the zones read apart from the default
 * view; what is left over is the bare concrete of the corridors.
 */
const ZONES: Zone[] = [
  // The open floor where the server room used to be, the quiet room and the huddle room.
  ["work", -3.75, -7.05, 18.5, 4.9, 1.2],
  ["work", -2.0, 0.2, 22, 9.6, 1.2],
  ["quiet", (QUIET_ROOM[0] + QUIET_ROOM[2]) / 2, (QUIET_ROOM[1] + QUIET_ROOM[3]) / 2, QUIET_ROOM[2] - QUIET_ROOM[0], QUIET_ROOM[3] - QUIET_ROOM[1], 1.2],
  ["meeting", (HUDDLE_ROOM[0] + HUDDLE_ROOM[2]) / 2, (HUDDLE_ROOM[1] + HUDDLE_ROOM[3]) / 2, HUDDLE_ROOM[2] - HUDDLE_ROOM[0], HUDDLE_ROOM[3] - HUDDLE_ROOM[1], 1.2],
  // Engineering: the pods, the release console and the growth desk.
  ["work", -2.05, 7.6, 21.9, 5.2, 1.2],
  ["meeting", -9.25, 12.35, 7.5, 4.3, 1.2],
  ["reception", 1.25, 12.35, 13.5, 4.3, 0.8],
  // The foosball corner beside reception, carpeted like the games room across the corridor.
  ["games", 10.3, 12.35, 4.6, 4.3, 1.2],
  ["nap", (NAP_ROOM[0] + NAP_ROOM[2]) / 2, (NAP_ROOM[1] + NAP_ROOM[3]) / 2, NAP_ROOM[2] - NAP_ROOM[0], NAP_ROOM[3] - NAP_ROOM[1], 1.2],
  ["events", -17.5, 4.3, 9, 10.6, 1.2],
  ["library", -17.5, 12.05, 9, 4.9, 1.2],
  ["kitchen", 18.25, -6.25, 7.5, 6.5, 0.8],
  ["dining", 18.25, 0, 7.5, 6, 0.8],
  ["lounge", 18.25, 6.15, 7.5, 6.3, 1.2],
  ["games", 18.25, 11.9, 7.5, 5.2, 1.2],
];

/**
 * Each finish at HD detail: a photo surface in the colours of the basic one, and how rough it is. Every zone reuses
 * one of the photo sets the room already loads, so the zones add no downloads.
 */
const HD_FLOORS: Record<FloorKey, { id: SurfaceId; tint?: string; roughness?: number }> = {
  server: { id: "serverTiles", tint: ROOM_PALETTE.floor.server },
  work: { id: "carpet", tint: ROOM_PALETTE.floor.work },
  noc: { id: "carpet", tint: ROOM_PALETTE.floor.monitoring },
  meeting: { id: "carpet", tint: ROOM_PALETTE.floor.meeting },
  kitchen: { id: "kitchenTiles", tint: ROOM_PALETTE.floor.kitchen, roughness: 0.9 },
  events: { id: "carpet", tint: ROOM_PALETTE.floor.events },
  library: { id: "carpet", tint: ROOM_PALETTE.floor.library },
  reception: { id: "concrete", tint: ROOM_PALETTE.floor.reception, roughness: 0.8 },
  dining: { id: "concrete", tint: ROOM_PALETTE.floor.dining, roughness: 0.85 },
  lounge: { id: "carpet", tint: ROOM_PALETTE.floor.lounge },
  games: { id: "carpet", tint: ROOM_PALETTE.floor.games },
  nap: { id: "carpet", tint: ROOM_PALETTE.floor.nap },
  quiet: { id: "carpet", tint: ROOM_PALETTE.floor.quiet },
};

const carpetOf = (c: { base: string; fleck: string }) => carpet(c.base, c.fleck);
/** Each finish at the basic look, drawn when a floor first needs it. */
const BASIC_FLOORS: Record<FloorKey, () => THREE.CanvasTexture> = {
  server: floorTiles,
  work: () => carpetOf(PIXEL_FLOORS.work),
  noc: () => carpetOf(PIXEL_FLOORS.monitoring),
  meeting: () => carpetOf(PIXEL_FLOORS.meeting),
  kitchen: () => kitchenTiles(),
  events: () => carpetOf(PIXEL_FLOORS.events),
  library: () => carpetOf(PIXEL_FLOORS.library),
  reception: () => kitchenTiles(PIXEL_FLOORS.reception),
  dining: () => kitchenTiles(PIXEL_FLOORS.dining),
  lounge: () => carpetOf(PIXEL_FLOORS.lounge),
  games: () => carpetOf(PIXEL_FLOORS.games),
  nap: () => carpetOf(PIXEL_FLOORS.nap),
  quiet: () => carpetOf(PIXEL_FLOORS.quiet),
};

/** A floor's finishes, zone by zone. */
export function Floors({ zones }: { zones: Zone[] }) {
  const textures = useMemo(() => {
    const base = new Map<FloorKey, THREE.CanvasTexture>();
    return zones.map(([key, , , w, d, tile]) => {
      if (!base.has(key)) base.set(key, BASIC_FLOORS[key]());
      const t = (base.get(key) as THREE.CanvasTexture).clone();
      t.repeat.set(w / tile, d / tile);
      t.needsUpdate = true;
      return t;
    });
  }, [zones]);
  // At HD detail, photo surfaces in world metres: one material per finish, shared by its zones.
  const surfaces = useSurfaces();
  const hd = useMemo(() => {
    if (!surfaces) return null;
    const materials = new Map<FloorKey, THREE.Material>();
    for (const [key] of zones) {
      const f = HD_FLOORS[key];
      if (!materials.has(key)) materials.set(key, surfaceMaterial(surfaces[f.id], f.tint, f.roughness));
    }
    const geometries = zones.map(([key, x, z, w, d]) => projectUV(new THREE.PlaneGeometry(w, d), surfaces[HD_FLOORS[key].id].size, [x, -z, 0]));
    return { materials, geometries };
  }, [surfaces, zones]);
  useEffect(
    () => () => {
      hd?.geometries.forEach((g) => g.dispose());
      hd?.materials.forEach((m) => m.dispose());
    },
    [hd],
  );
  return (
    <group>
      {zones.map(([key, x, z, w, d], i) =>
        hd ? (
          <mesh key={`hd${i}`} position={[x, 0.004, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow geometry={hd.geometries[i]} material={hd.materials.get(key)} />
        ) : (
          <mesh key={i} position={[x, 0.004, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[w, d]} />
            <meshLambertMaterial map={textures[i]} />
          </mesh>
        ),
      )}
    </group>
  );
}

/** Seconds into a swing at which the paddle meets the ball. */
const SWING_CONTACT = 0.35;

/** The -x player hits as the ball starts out, the +x player half a rally later. */
const PING = { period: RALLY_PERIOD, at: -SWING_CONTACT };
const PONG = { period: RALLY_PERIOD, at: RALLY_PERIOD / 2 - SWING_CONTACT };

function PingPongBall() {
  const ball = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    // A rally that never ends.
    ball.current?.position.set(...ballAt(clock.elapsedTime));
  });
  return (
    <mesh ref={ball}>
      <sphereGeometry args={[BALL_RADIUS, 8, 6]} />
      <meshBasicMaterial color="#fff7e8" />
    </mesh>
  );
}

/** Figures on each of the foosball table's eight rods, from one goal to the other, and whose side each rod is on. */
const FOOS_FIGURES = [1, 2, 3, 4, 4, 3, 2, 1];
const FOOS_SIDE = [0, 0, 1, 0, 1, 0, 1, 1];
const FOOS_COLOURS = ["#ff4d5e", "#4cb8ff"];

/**
 * The foosball table's rods, handles and little players, twisting and sliding as the two crew members play. All
 * three are instanced, so the table costs three draws however many figures it has.
 */
function FoosballRods() {
  const rods = useRef<THREE.InstancedMesh>(null);
  const handles = useRef<THREE.InstancedMesh>(null);
  const figures = useRef<THREE.InstancedMesh>(null);
  const parts = useMemo(() => {
    const figureCount = FOOS_FIGURES.reduce((a, b) => a + b, 0);
    return {
      rod: new THREE.CylinderGeometry(0.01, 0.01, 1.15, 6).rotateX(Math.PI / 2),
      handle: new THREE.CylinderGeometry(0.022, 0.022, 0.12, 8).rotateX(Math.PI / 2),
      // Each figure hangs from its rod, its feet just above the pitch.
      figure: new THREE.BoxGeometry(0.035, 0.12, 0.05).translate(0, -0.05, 0),
      metal: new THREE.MeshStandardMaterial({ color: ALU, metalness: 0.6, roughness: 0.35 }),
      grip: new THREE.MeshStandardMaterial({ color: INK }),
      paint: new THREE.MeshStandardMaterial({ color: "#ffffff" }),
      figureCount,
    };
  }, []);
  useEffect(() => {
    const colour = new THREE.Color();
    let k = 0;
    FOOS_FIGURES.forEach((n, i) => {
      for (let j = 0; j < n; j++) figures.current?.setColorAt(k++, colour.set(FOOS_COLOURS[FOOS_SIDE[i]]));
    });
    if (figures.current?.instanceColor) figures.current.instanceColor.needsUpdate = true;
    return () => {
      for (const g of [parts.rod, parts.handle, parts.figure]) g.dispose();
      for (const m of [parts.metal, parts.grip, parts.paint]) m.dispose();
    };
  }, [parts]);
  const base = useMemo(() => new THREE.Matrix4(), []);
  const step = useMemo(() => new THREE.Matrix4(), []);
  const out = useMemo(() => new THREE.Matrix4(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    let k = 0;
    FOOS_FIGURES.forEach((n, i) => {
      // Each rod twists back and forth at its own pace and slides a little, as hands work the handles.
      const twist = Math.sin(t * (3 + (i % 3)) + i * 1.3) * 0.9;
      const slide = Math.sin(t * 1.6 + i) * 0.035;
      base.makeRotationZ(twist).setPosition(-0.49 + i * 0.14, 0.82, slide);
      rods.current?.setMatrixAt(i, base);
      for (const side of [0, 1]) handles.current?.setMatrixAt(i * 2 + side, out.copy(base).multiply(step.makeTranslation(0, 0, side ? 0.6 : -0.6)));
      for (let j = 0; j < n; j++) figures.current?.setMatrixAt(k++, out.copy(base).multiply(step.makeTranslation(0, 0, ((j + 0.5) / n - 0.5) * 0.62)));
    });
    for (const m of [rods.current, handles.current, figures.current]) if (m) m.instanceMatrix.needsUpdate = true;
  });
  return (
    <group position={[FOOSBALL.x, 0, FOOSBALL.z]}>
      <instancedMesh ref={rods} args={[parts.rod, parts.metal, FOOS_FIGURES.length]} frustumCulled={false} />
      <instancedMesh ref={handles} args={[parts.handle, parts.grip, FOOS_FIGURES.length * 2]} frustumCulled={false} />
      <instancedMesh ref={figures} args={[parts.figure, parts.paint, parts.figureCount]} frustumCulled={false} />
    </group>
  );
}

/** How tall a zone's name sign is on screen, in CSS pixels, at any zoom: smaller than the equipment's labels. */
const ZONE_NAME_PX = 20;
/** Zoom, in pixels a metre, over which zone names fade out as the camera pulls back: they are too small to read. */
const ZONE_NAME_FADE: [number, number] = [14, 20];
/** Metres tall a zone's sign hangs, seen from the avatar. */
const ZONE_SIGN_TALL = 0.26;

/**
 * Each zone's name floating over it, always facing the camera so it reads at any turn, the same size on screen at
 * any zoom, and glowing a little after dusk. They are drawn in the room rather than on the page, so they stay out of the way of screen readers and of
 * the equipment's own labels, and they fade out as the camera pulls back too far to read them.
 */
export function ZoneNames({ names }: { names: [string, number, number][] }) {
  // The signs are lettered once the interface font has arrived, so they match the rest of the game.
  const [fonts, setFonts] = useState(0);
  useEffect(() => {
    let live = true;
    document.fonts?.load('600 40px "Space Grotesk"').then(() => live && setFonts(1), () => {});
    return () => {
      live = false;
    };
  }, []);
  const signs = useMemo(
    () =>
      names.map(([name, x, z]) => {
        const map = zoneName(name);
        const material = new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, toneMapped: false });
        return { name, x, z, material, aspect: map.image.width / map.image.height, fonts };
      }),
    [fonts, names],
  );
  useEffect(
    () => () => {
      for (const s of signs) {
        s.material.map?.dispose();
        s.material.dispose();
      }
    },
    [signs],
  );
  const sprites = useRef<(THREE.Sprite | null)[]>([]);
  useFrame(({ camera }) => {
    // Seen from the avatar there is no zoom: the signs hang at a size of their own, always lettered.
    const flat = (camera as THREE.OrthographicCamera).isOrthographicCamera;
    const zoom = flat ? (camera as THREE.OrthographicCamera).zoom : ZONE_NAME_FADE[1];
    const t = Math.min(1, Math.max(0, (zoom - ZONE_NAME_FADE[0]) / (ZONE_NAME_FADE[1] - ZONE_NAME_FADE[0])));
    const fade = t * t * (3 - 2 * t);
    // Past 1 the lettering outshines the room, so the glow pass picks it up at night.
    const glow = 1 + 0.4 * daylightNow().dark;
    // The orthographic camera shows `zoom` CSS pixels a metre, so this many metres is always ZONE_NAME_PX tall.
    const tall = flat ? ZONE_NAME_PX / zoom : ZONE_SIGN_TALL;
    sprites.current.forEach((sprite, i) => {
      if (!sprite) return;
      const material = sprite.material;
      material.opacity = fade;
      material.color.setScalar(glow);
      sprite.visible = fade > 0.01;
      sprite.scale.set(tall * signs[i].aspect, tall, 1);
    });
  });
  return (
    <group>
      {signs.map((s, i) => (
        <sprite
          key={s.name}
          ref={(el) => {
            sprites.current[i] = el;
          }}
          material={s.material}
          position={[s.x, ZONE_NAME_HEIGHT, s.z]}
          raycast={ignoreRay}
        />
      ))}
    </group>
  );
}

/** Seconds a "z" takes to drift up from the sleeper and fade, and how many are in the air at once. */
const ZZZ = { period: 3.6, count: 3 };

/** A sleeper's "z"s, drifting up and away one after another from just above their head. */
function Zzz({ position }: { position: V3 }) {
  const materials = useMemo(() => Array.from({ length: ZZZ.count }, () => new THREE.SpriteMaterial({ map: zzzTexture(), transparent: true, depthWrite: false })), []);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  const sprites = useRef<(THREE.Sprite | null)[]>([]);
  useFrame(({ clock }) => {
    sprites.current.forEach((sprite, i) => {
      if (!sprite) return;
      const phase = (clock.elapsedTime / ZZZ.period + i / ZZZ.count) % 1;
      sprite.position.set(position[0] - phase * 0.25, position[1] + phase * 0.7, position[2]);
      const size = 0.2 + phase * 0.22;
      sprite.scale.set(size, size, 1);
      sprite.material.opacity = Math.sin(phase * Math.PI);
    });
  });
  return (
    <group>
      {materials.map((m, i) => (
        <sprite
          key={i}
          ref={(el) => {
            sprites.current[i] = el;
          }}
          material={m}
          raycast={ignoreRay}
        />
      ))}
    </group>
  );
}

/** Wisps of steam rising from the mug under the espresso machine, each fading as it climbs. */
function Steam({ position }: { position: V3 }) {
  // Brighter than the lit room, so the wisps show against the pale kitchen wall behind them.
  const materials = useMemo(() => Array.from({ length: 4 }, () => new THREE.SpriteMaterial({ map: puffTexture(), color: new THREE.Color(1.25, 1.3, 1.35), transparent: true, depthWrite: false, toneMapped: false })), []);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  const sprites = useRef<(THREE.Sprite | null)[]>([]);
  useFrame(({ clock }) => {
    sprites.current.forEach((sprite, i) => {
      if (!sprite) return;
      // Each wisp climbs clear of the machine's top before it fades.
      const phase = (clock.elapsedTime / 3 + i / 4) % 1;
      sprite.position.set(position[0] + Math.sin(phase * 5 + i) * 0.04, position[1] + phase * 0.6, position[2]);
      const size = 0.06 + phase * 0.2;
      sprite.scale.set(size, size, 1);
      sprite.material.opacity = 0.75 * Math.sin(phase * Math.PI);
    });
  });
  return (
    <group>
      {materials.map((m, i) => (
        <sprite
          key={i}
          ref={(el) => {
            sprites.current[i] = el;
          }}
          material={m}
          raycast={ignoreRay}
        />
      ))}
    </group>
  );
}

/** An arcade cabinet's screen playing its attract mode, eight frames a second — except the red cabinet, which runs the real brick breaker while the avatar plays it. */
function ArcadeScreen({ variant, x }: { variant: string; x: number }) {
  const game = useMemo(() => arcadeScreen(variant), [variant]);
  useEffect(() => () => game.texture.dispose(), [game]);
  const shown = useRef(-1);
  // The red cabinet's game lives as long as the avatar's busy with it: starting and ending follow the busy news.
  useEffect(() => {
    if (variant !== "red") return;
    return onBusy((b) => (b?.prop === "arcade" ? startArcade(b.since) : stopArcade()));
  }, [variant]);
  useFrame(({ clock }, dt) => {
    if (variant === "red" && avatar.busy?.prop === "arcade" && arcadeGame) {
      stepArcade(Math.min(dt, 0.25), now());
      drawBreakout(game.ctx, arcadeGame, clock.elapsedTime);
      game.flush();
      shown.current = -1;
      return;
    }
    const fps = avatar.busy?.prop === "arcade" ? 20 : 8;
    const frame = Math.floor(clock.elapsedTime * fps);
    if (frame === shown.current) return;
    shown.current = frame;
    game.draw(frame);
  });
  const rotation = useMemo(() => new THREE.Euler(ARCADE_SCREEN.tilt, 0, 0, "YXZ"), []);
  return (
    <mesh position={[x, ARCADE_SCREEN.y, ARCADE_Z + ARCADE_SCREEN.z]} rotation={rotation}>
      <planeGeometry args={[ARCADE_SCREEN.w, ARCADE_SCREEN.h]} />
      <meshBasicMaterial map={game.texture} toneMapped={false} />
    </mesh>
  );
}

/**
 * The first nap pod's reading light: always mounted so nothing recompiles, its glow only ramped up with the
 * lie-down blend while the avatar sleeps — warming the pillow and the hood's underside in both views.
 */
function NapPodLight() {
  const light = useRef<THREE.PointLight>(null);
  useFrame(() => {
    if (light.current) light.current.intensity = 1.4 * napBlend.value;
  });
  return <pointLight ref={light} position={[NAP_PODS[0][0] + 0.6, 1.0, NAP_PODS[0][1]]} color="#ffd84a" distance={1.6} decay={2} intensity={0} />;
}

/** Red beacon above the monitoring wall that spins up during an incident. */
export function Beacon({ on }: { on: boolean }) {
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
/* The crew                                                            */
/* ------------------------------------------------------------------ */

export interface Crew {
  engineers: number;
  busy: number;
  incident: boolean;
  releases: number;
  promos: number;
}

type Seat = "type" | "relax" | "mug" | "kitchen" | "lounge";

/** Crew who wander the office: where each loop starts, its seed, walking speed, and how far into it they begin. */
const WANDERERS: { species: Species; start: WaypointId; seed: number; speed: number; offset: number }[] = [
  { species: creature(24, "designer"), start: "spineCooler", seed: 3, speed: 0.5, offset: 0 },
  { species: creature(16, "dev"), start: "frontDeploy", seed: 11, speed: 0.5, offset: 17 },
  { species: creature(9, "pm"), start: "gamesLane", seed: 23, speed: 0.65, offset: 34 },
  { species: creature(30, "intern"), start: "kitchenMid", seed: 31, speed: 0.45, offset: 51 },
  { species: creature(43, "marketer"), start: "frontGap", seed: 47, speed: 0.7, offset: 68 },
  { species: creature(45, "security"), start: "libraryLane", seed: 59, speed: 0.55, offset: 85 },
];
const WANDERER_PLANS = WANDERERS.map((w) => planLoop(w.start, w.seed, { legs: 30, speed: w.speed }));

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

function Staff({ crew }: { crew: Crew }) {
  const meetingTv = tvPicture(MEETING_TV);
  const loungeTv = tvPicture(LOUNGE_TV);
  return (
    <group>
      {Array.from({ length: 8 }, (_, i) => {
        const slot = deskSlot(i);
        const hired = i < crew.engineers;
        // During an incident the first engineers are down on the server floor (see ServerFloor.tsx).
        const away = crew.incident && i < RESPONDERS.length;
        const seat = hired && !away ? seatFor(i, crew) : null;
        const screen: ScreenKind = !hired ? "off" : seat === "type" ? "code" : "idle";
        return (
          <group key={i}>
            <ScreenPlane kind={screen} w={PANEL.w} h={PANEL.h} position={at(slot.x, slot.z, slot.rot, [0, PANEL.y, PANEL.z])} rot={slot.rot} />
            {seat && seat !== "kitchen" && seat !== "lounge" && (
              <Creature pose="sit" activity={crew.incident ? "panic" : (seat as Activity)} species={creature(i)} position={[deskSeat(i).x, 0, deskSeat(i).z]} rotation={slot.rot} phase={i * 1.7} />
            )}
            {seat === "kitchen" && <Creature pose="stand" activity="mug" species={creature(i)} position={[SPOTS.kitchenBreak.x, 0, SPOTS.kitchenBreak.z]} rotation={SPOTS.kitchenBreak.rot} phase={i} />}
            {seat === "lounge" &&
              (standsAtDesk(creature(i)) ? (
                <Creature pose="stand" activity="chat" species={creature(i)} position={[SPOTS.loungeStand.x, 0, SPOTS.loungeStand.z]} rotation={SPOTS.loungeStand.rot} phase={i} />
              ) : (
                <Creature pose="sit" activity="laptop" species={creature(i)} position={[SPOTS.sofa.x, 0, SPOTS.sofa.z]} rotation={SPOTS.sofa.rot} phase={i} />
              ))}
          </group>
        );
      })}

      {/* Release engineer, marketer, on-call SRE and receptionist */}
      <ScreenPlane kind={crew.releases > 0 ? "deploy-busy" : "deploy"} w={1.1} h={0.62} position={[POS.deploy.x, 1.28, POS.deploy.z - 0.09]} tilt={-0.35} />
      <Creature pose="stand" activity={crew.releases > 0 || crew.incident ? "type" : "chat"} species={creature(11, "dev")} position={[SPOTS.releaseEngineer.x, 0, SPOTS.releaseEngineer.z]} phase={3} />
      {[-0.45, 0.45].map((dx) => (
        <ScreenPlane key={dx} kind={crew.promos > 0 ? "chart" : "idle"} w={PANEL.w} h={PANEL.h} position={[POS.growth.x - 0.4 + dx, PANEL.y, POS.growth.z + 0.2 + PANEL.z]} />
      ))}
      <ScreenPlane kind="chart" w={1.2} h={0.75} position={[POS.growth.x + 1.15, 1.5, POS.growth.z - 0.52]} />
      <Creature pose="sit" activity={crew.promos > 0 ? "type" : "mug"} species={creature(14, "marketer")} position={[SPOTS.marketer.x, 0, SPOTS.marketer.z]} phase={5} />
      <ScreenPlane kind="idle" w={RECEPTION_SCREEN.w} h={(RECEPTION_SCREEN.w * MAC.screenH) / MAC.screenW} position={[3.2, RECEPTION_SCREEN.y, RECEPTION_SCREEN.z]} rot={Math.PI} />
      <Creature pose="sit" activity="type" species={RECEPTIONIST} position={[SPOTS.receptionist.x, 0, SPOTS.receptionist.z]} rotation={SPOTS.receptionist.rot} phase={2} />

      {/* A meeting in progress */}
      <ScreenPlane kind="slides" w={meetingTv.w} h={meetingTv.h} position={meetingTv.position} rot={Math.PI / 2} />
      <Creature pose="stand" activity="present" species={creature(36, "pm")} position={[SPOTS.presenter.x, 0, SPOTS.presenter.z]} rotation={SPOTS.presenter.rot} phase={1} />
      {/* The founder's chair is the player's: their avatar sits there when not walking (see Avatar.tsx). */}
      <Creature pose="sit" activity="listen" species={creature(34, "designer")} position={[SPOTS.designerInMeeting.x, 0, SPOTS.designerInMeeting.z]} phase={4} />
      <Creature pose="sit" activity="listen" species={creature(35, "data")} position={[SPOTS.analystInMeeting.x, 0, SPOTS.analystInMeeting.z]} phase={6} />

      {/* Kitchen chat, the lounge, a phone call and the townhall */}
      <Creature pose="stand" activity="chat" species={creature(31, "intern")} position={[SPOTS.kitchenChat.x, 0, SPOTS.kitchenChat.z]} rotation={SPOTS.kitchenChat.rot} phase={8} />
      <Creature pose="sit" activity="listen" species={creature(27, "dev")} position={[SPOTS.sofaListener.x, 0, SPOTS.sofaListener.z]} rotation={SPOTS.sofaListener.rot} phase={9} />
      <Creature pose="stand" activity="chat" species={creature(38, "marketer")} position={[SPOTS.phoneBooth.x, 0, SPOTS.phoneBooth.z]} rotation={SPOTS.phoneBooth.rot} phase={10} />
      <Creature pose="sit" activity="laptop" species={creature(40, "data")} position={[SPOTS.townhallReader.x, 0, SPOTS.townhallReader.z]} rotation={SPOTS.townhallReader.rot} phase={11} seat={0.8} />
      <ScreenPlane kind="slides" w={2.1} h={1.12} position={[-14.35, 1.5, 4.5]} rot={-Math.PI / 2} />
      <ScreenPlane kind="game" w={loungeTv.w} h={loungeTv.h} position={loungeTv.position} rot={Math.PI / 2} />
      {ARCADES.map(([variant, x]) => (
        <ArcadeScreen key={x} variant={variant} x={x} />
      ))}

      {/* Small groups chatting, and crew wandering the office on loops of their own */}
      {GROUPS.map((g) => (
        <Conversation key={g.name} group={g} incident={crew.incident} />
      ))}
      {WANDERERS.map((w, i) => (
        <Wanderer key={i} plan={WANDERER_PLANS[i]} species={w.species} offset={w.offset} />
      ))}

      {/* The open floor, the quiet room and a call in the huddle room */}
      {OPEN_CREW.map((c, i) => (
        <Creature key={i} pose={c.pose} activity={crew.incident && c.activity === "type" ? "panic" : c.activity} species={c.species} position={[c.spot.x, 0, c.spot.z]} rotation={c.spot.rot} phase={12 + i * 1.3} />
      ))}
      {OPEN_CREW.filter((c) => c.desk !== undefined).map((c) => {
        const s = openDeskSlot(c.desk as number);
        return <ScreenPlane key={c.desk} kind="code" w={PANEL.w} h={PANEL.h} position={at(s.x, s.z, s.rot, [0, PANEL.y, PANEL.z])} rot={s.rot} />;
      })}
      <ScreenPlane kind="code" w={PANEL.w} h={PANEL.h} position={at(QUIET_DESKS[1].x, QUIET_DESKS[1].z, QUIET_DESKS[1].rot, [0, PANEL.y, PANEL.z])} rot={QUIET_DESKS[1].rot} />
      <ScreenPlane kind="slides" w={1.8} h={1.0} position={[(HUDDLE_ROOM[0] + HUDDLE_ROOM[2]) / 2, 1.45, HUDDLE_ROOM[1] + 0.38]} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* The office                                                          */
/* ------------------------------------------------------------------ */

preloadModels();
preloadCreatures();

export function Office({ crew }: { crew: Crew }) {
  // The zones keep their sounds to themselves during an incident.
  useEffect(() => {
    viewFocus.hush = crew.incident;
  }, [crew.incident]);
  const prims = useMemo(() => buildStatic(), []);
  const models = useMemo(() => buildModels(), []);
  const wall = useMemo(() => buildWallMounted(), []);
  const props = useMemo(() => buildProps(), []);
  return (
    <group>
      <Floors zones={ZONES} />
      <PrimBatch prims={prims} />
      <ModelBatch placements={models} />
      <DetailedProps items={props} />
      <Glass />
      <ZoneNames names={ZONE_NAMES} />
      <WhiteboardFace position={[-12.27, 1.45, 7.4]} rot={Math.PI / 2} />
      <Staff crew={crew} />
      <PingPongBall />
      {/* Two players at the ends of the table, each swinging as the ball reaches them. */}
      <Creature species="frog" activity="play" holding="paddle" position={[SPOTS.pingPlayer.x, 0, SPOTS.pingPlayer.z]} rotation={SPOTS.pingPlayer.rot} beat={PING} />
      <Creature species="bunny" activity="play" holding="paddle" position={[SPOTS.pongPlayer.x, 0, SPOTS.pongPlayer.z]} rotation={SPOTS.pongPlayer.rot} beat={PONG} />
      {/* A foosball match beside reception, and someone asleep in a nap pod. */}
      <FoosballRods />
      <Creature species="ninja" activity="type" position={[SPOTS.foosballSouth.x, 0, SPOTS.foosballSouth.z]} rotation={SPOTS.foosballSouth.rot} phase={4} />
      <Creature species="cat" activity="type" position={[SPOTS.foosballNorth.x, 0, SPOTS.foosballNorth.z]} rotation={SPOTS.foosballNorth.rot} phase={9} />
      <Creature species="pinkSlime" pose="sit" activity="doze" position={[SPOTS.napper.x, 0, SPOTS.napper.z]} rotation={SPOTS.napper.rot} phase={3} seat={NAP_MATTRESS} />
      <Zzz position={[SPOTS.napper.x, NAP_MATTRESS + 0.75, SPOTS.napper.z]} />
      <NapPodLight />
      <Steam position={ESPRESSO_MUG} />

      <OnWall wall="left">
        <ModelBatch placements={wall.left} shadows={false} />
        {FRAMES.map((f) => (
          <Poster key={f.poster} kind={f.poster} position={[FRAME_X + 0.065, f.mid, f.z]} w={f.w} h={f.h} />
        ))}
        <NeonLogo position={[ROOM.x0 + 0.08, 2.5, 4.5]} rot={Math.PI / 2} />
        <CityWindow position={[ROOM.x0 + 0.06, 1.8, -0.2]} rot={Math.PI / 2} w={1.6} h={1.5} />
        <CityWindow position={[ROOM.x0 + 0.06, 1.8, 8.9]} rot={Math.PI / 2} w={1.6} h={1.5} />
      </OnWall>
      <OnWall wall="back">
        <ModelBatch placements={wall.back} shadows={false} />
        <CityWindow position={[18.8, 2.1, ROOM.z0 + 0.08]} w={2.2} h={1.2} />
        <WallClock position={[4.2, 2.35, ROOM.z0 + 0.06]} />
      </OnWall>
      <OnWall wall="right">
        <CityWindow position={[ROOM.x1 - 0.06, 1.8, 2.0]} rot={-Math.PI / 2} w={2.2} h={1.5} />
        <CityWindow position={[ROOM.x1 - 0.06, 1.8, 7.5]} rot={-Math.PI / 2} w={2.2} h={1.5} />
      </OnWall>
    </group>
  );
}
