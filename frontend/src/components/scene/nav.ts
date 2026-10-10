import { BALANCE, equipmentInfo, type GameState } from "@/sim";
import { GROUPS } from "./conversations";
import { BEHIND_GLASS, GLASS, OBSTACLES, OFF_LIMITS, SPOTS, type Obstacle } from "./floorplan";
import { appSlot, DB_CABINET, dbSlot, MAX_TEMP_SHOWN, POS, RACK, ROOM, tempSlot } from "./layout";

/*
 * Where the founder can walk. The floor is cut into small square cells, and a
 * cell is open when a founder standing at its middle would touch nothing: no
 * wall, glass, furniture, machine or standing crew member. Paths run from cell
 * to cell and are then pulled straight wherever the way is clear; steering by
 * keys slides along whatever it meets.
 *
 * The racks on the server floor come and go as the company builds them, so the
 * grid is rebuilt from the game state (navKey says when). Crew who wander the
 * office are not in the grid: the founder passes them by rather than getting
 * stuck behind them.
 *
 * Nothing here touches React or three.js; nav.test.ts checks every machine can
 * be reached and nothing can be walked through.
 */

/** The founder's footprint, in metres. */
export const FOUNDER_RADIUS = 0.26;
/** Cell size, in metres. */
const CELL = 0.2;
/** Half the thickness of a glass partition. */
const GLASS_HALF = 0.03;

export interface Point {
  x: number;
  z: number;
}

export interface NavGrid {
  cols: number;
  rows: number;
  /** 1 where a cell is open. */
  open: Uint8Array;
}

const COLS = Math.round(ROOM.w / CELL);
const ROWS = Math.round(ROOM.d / CELL);

const box = (name: string, x: number, z: number, w: number, d: number): Obstacle => ({ name, box: [x - w / 2, z - d / 2, x + w / 2, z + d / 2] });
const disc = (name: string, x: number, z: number, r: number): Obstacle => ({ name, disc: [x, z, r] });

/** The racks standing on the server floor for this game, as the scene draws them. */
export function rackObstacles(s: GameState): Obstacle[] {
  const built = (id: Parameters<typeof equipmentInfo>[1]) => equipmentInfo(s, id).built;
  const rack = (name: string, p: Point) => box(name, p.x, p.z, RACK.w, RACK.d);
  const out: Obstacle[] = [rack("gateway", POS.gateway)];
  if (s.techDone.includes("load_balancing")) out.push(rack("load balancer", POS.loadBalancer));
  const apps = Math.min(s.infra.appHosts.length, BALANCE.server.maxWithLb);
  for (let i = 0; i < apps; i++) out.push(rack(`server ${i}`, appSlot(i)));
  for (let i = 0; i < Math.min(s.live.tempServers, MAX_TEMP_SHOWN); i++) out.push(rack(`on-demand server ${i}`, tempSlot(i)));
  if (built("standby")) out.push(rack("standby", POS.standby));
  if (built("cache")) out.push(rack("cache", POS.cache));
  for (let i = 0; i <= s.infra.dbTier; i++) {
    const p = dbSlot(i);
    out.push(box(`database ${i}`, p.x, p.z, DB_CABINET.w, DB_CABINET.d));
  }
  if (built("replica")) out.push(box("replica", POS.replica.x, POS.replica.z, DB_CABINET.w, DB_CABINET.d));
  if (built("backup")) out.push(box("backup", POS.backup.x, POS.backup.z, 1.9, 1.05));
  return out;
}

/** Crew who stay put on the open floor: the release engineer, the marketer, the receptionist, the kitchen and lounge, and the chatting groups. */
const STANDING_CREW: Obstacle[] = [
  ...(["releaseEngineer", "marketer", "receptionist", "kitchenBreak", "kitchenChat", "loungeStand", "townhallReader", "pingPlayer", "pongPlayer"] as const).map((k) =>
    disc(k, SPOTS[k].x, SPOTS[k].z, 0.32),
  ),
  ...GROUPS.flatMap((g) => g.members.map((m, i) => disc(`${g.name} ${i}`, m.x, m.z, 0.32))),
];

/** Everything the founder walks round in this game. */
export function navObstacles(s: GameState): Obstacle[] {
  return [...OBSTACLES, ...BEHIND_GLASS, ...STANDING_CREW, ...rackObstacles(s)];
}

/** Changes exactly when the racks, and so the grid, change. */
export function navKey(s: GameState): string {
  return rackObstacles(s)
    .map((o) => o.name)
    .join("|");
}

function segmentDistance(p: Point, [x1, z1, x2, z2]: [number, number, number, number]): number {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const t = Math.max(0, Math.min(1, ((p.x - x1) * dx + (p.z - z1) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p.x - (x1 + t * dx), p.z - (z1 + t * dz));
}

/** Whether a founder standing at p touches an obstacle or wall. */
export function touches(p: Point, obstacles: Obstacle[], r = FOUNDER_RADIUS): boolean {
  if (p.x < ROOM.x0 + r || p.x > ROOM.x1 - r || p.z < ROOM.z0 + r || p.z > ROOM.z1 - r) return true;
  for (const [x0, z0, x1, z1] of OFF_LIMITS) if (p.x > x0 - r && p.x < x1 + r && p.z > z0 - r && p.z < z1 + r) return true;
  for (const g of GLASS) if (segmentDistance(p, g) < r + GLASS_HALF) return true;
  for (const o of obstacles) {
    if ("box" in o) {
      const [x0, z0, x1, z1] = o.box;
      const dx = Math.max(x0 - p.x, 0, p.x - x1);
      const dz = Math.max(z0 - p.z, 0, p.z - z1);
      if (Math.hypot(dx, dz) < r) return true;
    } else {
      const [x, z, radius] = o.disc;
      if (Math.hypot(p.x - x, p.z - z) < radius + r) return true;
    }
  }
  return false;
}

export function buildGrid(obstacles: Obstacle[]): NavGrid {
  const open = new Uint8Array(COLS * ROWS);
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      open[row * COLS + col] = touches(centre(col, row), obstacles) ? 0 : 1;
    }
  }
  return { cols: COLS, rows: ROWS, open };
}

let cached: { key: string; grid: NavGrid } | null = null;

/** The floor for this game, built again only when its racks change. */
export function gridFor(s: GameState): NavGrid {
  const key = navKey(s);
  if (cached?.key !== key) cached = { key, grid: buildGrid(navObstacles(s)) };
  return cached.grid;
}

function centre(col: number, row: number): Point {
  return { x: ROOM.x0 + (col + 0.5) * CELL, z: ROOM.z0 + (row + 0.5) * CELL };
}

function cellOf(p: Point): [number, number] {
  return [Math.floor((p.x - ROOM.x0) / CELL), Math.floor((p.z - ROOM.z0) / CELL)];
}

function openCell(g: NavGrid, col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < g.cols && row < g.rows && g.open[row * g.cols + col] === 1;
}

/** Whether the founder may stand at p. */
export function isOpen(g: NavGrid, p: Point): boolean {
  const [col, row] = cellOf(p);
  return openCell(g, col, row);
}

/** The open cell nearest to p, searching outwards; p itself when it is open. */
export function nearestOpen(g: NavGrid, p: Point): Point | null {
  const [c0, r0] = cellOf(p);
  if (openCell(g, c0, r0)) return p;
  for (let ring = 1; ring < Math.max(g.cols, g.rows); ring++) {
    let best: Point | null = null;
    let bestD = Infinity;
    for (let dr = -ring; dr <= ring; dr++) {
      for (let dc = -ring; dc <= ring; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring || !openCell(g, c0 + dc, r0 + dr)) continue;
        const q = centre(c0 + dc, r0 + dr);
        const d = Math.hypot(q.x - p.x, q.z - p.z);
        if (d < bestD) {
          bestD = d;
          best = q;
        }
      }
    }
    if (best) return best;
  }
  return null;
}

/** Whether a straight walk from a to b stays on open floor. */
export function clearLine(g: NavGrid, a: Point, b: Point): boolean {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (CELL / 3));
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    if (!isOpen(g, { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })) return false;
  }
  return true;
}

const DIRS: [number, number, number][] = [
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
 * The way from `from` to `to`, as the corners to walk through, ending at `to`
 * (or the open floor nearest it). Null when there is no way there.
 */
export function findPath(g: NavGrid, from: Point, to: Point): Point[] | null {
  const start = nearestOpen(g, from);
  const goal = nearestOpen(g, to);
  if (!start || !goal) return null;
  const [sc, sr] = cellOf(start);
  const [gc, gr] = cellOf(goal);
  const n = g.cols * g.rows;
  const cost = new Float64Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const heap = new MinHeap();
  const h = (c: number, r: number) => {
    const dx = Math.abs(c - gc);
    const dr = Math.abs(r - gr);
    return Math.max(dx, dr) + (Math.SQRT2 - 1) * Math.min(dx, dr);
  };
  const s = sr * g.cols + sc;
  const goalIndex = gr * g.cols + gc;
  cost[s] = 0;
  heap.push(s, h(sc, sr));
  while (heap.size) {
    const i = heap.pop();
    if (i === goalIndex) break;
    if (closed[i]) continue;
    closed[i] = 1;
    const c = i % g.cols;
    const r = (i - c) / g.cols;
    for (const [dc, dr, step] of DIRS) {
      const nc = c + dc;
      const nr = r + dr;
      if (!openCell(g, nc, nr)) continue;
      // Diagonals may not cut a corner.
      if (dc && dr && (!openCell(g, c + dc, r) || !openCell(g, c, r + dr))) continue;
      const j = nr * g.cols + nc;
      const next = cost[i] + step;
      if (next < cost[j]) {
        cost[j] = next;
        came[j] = i;
        heap.push(j, next + h(nc, nr));
      }
    }
  }
  if (goalIndex !== s && came[goalIndex] < 0) return null;
  const cells: Point[] = [];
  for (let i = goalIndex; i !== s && i >= 0; i = came[i]) cells.unshift(centre(i % g.cols, Math.floor(i / g.cols)));
  if (cells.length === 0) cells.push(goal);
  else cells[cells.length - 1] = goal;
  // Pull the path straight: from each corner, go to the furthest point still in a clear line.
  const out: Point[] = [];
  let at = start;
  let k = 0;
  while (k < cells.length) {
    let far = k;
    for (let m = cells.length - 1; m > k; m--) {
      if (clearLine(g, at, cells[m])) {
        far = m;
        break;
      }
    }
    out.push(cells[far]);
    at = cells[far];
    k = far + 1;
  }
  return out;
}

/** A step of (dx, dz) from p, sliding along whatever is in the way. */
export function slide(g: NavGrid, p: Point, dx: number, dz: number): Point {
  const both = { x: p.x + dx, z: p.z + dz };
  if (isOpen(g, both)) return both;
  const alongX = { x: p.x + dx, z: p.z };
  if (dx !== 0 && isOpen(g, alongX)) return alongX;
  const alongZ = { x: p.x, z: p.z + dz };
  if (dz !== 0 && isOpen(g, alongZ)) return alongZ;
  return p;
}

/** A binary heap of cell indices by priority, for the path search. */
class MinHeap {
  private items: number[] = [];
  private keys: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, key: number): void {
    this.items.push(item);
    this.keys.push(key);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.keys[parent] <= this.keys[i]) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number {
    const top = this.items[0];
    const lastItem = this.items.pop()!;
    const lastKey = this.keys.pop()!;
    if (this.items.length) {
      this.items[0] = lastItem;
      this.keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.items.length && this.keys[l] < this.keys[m]) m = l;
        if (r < this.items.length && this.keys[r] < this.keys[m]) m = r;
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
