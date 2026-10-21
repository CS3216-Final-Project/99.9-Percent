import type { Floor } from "@/game/floors";
import { ELEVATOR_DOOR, ELEVATOR_SPOT } from "./floorplan";
import { ROOM } from "./layout";
import { FLOOR_Y } from "./levels";

/*
 * The elevator's working parts, as plain numbers: the car inside its shaft, the rails it runs on, the counterweight
 * behind it that goes down as the car goes up, the ropes over the drive sheave at the top of the shaft that join
 * them, and the travelling cable hanging under the car. Elevator.tsx draws them; kept free of React and three.js so
 * the geometry can be tested.
 *
 * The shaft is ELEVATOR_SPOT, its doors facing +x. The counterweight runs at the back (-x), so the car stands a
 * little forward of the shaft's middle, between its two guide rails on the -z and +z sides.
 */

const [SX0, SZ0, SX1, SZ1] = ELEVATOR_SPOT;

/** Height of a storey's slab under its floor: from the lower floor's ceiling up to the upper floor's surface. */
export const SLAB = FLOOR_Y.office - (FLOOR_Y.servers + ROOM.wallH);

/** The pit under the lowest landing, where the buffers stand. */
export const PIT = { depth: 0.5 };

/** The car, as its inside: floor to ceiling, and wall to wall. Its floor is at the height of the ride. */
export const CABIN = {
  x0: SX0 + 0.52,
  x1: SX1 - 0.14,
  z0: SZ0 + 0.2,
  z1: SZ1 - 0.2,
  /** Inside height, floor to ceiling. */
  h: 2.35,
  /** The car's floor and its roof are this thick. */
  floor: 0.12,
  roof: 0.08,
  /** The crosshead over the roof that the ropes hang from, this far above the roof. */
  crosshead: 0.16,
} as const;

export const CABIN_CX = (CABIN.x0 + CABIN.x1) / 2;
export const CABIN_CZ = (CABIN.z0 + CABIN.z1) / 2;

/** The car's doors, in its front wall, as wide as the landing doors and in line with them. */
export const CAR_DOOR = { w: ELEVATOR_DOOR.w, h: 2.1, z: ELEVATOR_DOOR.z };

/** The counterweight: a frame of stacked steel plates, running between its own rails at the back of the shaft. */
export const COUNTERWEIGHT = { x: SX0 + 0.26, z: (SZ0 + SZ1) / 2, w: 0.2, d: 0.8, h: 1.6, plates: 12 };

/** The drive sheave at the top of the shaft, its axle along z, between the counterweight's ropes and the car's. */
const ROPE_X = { car: CABIN.x0 + 0.24, counterweight: COUNTERWEIGHT.x };
export const SHEAVE = {
  x: (ROPE_X.car + ROPE_X.counterweight) / 2,
  r: (ROPE_X.car - ROPE_X.counterweight) / 2,
  y: FLOOR_Y.office + ROOM.wallH - 0.38,
  z: (SZ0 + SZ1) / 2,
  /** How far the four ropes spread along the axle. */
  spread: 0.21,
};
export const ROPES = 4;

/** Where the ropes run, each vertical: x, and z for each of the four. */
export const ROPE_LINES = {
  car: ROPE_X.car,
  counterweight: ROPE_X.counterweight,
  z: Array.from({ length: ROPES }, (_, i) => SHEAVE.z - SHEAVE.spread / 2 + (SHEAVE.spread * i) / (ROPES - 1)),
};

/** The guide rails, as (x, z) lines up the shaft: the car's either side of it, the counterweight's either side of that. */
export const RAILS = {
  car: [
    [CABIN_CX, SZ0 + 0.07],
    [CABIN_CX, SZ1 - 0.07],
  ] as [number, number][],
  counterweight: [
    [COUNTERWEIGHT.x, COUNTERWEIGHT.z - COUNTERWEIGHT.d / 2 - 0.06],
    [COUNTERWEIGHT.x, COUNTERWEIGHT.z + COUNTERWEIGHT.d / 2 + 0.06],
  ] as [number, number][],
};

/** The bottom and the top of the whole shaft: the pit's floor, and just over the drive sheave. */
export const SHAFT_SPAN = { bottom: FLOOR_Y.servers - PIT.depth, top: FLOOR_Y.office + ROOM.wallH };

/** The top of the car's crosshead, where its ropes are fastened, with the car's floor at `carY`. */
export const carTop = (carY: number) => carY + CABIN.h + CABIN.roof + CABIN.crosshead;

/**
 * The counterweight's foot, with the car's floor at `carY`. The two hang from the same ropes over the sheave, so
 * every metre the car rises the counterweight falls: it is near the pit with the car at the top, and near the
 * sheave with the car at the bottom.
 */
export function counterweightFoot(carY: number): number {
  return FLOOR_Y.servers + FLOOR_Y.office - carY + 0.3;
}

/**
 * The travelling cable: fastened to the shaft's back wall at `anchor`, hanging in a loop of radius `r` and rising
 * to the car's underside. Its two straight runs stand a loop's width apart.
 */
const CABLE_R = 0.26;
export const TRAVELLING = { anchor: FLOOR_Y.office - 1.0, r: CABLE_R, x: { wall: SX0 + 0.08, car: SX0 + 0.08 + 2 * CABLE_R }, z: SZ1 - 0.26 };
/** As low as the loop ever hangs: just over the pit's floor, with the car at the lowest landing. */
const LOWEST_LOOP = FLOOR_Y.servers - PIT.depth + 0.05 + TRAVELLING.r;
const CABLE_STRAIGHT = FLOOR_Y.servers - CABIN.floor - LOWEST_LOOP + (TRAVELLING.anchor - LOWEST_LOOP);

/**
 * How low the travelling cable's loop hangs, with the car's floor at `carY`. The cable is one length: from the
 * car's underside down to the loop and back up to where it is fastened, so the loop falls half as far as the car.
 */
export function cableLoop(carY: number): number {
  const under = carY - CABIN.floor;
  return (under + TRAVELLING.anchor - CABLE_STRAIGHT) / 2;
}

/** The length of the travelling cable's two straight runs, with the car's floor at `carY`: always the same. */
export function cableLength(carY: number): number {
  const loop = cableLoop(carY);
  return carY - CABIN.floor - loop + (TRAVELLING.anchor - loop);
}

/** The part of a vertical run from `a` to `b` (a below b) that lies within [lo, hi], or null if none does. */
export function clipSpan(a: number, b: number, lo: number, hi: number): [number, number] | null {
  const from = Math.max(a, lo);
  const to = Math.min(b, hi);
  return to > from ? [from, to] : null;
}

/** The heights of the shaft that can be seen: one floor's, from its slab or pit up to its ceiling, or the whole shaft. */
export function visibleBand(shown: Floor | "both"): [number, number] {
  if (shown === "both") return [SHAFT_SPAN.bottom, SHAFT_SPAN.top];
  const below = shown === "servers" ? PIT.depth : SLAB;
  return [FLOOR_Y[shown] - below, FLOOR_Y[shown] + ROOM.wallH];
}

/** Where riders stand in the car: the avatar in the middle (walk.ts's CAR), the others in the corners, facing the doors. */
export const RIDER_SPOTS: [number, number][] = [
  [CABIN.x0 + 0.35, CABIN.z0 + 0.38],
  [CABIN.x0 + 0.35, CABIN.z1 - 0.38],
  [CABIN.x1 - 0.55, CABIN.z0 + 0.32],
  [CABIN.x1 - 0.55, CABIN.z1 - 0.32],
];

/**
 * A floor's surface, or its slab, as rectangles round the shaft, which the car passes down through: the whole
 * room, `pad` metres wider all round, less the shaft. As [x0, z0, x1, z1].
 */
export function aroundShaft(pad = 0): [number, number, number, number][] {
  const x0 = ROOM.x0 - pad;
  const x1 = ROOM.x1 + pad;
  const z0 = ROOM.z0 - pad;
  const z1 = ROOM.z1 + pad;
  return [
    [x0, z0, SX0, z1],
    [SX1, z0, x1, z1],
    [SX0, z0, SX1, SZ0],
    [SX0, SZ1, SX1, z1],
  ];
}

/** The car's walls from the inside, as segments a follow camera keeps within. */
export const CABIN_WALLS: [number, number, number, number][] = [
  [CABIN.x0, CABIN.z0, CABIN.x1, CABIN.z0],
  [CABIN.x1, CABIN.z0, CABIN.x1, CABIN.z1],
  [CABIN.x1, CABIN.z1, CABIN.x0, CABIN.z1],
  [CABIN.x0, CABIN.z1, CABIN.x0, CABIN.z0],
];

/** Whether (x, z) is inside the car. */
export const inCabin = (x: number, z: number) => x > CABIN.x0 && x < CABIN.x1 && z > CABIN.z0 && z < CABIN.z1;
