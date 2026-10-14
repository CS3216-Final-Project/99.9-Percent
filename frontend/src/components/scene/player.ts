import { floorOf, otherFloor, type Floor } from "@/game/floors";
import type { EquipmentId } from "@/sim";
import { ELEVATOR_DOOR, ELEVATOR_SPOT, FUN_PROPS, type FunProp } from "./floorplan";
import type { Footprint } from "./layout";
import { AVATAR_RADIUS, blocked, type World } from "./navgrid";

/*
 * The player's avatar on the move: one step of walking from the keys held and the time passed, sliding along whatever
 * it bumps into; following a planned walk; and what is within reach to use. Walking never changes the game: using
 * equipment does exactly what clicking it does.
 *
 * Kept free of React and three.js so the moves can be tested.
 */

/** Metres a second: a walk, and a run with Shift held. */
export const SPEED = { walk: 1.4, run: 2.8 };

/** Radians a second the avatar turns to face where it goes. */
export const TURN_RATE = 10;

/** The longest move checked in one go, so a slow frame cannot carry the avatar through a pane of glass. */
const STEP = AVATAR_RADIUS / 2;

/**
 * Move from (x, z) by (dx, dz) metres, sliding along walls and furniture rather than stopping dead: if the way
 * straight on is blocked, it goes as far as it can along x or along z instead.
 */
export function slide(world: World, x: number, z: number, dx: number, dz: number): [number, number] {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / STEP));
  const sx = dx / steps;
  const sz = dz / steps;
  for (let i = 0; i < steps; i++) {
    if (!blocked(world, x + sx, z + sz)) {
      x += sx;
      z += sz;
    } else if (sx && !blocked(world, x + sx, z)) x += sx;
    else if (sz && !blocked(world, x, z + sz)) z += sz;
    else break;
  }
  return [x, z];
}

/** Which way the movement keys point. */
export interface Keys {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

/**
 * The direction to walk on the floor, a unit vector or [0, 0], for the keys held, relative to the view: up walks away
 * from the camera along `forward`, which points across the floor from the camera to what it looks at.
 */
export function steer(keys: Keys, forward: [number, number]): [number, number] {
  const len = Math.hypot(forward[0], forward[1]) || 1;
  const fx = forward[0] / len;
  const fz = forward[1] / len;
  // To the right of looking along (fx, fz) on a y-up floor.
  const rx = -fz;
  const rz = fx;
  const ahead = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
  const side = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const x = fx * ahead + rx * side;
  const z = fz * ahead + rz * side;
  const m = Math.hypot(x, z);
  return m > 0 ? [x / m, z / m] : [0, 0];
}

/** The way to face to look along (dx, dz); creatures face -z at 0. */
export const facing = (dx: number, dz: number) => Math.atan2(-dx, -dz);

/** Turn from `yaw` towards `target` by at most `rate * dt`, the short way round. */
export function turnTowards(yaw: number, target: number, dt: number, rate = TURN_RATE): number {
  const delta = target - yaw - 2 * Math.PI * Math.round((target - yaw) / (2 * Math.PI));
  const max = rate * dt;
  return yaw + Math.max(-max, Math.min(max, delta));
}

/**
 * Walk along a planned path at `speed` for `dt` seconds. Returns where the avatar ends up, the way it went, and the
 * rest of the path; it is empty once there.
 */
export function followPath(world: World, x: number, z: number, path: [number, number][], speed: number, dt: number): { x: number; z: number; dx: number; dz: number; path: [number, number][] } {
  let left = speed * dt;
  let rest = path;
  let dx = 0;
  let dz = 0;
  while (left > 1e-6 && rest.length) {
    const [tx, tz] = rest[0];
    const d = Math.hypot(tx - x, tz - z);
    if (d < 1e-3) {
      rest = rest.slice(1);
      continue;
    }
    const go = Math.min(left, d);
    dx = (tx - x) / d;
    dz = (tz - z) / d;
    const [nx, nz] = slide(world, x, z, dx * go, dz * go);
    const moved = Math.hypot(nx - x, nz - z);
    x = nx;
    z = nz;
    left -= go;
    if (go >= d - 1e-6) rest = rest.slice(1);
    // Something stands in the way that was not there when the walk was planned: stop rather than push against it.
    else if (moved < go * 0.2) return { x, z, dx, dz, path: [] };
  }
  return { x, z, dx, dz, path: rest };
}

/* ------------------------------------------------------------------ */
/* Within reach                                                        */
/* ------------------------------------------------------------------ */

/** How far beyond its outline a piece of equipment can be used from. */
export const REACH = 0.8;
/** How near a fun prop the avatar must stand. */
const PROP_REACH = 0.9;

/** Something the avatar can use where it stands. */
export type Prompt =
  | { kind: "equipment"; id: EquipmentId; label: string }
  | { kind: "elevator"; to: Floor; label: string }
  | { kind: "prop"; prop: FunProp; label: string };

/** Inside the elevator's car, or in front of its doors. */
export function atElevator(x: number, z: number): boolean {
  const [x0, z0, x1, z1] = ELEVATOR_SPOT;
  const inside = x > x0 && x < x1 && z > z0 && z < z1;
  const before = x >= x1 && x < x1 + 1.3 && Math.abs(z - ELEVATOR_DOOR.z) < ELEVATOR_DOOR.w / 2 + 0.35;
  return inside || before;
}

/**
 * What the avatar standing at (x, z) on `floor` can use: the elevator first, then the nearest piece of equipment on
 * this floor within reach of its outline, then a fun prop. Null if nothing is in reach.
 */
export function promptAt(floor: Floor, x: number, z: number, footprints: Record<EquipmentId, Footprint>, names: Record<EquipmentId, string>): Prompt | null {
  if (atElevator(x, z)) {
    const to = otherFloor(floor);
    return { kind: "elevator", to, label: to === "office" ? "Ride up to the office floor" : "Ride down to the server floor" };
  }
  let best: { id: EquipmentId; d: number } | null = null;
  for (const id of Object.keys(footprints) as EquipmentId[]) {
    if (floorOf(id) !== floor) continue;
    const f = footprints[id];
    const d = Math.hypot(Math.max(Math.abs(x - f.x) - f.w / 2, 0), Math.max(Math.abs(z - f.z) - f.d / 2, 0));
    if (d <= REACH && (!best || d < best.d)) best = { id, d };
  }
  if (best) return { kind: "equipment", id: best.id, label: `Inspect ${names[best.id]}` };
  if (floor === "office") {
    const prop = FUN_PROPS.find((p) => Math.hypot(p.x - x, p.z - z) <= PROP_REACH);
    if (prop) return { kind: "prop", prop, label: prop.label };
  }
  return null;
}
