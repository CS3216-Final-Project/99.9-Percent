import type { Floor } from "@/game/floors";
import { GROUPS } from "./conversations";
import { GLASS, OBSTACLES, OUTER_WALLS, ROOM_OBSTACLES, SERVER_GLASS, serverObstacles, SHAFT, SPOTS, type Obstacle, type Racks, type Segment } from "./floorplan";
import { ROOM } from "./layout";

/*
 * Where the player's avatar can walk on each floor, and the shortest way between two places. A floor's world is its
 * walls (the outer walls, the glass with its doorways left open, and the elevator's shaft with its doorway) and the
 * things standing on it: furniture, the crew who stay put and, on the server floor, the machines built so far.
 * Paths are planned on a grid of small cells; whether a place is free is always decided against the walls and
 * furniture themselves, so a doorway is never lost to rounding.
 *
 * Kept free of React and three.js so the walks can be tested.
 */

/** What walking on a floor keeps clear of, indexed by square metre so a check looks only at what is near. */
export interface World {
  walls: Segment[];
  obstacles: Obstacle[];
  near: Map<number, { walls: Segment[]; obstacles: Obstacle[] }>;
}

/** Bodies checked against a world are at most this wide from their middle. */
const MAX_RADIUS = 0.5;
const bucket = (x: number, z: number) => Math.floor(x + 100) * 1000 + Math.floor(z + 100);

/** A world of these walls and furniture. */
export function makeWorld(walls: Segment[], obstacles: Obstacle[]): World {
  const near: World["near"] = new Map();
  const add = (x0: number, z0: number, x1: number, z1: number, put: (b: { walls: Segment[]; obstacles: Obstacle[] }) => void) => {
    for (let x = Math.floor(x0 - MAX_RADIUS); x <= Math.floor(x1 + MAX_RADIUS); x++) {
      for (let z = Math.floor(z0 - MAX_RADIUS); z <= Math.floor(z1 + MAX_RADIUS); z++) {
        const k = bucket(x, z);
        let b = near.get(k);
        if (!b) near.set(k, (b = { walls: [], obstacles: [] }));
        put(b);
      }
    }
  };
  for (const w of walls) add(Math.min(w[0], w[2]), Math.min(w[1], w[3]), Math.max(w[0], w[2]), Math.max(w[1], w[3]), (b) => b.walls.push(w));
  for (const o of obstacles) {
    const [x0, z0, x1, z1] = "box" in o ? o.box : [o.disc[0] - o.disc[2], o.disc[1] - o.disc[2], o.disc[0] + o.disc[2], o.disc[1] + o.disc[2]];
    add(x0, z0, x1, z1, (b) => b.obstacles.push(o));
  }
  return { walls, obstacles, near };
}

/** How far the avatar's middle keeps from anything: about half its width. */
export const AVATAR_RADIUS = 0.26;

/** The crew who stand still on the office floor, beside what they are doing: the avatar walks round them. */
function standingCrew(): Obstacle[] {
  const standing = [SPOTS.releaseEngineer, SPOTS.kitchenBreak, SPOTS.kitchenChat, SPOTS.foosballSouth, SPOTS.foosballNorth, SPOTS.pingPlayer, SPOTS.pongPlayer, SPOTS.standing];
  return [
    ...standing.map((s, i): Obstacle => ({ name: `crew member ${i}`, disc: [s.x, s.z, 0.28] })),
    ...GROUPS.flatMap((g) => g.members.map((m, i): Obstacle => ({ name: `${g.name}, member ${i}`, disc: [m.x, m.z, 0.28] }))),
  ];
}

/** What a floor's world is made of: the office never changes; the server floor changes with the machines standing. */
const keyOf = (floor: Floor, racks: Racks) => (floor === "office" ? floor : `${floor} ${JSON.stringify(racks)}`);

/** The latest world worked out for each floor, by what it was made of. */
const worlds = new Map<Floor, { key: string; world: World }>();

/** A floor's walls and furniture, with these machines standing in the server hall. */
export function worldOf(floor: Floor, racks: Racks): World {
  const key = keyOf(floor, racks);
  const known = worlds.get(floor);
  if (known?.key === key) return known.world;
  const world =
    floor === "office"
      ? makeWorld([...OUTER_WALLS, ...GLASS, ...SHAFT], [...OBSTACLES, ...ROOM_OBSTACLES, ...standingCrew()])
      : makeWorld([...OUTER_WALLS, ...SERVER_GLASS, ...SHAFT], serverObstacles(racks));
  worlds.set(floor, { key, world });
  return world;
}

/* ------------------------------------------------------------------ */
/* Distances                                                           */
/* ------------------------------------------------------------------ */

/** Distance from (x, z) to a wall. */
export function toSegment(x: number, z: number, [x1, z1, x2, z2]: Segment): number {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len2 = dx * dx + dz * dz;
  const t = len2 ? Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / len2)) : 0;
  return Math.hypot(x - (x1 + t * dx), z - (z1 + t * dz));
}

/** Distance from (x, z) to a piece of furniture's edge; 0 inside it. */
export function toObstacle(x: number, z: number, o: Obstacle): number {
  if ("disc" in o) {
    const [cx, cz, r] = o.disc;
    return Math.max(0, Math.hypot(x - cx, z - cz) - r);
  }
  const [x0, z0, x1, z1] = o.box;
  return Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1));
}

/** Whether a body `r` wide from its middle at (x, z) would touch a wall or furniture, or stand outside the room. */
export function blocked(world: World, x: number, z: number, r = AVATAR_RADIUS): boolean {
  if (x < ROOM.x0 + r || x > ROOM.x1 - r || z < ROOM.z0 + r || z > ROOM.z1 - r) return true;
  const near = world.near.get(bucket(x, z));
  if (!near) return false;
  for (const s of near.walls) if (toSegment(x, z, s) < r) return true;
  for (const o of near.obstacles) if (toObstacle(x, z, o) < r) return true;
  return false;
}

/** Whether a body can move straight from a to b without touching anything, checked every few centimetres. */
export function clearLine(world: World, a: [number, number], b: [number, number], r = AVATAR_RADIUS): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.05));
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    if (blocked(world, a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, r)) return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* The grid                                                            */
/* ------------------------------------------------------------------ */

/** Size of a grid cell, in metres. */
export const CELL = 0.2;

export interface Grid {
  floor: Floor;
  world: World;
  cols: number;
  rows: number;
  /** 1 where the avatar's middle may stand in the cell's middle. */
  free: Uint8Array;
}

/** The latest grid worked out for each floor, by what its world was made of. */
const grids = new Map<Floor, { key: string; grid: Grid }>();

/** Each cell's middle, in metres. */
export const cellX = (c: number) => ROOM.x0 + (c + 0.5) * CELL;
export const cellZ = (r: number) => ROOM.z0 + (r + 0.5) * CELL;

/** A floor's grid of free cells with these machines standing, worked out again only when they change. */
export function gridOf(floor: Floor, racks: Racks): Grid {
  const key = keyOf(floor, racks);
  const known = grids.get(floor);
  if (known?.key === key) return known.grid;
  const world = worldOf(floor, racks);
  const cols = Math.round(ROOM.w / CELL);
  const rows = Math.round(ROOM.d / CELL);
  const free = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) free[r * cols + c] = blocked(world, cellX(c), cellZ(r)) ? 0 : 1;
  const grid = { floor, world, cols, rows, free };
  grids.set(floor, { key, grid });
  return grid;
}

const colOf = (x: number) => Math.floor((x - ROOM.x0) / CELL);
const rowOf = (z: number) => Math.floor((z - ROOM.z0) / CELL);

function isFreeCell(g: Grid, c: number, r: number): boolean {
  return c >= 0 && r >= 0 && c < g.cols && r < g.rows && g.free[r * g.cols + c] === 1;
}

/** The nearest free place to (x, z), within `reach` metres, or null if there is none. */
export function nearestFree(g: Grid, x: number, z: number, reach = 3): [number, number] | null {
  if (!blocked(g.world, x, z)) return [x, z];
  const c0 = colOf(x);
  const r0 = rowOf(z);
  const rings = Math.ceil(reach / CELL);
  let best: [number, number] | null = null;
  let bestD = Infinity;
  for (let k = 1; k <= rings && !best; k++) {
    for (let dr = -k; dr <= k; dr++) {
      for (let dc = -k; dc <= k; dc++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== k || !isFreeCell(g, c0 + dc, r0 + dr)) continue;
        const px = cellX(c0 + dc);
        const pz = cellZ(r0 + dr);
        const d = Math.hypot(px - x, pz - z);
        if (d < bestD) {
          bestD = d;
          best = [px, pz];
        }
      }
    }
  }
  return best && bestD <= reach ? best : null;
}

/** A small binary heap of cell indices by cost. */
class Heap {
  private items: number[] = [];
  private keys: number[] = [];
  get size() {
    return this.items.length;
  }
  push(item: number, key: number): void {
    this.items.push(item);
    this.keys.push(key);
    let i = this.items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= this.keys[i]) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): number {
    const top = this.items[0];
    const lastItem = this.items.pop() as number;
    const lastKey = this.keys.pop() as number;
    if (this.items.length) {
      this.items[0] = lastItem;
      this.keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.keys.length && this.keys[l] < this.keys[m]) m = l;
        if (r < this.keys.length && this.keys[r] < this.keys[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
  }
}

const NEIGHBOURS: [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/**
 * The shortest walk from `from` to `to`, as the places to walk straight between, ending at `to`; null if there is no
 * way there. Both ends must be free. Corners are never cut, and the result is pulled tight so it turns only where
 * something is in the way.
 */
export function findPath(g: Grid, from: [number, number], to: [number, number]): [number, number][] | null {
  if (blocked(g.world, from[0], from[1]) || blocked(g.world, to[0], to[1])) return null;
  if (clearLine(g.world, from, to)) return [to];
  const start = nearestCell(g, from);
  const goal = nearestCell(g, to);
  if (start < 0 || goal < 0) return null;
  const cols = g.cols;
  const gc = goal % cols;
  const gr = Math.floor(goal / cols);
  const cost = new Float64Array(g.free.length).fill(Infinity);
  const came = new Int32Array(g.free.length).fill(-1);
  const heap = new Heap();
  const h = (i: number) => {
    const dc = Math.abs((i % cols) - gc);
    const dr = Math.abs(Math.floor(i / cols) - gr);
    return Math.max(dc, dr) + (Math.SQRT2 - 1) * Math.min(dc, dr);
  };
  cost[start] = 0;
  heap.push(start, h(start));
  while (heap.size) {
    const i = heap.pop();
    if (i === goal) break;
    const c = i % cols;
    const r = Math.floor(i / cols);
    for (const [dc, dr, step] of NEIGHBOURS) {
      const nc = c + dc;
      const nr = r + dr;
      if (!isFreeCell(g, nc, nr)) continue;
      // No squeezing diagonally past a corner.
      if (dc && dr && (!isFreeCell(g, c + dc, r) || !isFreeCell(g, c, r + dr))) continue;
      const n = nr * cols + nc;
      const next = cost[i] + step;
      if (next < cost[n]) {
        cost[n] = next;
        came[n] = i;
        heap.push(n, next + h(n));
      }
    }
  }
  if (came[goal] < 0 && goal !== start) return null;
  const cells: [number, number][] = [];
  for (let i = goal; i !== start && i >= 0; i = came[i]) cells.unshift([cellX(i % cols), cellZ(Math.floor(i / cols))]);
  const points: [number, number][] = [from, ...cells, to];
  // Pull the walk tight: from each place, carry on straight for as long as the way stays clear.
  const out: [number, number][] = [];
  let at = 0;
  while (at < points.length - 1) {
    let next = at + 1;
    while (next < points.length - 1 && clearLine(g.world, points[at], points[next + 1])) next++;
    out.push(points[next]);
    at = next;
  }
  return out;
}

/** The free cell nearest (x, z), as its index, or -1. */
function nearestCell(g: Grid, p: [number, number]): number {
  const c = colOf(p[0]);
  const r = rowOf(p[1]);
  if (isFreeCell(g, c, r)) return r * g.cols + c;
  const near = nearestFree(g, cellX(c), cellZ(r), 1);
  return near ? rowOf(near[1]) * g.cols + colOf(near[0]) : -1;
}
