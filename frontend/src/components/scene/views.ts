import { ROOM } from "./layout";

/*
 * Where the views from the avatar put the camera (see game/viewpoints.ts): a few metres behind and above it, or at
 * its eyes; how one eases into the next; and how the overview picks up where they left off. Plain arithmetic on
 * numbers, kept free of React and three.js so it can be tested.
 *
 * A heading is the way the camera looks across the floor, measured like a creature's yaw: 0 looks along -z, and
 * it turns anticlockwise seen from above. A pitch is how far the camera looks down below the horizon.
 */

/** Seconds one view takes to give way to the next, unless the player asks for less motion. */
export const VIEW_EASE = 0.6;

/** A camera's place, the point it looks at and its vertical field of view in degrees. */
export interface Pose {
  x: number;
  y: number;
  z: number;
  lx: number;
  ly: number;
  lz: number;
  fov: number;
}

/** The view from behind the avatar. Distances in metres, angles in radians. */
export const FOLLOW = {
  distance: 4.5,
  nearest: 2,
  farthest: 9,
  /** How steeply it may look down when a wall behind leaves it no room to stand back. */
  steepest: 1.4,
  /** Metres across the floor it keeps from the avatar however close the wall behind: less than the avatar's own clearance. */
  least: 0.15,
  pitch: 0.45,
  lowest: 0.08,
  highest: 1.15,
  /** Height above the floor it looks at: the middle of a cube animal. */
  aim: 0.55,
  fov: 55,
  /** How far it keeps inside the outer walls and under their tops. */
  margin: 0.35,
  /** Seconds it takes to catch up with most of the avatar's move, so it follows loosely. */
  lag: 0.14,
};

/** The view through the avatar's eyes. */
export const FIRST = {
  /** Eye height above the floor: a little over a cube animal's head, so desks do not fill the view. */
  eye: 1.0,
  /** How far it can look up or down. */
  pitch: 1.25,
  /** Radians a second the arrow keys turn it. */
  turnRate: 2.2,
  /** Walking speed as a share of walk mode's, gentler indoors. */
  pace: 0.7,
};

/** Radians of look for each pixel the pointer moves. */
export const LOOK_PER_PIXEL = 0.0045;

/** Ease in and out over 0..1. */
export const ease = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/** The direction across the floor a heading looks along. */
export const headingDir = (h: number): [number, number] => [-Math.sin(h), -Math.cos(h)];

/** The heading that looks along (dx, dz). */
export const headingOf = (dx: number, dz: number) => Math.atan2(-dx, -dz);

/** Keep a value between two bounds. */
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A wall the follow view cannot see through, as [x1, z1, x2, z2]. */
export type Wall = [number, number, number, number];

/**
 * How far along the way from (ax, az) to (bx, bz), from 0 to 1, it first meets one of `walls`; 1 if it meets none.
 */
export function firstHit(ax: number, az: number, bx: number, bz: number, walls: readonly Wall[]): number {
  let best = 1;
  const rx = bx - ax;
  const rz = bz - az;
  for (const [x1, z1, x2, z2] of walls) {
    const sx = x2 - x1;
    const sz = z2 - z1;
    const cross = rx * sz - rz * sx;
    if (Math.abs(cross) < 1e-9) continue;
    const t = ((x1 - ax) * sz - (z1 - az) * sx) / cross;
    const u = ((x1 - ax) * rz - (z1 - az) * rx) / cross;
    if (t >= 0 && t < best && u >= 0 && u <= 1) best = t;
  }
  return best;
}

/** How far from (x, z) along (dx, dz) one can go and stay `margin` inside the outer walls. */
export function reachInside(x: number, z: number, dx: number, dz: number, margin = FOLLOW.margin): number {
  let t = Infinity;
  const lo = [ROOM.x0 + margin, ROOM.z0 + margin];
  const hi = [ROOM.x1 - margin, ROOM.z1 - margin];
  const at = [x, z];
  const by = [dx, dz];
  for (let i = 0; i < 2; i++) {
    if (by[i] > 1e-9) t = Math.min(t, (hi[i] - at[i]) / by[i]);
    else if (by[i] < -1e-9) t = Math.min(t, (lo[i] - at[i]) / by[i]);
  }
  return Math.max(0, t);
}

/**
 * The follow view of an avatar standing at (x, floorY, z): `distance` metres back from the point it looks at, along
 * `heading`, raised by `pitch`. It never leaves the room, rises above the walls' tops or stands behind one of
 * `walls`, so no wall is ever between it and the avatar. Short of room behind, it rises and looks down more steeply
 * rather than come right up to the avatar's face, and only then comes in closer.
 */
export function followPose(x: number, floorY: number, z: number, heading: number, pitch: number, distance: number, walls: readonly Wall[] = [], fov = FOLLOW.fov): Pose {
  let p = clamp(pitch, FOLLOW.lowest, FOLLOW.highest);
  let d = clamp(distance, FOLLOW.nearest, FOLLOW.farthest);
  const ly = floorY + FOLLOW.aim;
  const top = floorY + ROOM.wallH - FOLLOW.margin;
  // How far behind the avatar there is floor to stand on, before the outer walls or one of `walls`.
  const [fx, fz] = headingDir(heading);
  let room = Math.min(FOLLOW.farthest, reachInside(x, z, -fx, -fz));
  const hit = firstHit(x, z, x - fx * room, z - fz * room, walls);
  if (hit < 1) room = hit * room - FOLLOW.margin;
  // Even with its back to a wall the avatar stands clear of it by more than this, so the camera always has a little.
  room = Math.max(room, FOLLOW.least);
  if (d * Math.cos(p) > room) p = Math.max(p, Math.min(FOLLOW.steepest, Math.acos(clamp(room / d, 0, 1))));
  if (ly + Math.sin(p) * d > top) d = (top - ly) / Math.sin(p);
  d = Math.min(d, room / Math.cos(p));
  const bx = -fx * Math.cos(p);
  const bz = -fz * Math.cos(p);
  return { x: x + bx * d, y: ly + Math.sin(p) * d, z: z + bz * d, lx: x, ly, lz: z, fov };
}

/** The view through the eyes of an avatar standing at (x, floorY, z), looking along `heading`, down by `pitch`. */
export function firstPose(x: number, floorY: number, z: number, heading: number, pitch: number, fov: number): Pose {
  const p = clamp(pitch, -FIRST.pitch, FIRST.pitch);
  const [fx, fz] = headingDir(heading);
  const y = floorY + FIRST.eye;
  return { x, y, z, lx: x + fx * Math.cos(p), ly: y - Math.sin(p), lz: z + fz * Math.cos(p), fov };
}

/** Part way, `t` from 0 to 1, from one pose to another: eased, so it starts and stops gently. */
export function blendPose(a: Pose, b: Pose, t: number): Pose {
  const k = ease(t);
  const mix = (u: number, v: number) => u + (v - u) * k;
  return { x: mix(a.x, b.x), y: mix(a.y, b.y), z: mix(a.z, b.z), lx: mix(a.lx, b.lx), ly: mix(a.ly, b.ly), lz: mix(a.lz, b.lz), fov: mix(a.fov, b.fov) };
}

/**
 * Between the overview and a view from the avatar the picture cannot slide, as one is flat and the other has depth:
 * it dims, cuts while dark and comes back. How dark it is `t` seconds in, and whether the cut has happened.
 */
export function dimAt(t: number, length = VIEW_EASE): { dark: number; cut: boolean } {
  const half = length / 2;
  if (t <= 0) return { dark: 0, cut: false };
  if (t >= length) return { dark: 0, cut: true };
  return t < half ? { dark: ease(t / half), cut: false } : { dark: ease((length - t) / half), cut: true };
}

/**
 * The overview camera's place relative to the point it looks at, `distance` back along `heading` and tilted
 * `polar` radians from straight down, as MapControls measures it.
 */
export function overviewOffset(heading: number, polar: number, distance: number): [number, number, number] {
  const [fx, fz] = headingDir(heading);
  const across = Math.sin(polar) * distance;
  return [-fx * across, Math.cos(polar) * distance, -fz * across];
}

/** The heading a camera at `offset` from what it looks at faces. */
export const headingFromOffset = (ox: number, oz: number) => headingOf(-ox, -oz);
