import { pick, rand, randRange, type RngHolder } from "@/sim/rng";
import { ROOM } from "./layout";

/*
 * The world outside the office, at night: downtown. The startup rents the top
 * floor of a glass office tower, fifteen storeys above the street. Round the
 * tower's foot is a plaza; beyond it a grid of four-lane streets with traffic,
 * lamps and trees, a park, and blocks of offices, older stone buildings and
 * towers that grow taller with distance, so none of them ever stands between
 * the camera and the crew.
 *
 * Everything here is plain data and arithmetic, kept free of React and
 * three.js so the layout and the traffic can be tested; exterior.tsx draws it.
 * The world fades into the night with distance from the office, and into a
 * haze with depth below it, so it has no edge and the street looks far down.
 */

/** Height of a storey, slab to slab. */
export const STOREY = 4;
/** The office floor is y = 0; this many storeys of the tower stand below it. */
export const FLOORS_BELOW = 15;
/** The underside of the office's floor slab, where the tower's walls below it end. */
export const SLAB = -0.5;
/** Street level. */
export const GROUND_Y = SLAB - FLOORS_BELOW * STOREY;
/** The night sky, which the world fades into. Matches the scene background. */
export const NIGHT = "#1a1633";
/** The point the fade is measured from, and where it starts and is complete. */
export const FADE = { x: ROOM.cx, z: ROOM.cz, from: 170, to: 330 };
/** The haze: how far below the office it is thickest, and how much of the night it adds there. */
export const HAZE = { depth: 160, most: 0.5 };

/** How far into the fade a point is: 0 is clear, 1 is lost in the night. */
export function fadeAt(x: number, z: number): number {
  const d = Math.hypot(x - FADE.x, z - FADE.z);
  const t = Math.min(1, Math.max(0, (d - FADE.from) / (FADE.to - FADE.from)));
  return t * t * (3 - 2 * t);
}

/** A rectangle on the ground: x0, z0 to x1, z1. */
export type Rect = [number, number, number, number];

const rect = (x: number, z: number, w: number, d: number): Rect => [x - w / 2, z - d / 2, x + w / 2, z + d / 2];
const inset = (r: Rect, by: number): Rect => [r[0] + by, r[1] + by, r[2] - by, r[3] - by];

export function overlaps(a: Rect, b: Rect, margin = 0): boolean {
  return a[0] < b[2] + margin && b[0] < a[2] + margin && a[1] < b[3] + margin && b[1] < a[3] + margin;
}

export function inside(x: number, z: number, r: Rect, margin = 0): boolean {
  return x > r[0] - margin && x < r[2] + margin && z > r[1] - margin && z < r[3] + margin;
}

/** Shortest distance on the ground between two rectangles, zero if they touch. */
export function gap(a: Rect, b: Rect): number {
  return Math.hypot(Math.max(b[0] - a[2], 0, a[0] - b[2]), Math.max(b[1] - a[3], 0, a[1] - b[3]));
}

/* ------------------------------------------------------------------ */
/* The office and its tower                                            */
/* ------------------------------------------------------------------ */

/** The office floor, and the tower's shaft below it. */
export const BUILDING: Rect = [ROOM.x0 - 0.25, ROOM.z0 - 0.25, ROOM.x1 + 0.25, ROOM.z1 + 0.25];

/**
 * Seen from the usual tilt, anything rising h metres above the office floor nearer than about 1.6h would stand in
 * front of the office and hide the crew. Anything below the floor never can.
 */
export const CLEAR = 1.6;

/** Whether a box standing on `r` and rising to `top` (the office floor is 0) can never hide the office. */
export function clearOfOffice(r: Rect, top: number): boolean {
  return top <= gap(r, BUILDING) / CLEAR;
}

export type Facade = "glass" | "ribbon" | "stone";

/** One box of a building: a podium, a shaft or a crown, each standing on the one before. */
export interface Mass {
  rect: Rect;
  y0: number;
  y1: number;
}

export interface Building {
  masses: Mass[];
  /** Floor-to-ceiling glass, bands of windows, or stone with a window in each bay. */
  facade: Facade;
  /** Frames and spandrels, or the stone or brick of the walls. */
  wall: string;
  /** Glass with the lights off behind it. */
  glass: string;
  roof: string;
  /** Share of offices with the lights still on. */
  lit: number;
  seed: number;
  /** A strip of light round the top, or null. */
  crown: string | null;
}

/** Parapets and roof plant stand up to this far above a roof. */
export const ROOF_HEADROOM = 4;
export const PARAPET = 1.1;

export const PODIUM_STOREYS = 3;
/** The tower's lobby and shops, wider than the shaft above them. */
export const PODIUM: Rect = [BUILDING[0] - 7, BUILDING[1] - 6, BUILDING[2] + 7, BUILDING[3] + 6];

/** The startup's tower. Its last storey below the office carries the company's sign. */
export const TOWER: Building = {
  masses: [
    { rect: PODIUM, y0: GROUND_Y, y1: GROUND_Y + PODIUM_STOREYS * STOREY },
    { rect: BUILDING, y0: GROUND_Y + PODIUM_STOREYS * STOREY, y1: SLAB },
  ],
  facade: "glass",
  wall: "#56607a",
  glass: "#1b2a3d",
  roof: "#302f3a",
  lit: 0.42,
  seed: 9,
  crown: null,
};

/* ------------------------------------------------------------------ */
/* Roads                                                               */
/* ------------------------------------------------------------------ */

export const LANE = 3.2;
/** Two lanes each way either side of a painted median, and a pavement each side. */
export const STREET = { lanes: 2, median: 0.6, pavement: 3.6 };
export const CARRIAGEWAY = 2 * STREET.lanes * LANE + STREET.median;
export const STREET_WIDTH = CARRIAGEWAY + 2 * STREET.pavement;

export const VEHICLE = { car: 4.6, truck: 9, width: 2.4 };

/**
 * Junctions have no lights; traffic takes turns by the clock instead. In each cycle the vehicles on roads running
 * along x cross every junction first, then those on roads running along z. Speeds are in metres a second.
 */
export const CYCLE = 5;
export const SPEED = { x: 13, z: 11 };
/** How far a vehicle's centre can be from a crossing road's centre line while some of it is over a crossing lane. */
export const JUNCTION = STREET.median / 2 + (STREET.lanes - 0.5) * LANE + VEHICLE.width / 2 + VEHICLE.truck / 2;
const WINDOW = { x: (2 * JUNCTION) / SPEED.x, z: (2 * JUNCTION) / SPEED.z };
const SLACK = (CYCLE - WINDOW.x - WINDOW.z) / 2;
/** How far each lane may run ahead of or behind its turn, so neighbouring lanes are not in step. */
export const LAG = SLACK / 3;
/** When in the cycle each way's vehicles are in the junctions. */
export const TURN = { x: [0, WINDOW.x], z: [WINDOW.x + SLACK, WINDOW.x + SLACK + WINDOW.z] } as const;
/**
 * Distance between the roads that cross each way's traffic: two cycles' drive, so a vehicle reaches every junction
 * at the same point in the cycle. `x` is how far apart the roads running along z stand, and `z` the others.
 */
export const PITCH = { x: 2 * SPEED.x * CYCLE, z: 2 * SPEED.z * CYCLE };

/** A straight road: along x at z = `at`, or along z at x = `at`. */
export interface Road {
  axis: "x" | "z";
  at: number;
}

/** Centre lines either side of the office, half a pitch out, then a pitch apart, until past the fade. */
function lines(centre: number, pitch: number): number[] {
  const out: number[] = [];
  for (let k = -8; k < 8; k++) {
    const off = (k + 0.5) * pitch;
    if (Math.abs(off) <= FADE.to + pitch) out.push(centre + off);
  }
  return out;
}

/** The roads running along z, at these x; and those running along x, at these z. */
export const CROSS_X = lines(FADE.x, PITCH.x);
export const CROSS_Z = lines(FADE.z, PITCH.z);
export const ROADS: Road[] = [...CROSS_Z.map((at): Road => ({ axis: "x", at })), ...CROSS_X.map((at): Road => ({ axis: "z", at }))];

/** How far the roads run each way from the office before they are lost in the night. */
export const REACH = FADE.to + Math.max(PITCH.x, PITCH.z);

/** The ground a road covers: the carriageway, or with the pavements when `width` is STREET_WIDTH. */
export function roadRect(r: Road, width = CARRIAGEWAY): Rect {
  return r.axis === "x" ? [FADE.x - REACH, r.at - width / 2, FADE.x + REACH, r.at + width / 2] : [r.at - width / 2, FADE.z - REACH, r.at + width / 2, FADE.z + REACH];
}

/** The positions along a road where other roads cross it. */
export const crossings = (r: Road): number[] => (r.axis === "x" ? CROSS_X : CROSS_Z);

/* ------------------------------------------------------------------ */
/* Blocks                                                              */
/* ------------------------------------------------------------------ */

export interface Block {
  /** Inside the pavements. */
  rect: Rect;
  /** Counted in blocks from the tower's, along x and along z. */
  i: number;
  j: number;
}

/** Every block that is not completely lost in the night. */
export function blocks(): Block[] {
  const out: Block[] = [];
  const half = STREET_WIDTH / 2;
  for (let a = 0; a + 1 < CROSS_X.length; a++) {
    for (let b = 0; b + 1 < CROSS_Z.length; b++) {
      const r: Rect = [CROSS_X[a] + half, CROSS_Z[b] + half, CROSS_X[a + 1] - half, CROSS_Z[b + 1] - half];
      const nx = Math.min(Math.max(FADE.x, r[0]), r[2]);
      const nz = Math.min(Math.max(FADE.z, r[1]), r[3]);
      if (fadeAt(nx, nz) >= 1) continue;
      out.push({ rect: r, i: a - (CROSS_X.length / 2 - 1), j: b - (CROSS_Z.length / 2 - 1) });
    }
  }
  return out;
}

const isTowerBlock = (b: Block) => b.i === 0 && b.j === 0;
/** The park is the block diagonally behind the tower from the starting view, where it fills the sky above the office. */
const isPark = (b: Block) => b.i === -1 && b.j === -1;

export const towerBlock = (): Block => blocks().find(isTowerBlock) as Block;
export const parkBlock = (): Block => blocks().find(isPark) as Block;

/* ------------------------------------------------------------------ */
/* Buildings                                                           */
/* ------------------------------------------------------------------ */

const GLASS_TINTS = ["#1c2b3a", "#18302f", "#23262f", "#1d2433", "#2b2620", "#202a36", "#1a2a2a"];
const FRAMES = ["#59606e", "#4b5260", "#646a75", "#3f4450", "#5b5a60"];
const CONCRETE = ["#6a6b70", "#5f625f", "#77726a", "#55575e", "#6d675e"];
const STONE = ["#7d6f5e", "#6c4b3c", "#6b6b68", "#836e57", "#5e4a3f", "#74685c"];
const DARK_GLASS = ["#151a24", "#171b20", "#1a1d26"];
const ROOFS = ["#2f2e36", "#38373f", "#36332f", "#2a332d", "#2d313a", "#3b3834"];
const CROWNS = ["#9fd8ff", "#f4f1ea", "#ffd27a", "#c49bff"];

/** Whole storeys a box on `r` may rise to, roof plant included, without ever hiding the office. */
function storeysAllowed(r: Rect): number {
  return Math.floor((gap(r, BUILDING) / CLEAR - ROOF_HEADROOM - GROUND_Y) / STOREY);
}

const level = (storeys: number) => GROUND_Y + storeys * STOREY;

/** Cut a block into two or three lots each way, with a narrow gap between neighbours. */
function lots(r: Rect, rng: RngHolder): Rect[] {
  const cuts = (a: number, b: number, n: number) => {
    const out = [a];
    for (let k = 1; k < n; k++) out.push(a + ((b - a) * k) / n + randRange(rng, -0.06, 0.06) * (b - a));
    out.push(b);
    return out;
  };
  const xs = cuts(r[0], r[2], r[2] - r[0] > 90 ? pick(rng, [2, 3, 3]) : 2);
  const zs = cuts(r[1], r[3], r[3] - r[1] > 70 ? pick(rng, [2, 2, 3]) : 2);
  const out: Rect[] = [];
  for (let a = 0; a + 1 < xs.length; a++) for (let b = 0; b + 1 < zs.length; b++) out.push(inset([xs[a], zs[b], xs[a + 1], zs[b + 1]], randRange(rng, 0.8, 2.4)));
  return out;
}

function building(lot: Rect, rng: RngHolder): Building | null {
  const seed = Math.floor(rand(rng) * 10000);
  const roll = rand(rng);
  const want = Math.round(roll < 0.3 ? randRange(rng, 3, 7) : roll < 0.62 ? randRange(rng, 8, 20) : randRange(rng, 21, 58));
  const masses: Mass[] = [];
  // Tall buildings stand on a podium as wide as the lot, and the tallest end in a narrower crown.
  if (want > 14 && Math.min(lot[2] - lot[0], lot[3] - lot[1]) > 24) {
    const podium = Math.min(Math.round(randRange(rng, 2, 5)), storeysAllowed(lot));
    const shaftRect = inset(lot, randRange(rng, 2.5, 6));
    const shaft = Math.min(want, storeysAllowed(shaftRect));
    if (podium >= 1 && shaft >= podium + 4) {
      masses.push({ rect: lot, y0: GROUND_Y, y1: level(podium) }, { rect: shaftRect, y0: level(podium), y1: level(shaft) });
      if (shaft > 26 && rand(rng) < 0.6) {
        const crownRect = inset(shaftRect, randRange(rng, 2, 4));
        const top = Math.min(shaft + Math.round(randRange(rng, 2, 5)), storeysAllowed(crownRect));
        if (top > shaft) masses.push({ rect: crownRect, y0: level(shaft), y1: level(top) });
      }
    }
  }
  if (masses.length === 0) {
    const n = Math.min(want, storeysAllowed(lot));
    if (n < 2) return null;
    masses.push({ rect: lot, y0: GROUND_Y, y1: level(n) });
  }
  const storeys = (masses[masses.length - 1].y1 - GROUND_Y) / STOREY;
  const facade: Facade = storeys > 20 ? (rand(rng) < 0.72 ? "glass" : "ribbon") : storeys > 7 ? pick(rng, ["glass", "ribbon", "stone"] as const) : rand(rng) < 0.55 ? "stone" : pick(rng, ["ribbon", "glass"] as const);
  const wall = facade === "glass" ? pick(rng, FRAMES) : facade === "ribbon" ? pick(rng, CONCRETE) : pick(rng, STONE);
  const glass = facade === "glass" ? pick(rng, GLASS_TINTS) : pick(rng, DARK_GLASS);
  return {
    masses,
    facade,
    wall,
    glass,
    roof: pick(rng, ROOFS),
    lit: randRange(rng, 0.1, 0.42),
    seed,
    crown: storeys >= 30 && rand(rng) < 0.45 ? pick(rng, CROWNS) : null,
  };
}

/** Every building in town but the startup's own tower, the same ones every visit. */
export function buildings(seed = 31): Building[] {
  const rng: RngHolder = { rngState: seed };
  const out: Building[] = [];
  for (const b of blocks()) {
    if (isTowerBlock(b) || isPark(b)) continue;
    for (const lot of lots(b.rect, rng)) {
      const made = building(lot, rng);
      if (made) out.push(made);
    }
  }
  return out;
}

export interface Plant {
  kind: "box" | "tank" | "fan";
  x: number;
  z: number;
  w: number;
  d: number;
  /** Bottom and top. */
  y0: number;
  y1: number;
}

/** Lift overruns, air handlers, cooling fans and water tanks on a building's roof. */
export function roofPlant(b: Building): Plant[] {
  const top = b.masses[b.masses.length - 1];
  const rng: RngHolder = { rngState: b.seed };
  const [x0, z0, x1, z1] = inset(top.rect, PARAPET + 0.6);
  const out: Plant[] = [];
  const room = (w: number, d: number) => {
    for (let tries = 0; tries < 12; tries++) {
      const x = randRange(rng, x0 + w / 2, x1 - w / 2);
      const z = randRange(rng, z0 + d / 2, z1 - d / 2);
      const r = rect(x, z, w, d);
      if (r[0] >= x0 && r[2] <= x1 && r[1] >= z0 && r[3] <= z1 && !out.some((p) => overlaps(r, rect(p.x, p.z, p.w, p.d), 0.8))) return { x, z };
    }
    return null;
  };
  const add = (kind: Plant["kind"], w: number, d: number, h: number) => {
    const at = room(w, d);
    if (at) out.push({ kind, ...at, w, d, y0: top.y1, y1: top.y1 + h });
  };
  add("box", randRange(rng, 4, 6), randRange(rng, 4, 7), randRange(rng, 2.4, 3.4));
  const units = Math.floor(randRange(rng, 1, 4));
  for (let k = 0; k < units; k++) add("box", randRange(rng, 2, 4.5), randRange(rng, 1.6, 3), randRange(rng, 1.2, 2));
  const fans = Math.floor(randRange(rng, 0, 3));
  for (let k = 0; k < fans; k++) add("fan", 2.4, 2.4, randRange(rng, 1.4, 2));
  if (b.facade === "stone" && rand(rng) < 0.7) add("tank", 3, 3, randRange(rng, 3, 3.8));
  return out;
}

/** Red lights on the corners of anything tall enough to trouble a helicopter. */
export function beacons(b: Building): { x: number; y: number; z: number }[] {
  const top = b.masses[b.masses.length - 1];
  if (top.y1 - GROUND_Y < 22 * STOREY) return [];
  const [x0, z0, x1, z1] = inset(top.rect, 0.3);
  return [
    [x0, z0],
    [x1, z0],
    [x0, z1],
    [x1, z1],
  ].map(([x, z]) => ({ x, y: top.y1 + PARAPET + 0.25, z }));
}

/* ------------------------------------------------------------------ */
/* Lamps and trees                                                     */
/* ------------------------------------------------------------------ */

export interface Spot {
  x: number;
  z: number;
  /** Lamps: which way the arm reaches, toward the road (the arm reaches along -z at 0). */
  rot: number;
}

export interface Tree {
  x: number;
  z: number;
  /** Height in metres. */
  h: number;
  turn: number;
}

const LAMP_GAP = 26;
/** Kerb to lamp post, and kerb to tree pit. */
const LAMP_IN = 0.5;
const TREE_IN = 1.5;

/** Stretches of a road between junctions, clear of the crossings and their zebras. */
function stretches(r: Road): [number, number][] {
  const c = crossings(r);
  const out: [number, number][] = [];
  for (let k = 0; k + 1 < c.length; k++) out.push([c[k] + STREET_WIDTH / 2 + 5, c[k + 1] - STREET_WIDTH / 2 - 5]);
  return out;
}

/** A point beside road r, `along` it and `out` from its kerb on `side`. */
function kerbside(r: Road, along: number, side: -1 | 1, out: number): [number, number] {
  const across = r.at + side * (CARRIAGEWAY / 2 + out);
  return r.axis === "x" ? [along, across] : [across, along];
}

/** Street lamps along both kerbs of every road, evenly spaced between the junctions. */
export function lamps(): Spot[] {
  const out: Spot[] = [];
  for (const r of ROADS) {
    for (const [a, b] of stretches(r)) {
      const n = Math.max(1, Math.round((b - a) / LAMP_GAP));
      for (let k = 0; k <= n; k++) {
        for (const side of [-1, 1] as const) {
          const [x, z] = kerbside(r, a + ((b - a) * k) / n, side, LAMP_IN);
          const rot = r.axis === "x" ? (side === 1 ? 0 : Math.PI) : side === 1 ? Math.PI / 2 : -Math.PI / 2;
          if (fadeAt(x, z) < 0.95) out.push({ x, z, rot });
        }
      }
    }
  }
  return out;
}

/** Street trees halfway between the lamps, round the tower's plaza and across the park. */
export function trees(seed = 13): Tree[] {
  const rng: RngHolder = { rngState: seed };
  const out: Tree[] = [];
  const add = (x: number, z: number, lo: number, hi: number) => out.push({ x, z, h: randRange(rng, lo, hi), turn: randRange(rng, 0, Math.PI * 2) });
  ROADS.forEach((r, i) => {
    // Not every street is planted.
    if (i % 3 === 1) return;
    for (const [a, b] of stretches(r)) {
      const n = Math.max(1, Math.round((b - a) / LAMP_GAP));
      for (let k = 0; k < n; k++) {
        for (const side of [-1, 1] as const) {
          const [x, z] = kerbside(r, a + ((b - a) * (k + 0.5)) / n, side, TREE_IN);
          if (fadeAt(x, z) < 0.9) add(x, z, 5.5, 7.5);
        }
      }
    }
  });
  // The plaza: a ring of trees in from the pavement, leaving the way to the doors clear.
  const plaza = inset(towerBlock().rect, 4);
  const ring: [number, number][] = [];
  for (let x = plaza[0]; x <= plaza[2] + 0.01; x += (plaza[2] - plaza[0]) / 10) ring.push([x, plaza[1]], [x, plaza[3]]);
  for (let z = plaza[1] + 8; z <= plaza[3] - 8; z += (plaza[3] - plaza[1]) / 8) ring.push([plaza[0], z], [plaza[2], z]);
  for (const [x, z] of ring) if (Math.abs(x - FADE.x) > 6 && !inside(x, z, PODIUM, 4)) add(x, z, 5, 7);
  // The park: scattered, off the paths.
  const park = parkBlock().rect;
  const paths = parkPaths();
  for (let tries = 0, planted = 0; planted < 46 && tries < 1500; tries++) {
    const x = randRange(rng, park[0] + 4, park[2] - 4);
    const z = randRange(rng, park[1] + 4, park[3] - 4);
    if (paths.some((p) => inside(x, z, p, 2.5)) || out.some((t) => Math.hypot(t.x - x, t.z - z) < 7.5)) continue;
    add(x, z, 6, 10.5);
    planted++;
  }
  return out;
}

/** Footpaths across the park: one each way through the middle and a loop inside the railings. */
export function parkPaths(): Rect[] {
  const [x0, z0, x1, z1] = parkBlock().rect;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const w = 3;
  const loop = inset([x0, z0, x1, z1], 6);
  return [
    [x0, cz - w / 2, x1, cz + w / 2],
    [cx - w / 2, z0, cx + w / 2, z1],
    [loop[0], loop[1], loop[2], loop[1] + w],
    [loop[0], loop[3] - w, loop[2], loop[3]],
    [loop[0], loop[1], loop[0] + w, loop[3]],
    [loop[2] - w, loop[1], loop[2], loop[3]],
  ];
}

/* ------------------------------------------------------------------ */
/* Traffic                                                             */
/* ------------------------------------------------------------------ */

export interface Lane {
  axis: "x" | "z";
  /** The lane's centre line. */
  at: number;
  /** Which way along the axis it runs. */
  dir: 1 | -1;
  speed: number;
  /** Vehicles keep this far apart, centre to centre; some places stay empty. */
  spacing: number;
  /** Places round the lane's loop. Vehicles leave one end and come back at the other, unseen in the night. */
  slots: number;
  loop: number;
  offset: number;
}

/** Traffic keeps to the right. */
function laneLine(r: Road, dir: 1 | -1, k: number): number {
  const side = r.axis === "x" ? dir : -dir;
  return r.at + side * (STREET.median / 2 + LANE / 2 + k * LANE);
}

/** Every lane on the roads that are not lost in the night. */
export const LANES: Lane[] = ROADS.filter((r) => Math.abs(r.at - (r.axis === "x" ? FADE.z : FADE.x)) <= FADE.to).flatMap((r, ri) =>
  ([1, -1] as const).flatMap((dir) =>
    Array.from({ length: STREET.lanes }, (_, k): Lane => {
      const speed = SPEED[r.axis];
      const spacing = speed * CYCLE;
      const slots = Math.ceil((2 * (FADE.to + 30)) / spacing);
      const loop = slots * spacing;
      // Lanes take their turns a little early or late, so neighbours do not drive in step.
      const lag = LAG * Math.sin(ri * 2.3 + k * 1.7 + dir);
      const start = TURN[r.axis][0] + lag;
      // The first crossing out from the middle, half a pitch away; slot 0 reaches it as the lane's turn starts.
      const first = PITCH[r.axis] / 2;
      return { axis: r.axis, at: laneLine(r, dir, k), dir, speed, spacing, slots, loop, offset: loop / 2 + dir * first - JUNCTION - speed * start };
    }),
  ),
);

/** Where a vehicle is at time t. */
export function vehicleAt(lane: Lane, slot: number, t: number): { x: number; z: number } {
  const travelled = lane.offset + slot * lane.spacing + lane.speed * t;
  const along = lane.dir * ((((travelled % lane.loop) + lane.loop) % lane.loop) - lane.loop / 2);
  return lane.axis === "x" ? { x: FADE.x + along, z: lane.at } : { x: lane.at, z: FADE.z + along };
}

export interface Vehicle {
  lane: number;
  slot: number;
  truck: boolean;
  colour: string;
}

export const CAR_COLOURS = ["#d9d9de", "#26262e", "#8a8f99", "#2f4c8f", "#9c1f2b", "#e8e4d8", "#3d5c47", "#5a5f6b", "#e0b32e", "#1d3557"];

/** About three places in five filled, a few with trucks; the same traffic every visit. */
export function traffic(seed = 21): Vehicle[] {
  const rng: RngHolder = { rngState: seed };
  const out: Vehicle[] = [];
  LANES.forEach((lane, l) => {
    for (let slot = 0; slot < lane.slots; slot++) {
      if (rand(rng) > 0.6) continue;
      out.push({ lane: l, slot, truck: rand(rng) < (lane.axis === "x" ? 0.12 : 0.07), colour: pick(rng, CAR_COLOURS) });
    }
  });
  return out;
}

/** The ground a vehicle covers at time t. */
export function vehicleRect(v: Vehicle, t: number): Rect {
  const lane = LANES[v.lane];
  const { x, z } = vehicleAt(lane, v.slot, t);
  const length = v.truck ? VEHICLE.truck : VEHICLE.car;
  const width = v.truck ? VEHICLE.width : 1.8;
  return lane.axis === "x" ? rect(x, z, length, width) : rect(x, z, width, length);
}
