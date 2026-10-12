import { pick, rand, randRange, type RngHolder } from "@/sim/rng";
import { ROOM } from "./layout";

/*
 * The world outside the office: a Silicon Valley suburb. The startup has the top floor of a low glass campus
 * building, three storeys above the street, with a lobby wing and a roof terrace below it, a lawn round about and its
 * own car park. Beyond it runs a grid of palm-lined boulevards with planted medians, traffic, lamps and people on the
 * pavements, and the blocks between them hold office parks with their car parks, neighbourhoods of houses with
 * pitched roofs and back-yard pools, strips of shops, and a park. Anything that would rise in front of the office
 * and hide the crew is kept low or far enough away.
 *
 * Everything here is plain data and arithmetic, kept free of React and three.js so the layout and the traffic can be
 * tested; exterior.tsx draws it, under the light of the time of day (see sky.ts). The world fades into the sky with
 * distance from the office, so it has no edge.
 */

/** Height of a storey, slab to slab. */
export const STOREY = 4;
/** The office floor is y = 0; this many storeys of its building stand below it. */
export const FLOORS_BELOW = 3;
/** The underside of the office's floor slab, where the building's walls below it end. */
export const SLAB = -0.5;
/** Street level. */
export const GROUND_Y = SLAB - FLOORS_BELOW * STOREY;
/** The night sky, which the world fades into after dark, and before the time of day is first applied. */
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
/* The office and its building                                         */
/* ------------------------------------------------------------------ */

/** The office floor, and the building's upper storeys below it. */
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

export type Facade = "glass" | "ribbon" | "stone" | "fins" | "grid" | "house";

/**
 * What covers the top roof: bare membrane or gravel, a planted roof, rows of solar panels, a terrace round a pool,
 * a helipad on the tallest, or the tiles or shingles of a pitched roof.
 */
export type Finish = "membrane" | "gravel" | "green" | "solar" | "pool" | "helipad" | "tiles";

/** A flat roof, or a pitched one with a ridge along its length or hipped on every side. */
export type Pitch = "flat" | "gable" | "hip";

/** One box of a building: a podium, a shaft or a crown, each standing on the one before. */
export interface Mass {
  rect: Rect;
  y0: number;
  y1: number;
}

export interface Building {
  masses: Mass[];
  /**
   * Floor-to-ceiling glass, bands of windows, stone with a window in each bay, tall slots between concrete fins, a
   * concrete grid of small punched windows, or a house's painted stucco.
   */
  facade: Facade;
  /** Frames and spandrels, or the stone or brick of the walls. */
  wall: string;
  /** Glass with the lights off behind it. */
  glass: string;
  roof: string;
  finish: Finish;
  pitch: Pitch;
  /** Share of offices with the lights still on. */
  lit: number;
  seed: number;
  /** A strip of light round the top, or null. */
  crown: string | null;
}

/** Parapets and roof plant stand up to this far above a roof. */
export const ROOF_HEADROOM = 4;
export const PARAPET = 1.1;

export const PODIUM_STOREYS = 1;
/** The building's lobby and café, a storey high and wider than the floors above, with a terrace on its roof. */
export const PODIUM: Rect = [BUILDING[0] - 7, BUILDING[1] - 6, BUILDING[2] + 7, BUILDING[3] + 6];

/** The startup's building. Its last storey below the office carries the company's sign. */
export const TOWER: Building = {
  masses: [
    { rect: PODIUM, y0: GROUND_Y, y1: GROUND_Y + PODIUM_STOREYS * STOREY },
    { rect: BUILDING, y0: GROUND_Y + PODIUM_STOREYS * STOREY, y1: SLAB },
  ],
  facade: "glass",
  wall: "#56607a",
  glass: "#1b2a3d",
  roof: "#302f3a",
  finish: "membrane",
  pitch: "flat",
  lit: 0.42,
  seed: 9,
  crown: null,
};

/* ------------------------------------------------------------------ */
/* Roads                                                               */
/* ------------------------------------------------------------------ */

export const LANE = 3.2;
/** Two lanes each way either side of a planted median, and a pavement each side. */
export const STREET = { lanes: 2, median: 6, pavement: 3.6 };
export const CARRIAGEWAY = 2 * STREET.lanes * LANE + STREET.median;
export const STREET_WIDTH = CARRIAGEWAY + 2 * STREET.pavement;

export const VEHICLE = { car: 4.6, truck: 9, width: 2.4 };

/**
 * Junctions have no lights; traffic takes turns by the clock instead. In each cycle the vehicles on roads running
 * along x cross every junction first, then those on roads running along z. Speeds are in metres a second.
 */
export const CYCLE = 6;
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
/** The park is the block to the upper left of the office from the starting view. */
const isPark = (b: Block) => b.i === -1 && b.j === 0;

export const towerBlock = (): Block => blocks().find(isTowerBlock) as Block;
export const parkBlock = (): Block => blocks().find(isPark) as Block;

/* ------------------------------------------------------------------ */
/* Blocks and what stands on them                                      */
/* ------------------------------------------------------------------ */

// Office parks in glass, aluminium and concrete; houses in pale stucco under terracotta tiles or grey shingles; and
// shops with bright fronts behind their car parks.
const GLASS_TINTS = ["#1c2b3a", "#18302f", "#23262f", "#1d2433", "#2b2620", "#202a36", "#1a2a2a", "#1f3a4a", "#263a52"];
const FRAMES = ["#59606e", "#4b5260", "#646a75", "#3f4450", "#5b5a60", "#858d9b", "#8b7b63", "#2c3039"];
const CONCRETE = ["#8e8c86", "#9c988e", "#8e9096", "#a2998a", "#b3ada2", "#c2bdb2", "#7c7a76"];
const STUCCO = ["#e9dfcc", "#efe6d6", "#d9c7a7", "#f2ede3", "#cdb89a", "#e4d3c0", "#c9cfc8", "#e6d2b5", "#d8c3a5"];
const SHOPFRONTS = ["#e8e2d6", "#d7cbb8", "#c8c4bd", "#ece6dc", "#b9b2a6"];
const DARK_GLASS = ["#151a24", "#171b20", "#1a1d26"];
const ROOFS: Record<Finish, readonly string[]> = {
  membrane: ["#c4c3be", "#b4b3ae", "#a5a4a0", "#76747a"],
  gravel: ["#8a857c", "#958f86", "#7e7b78"],
  green: ["#4f7a3f", "#5a8446", "#476f3d"],
  solar: ["#9d9ca0", "#a8a7aa"],
  pool: ["#b2aa9c", "#bfb6a6"],
  helipad: ["#5a5960", "#64626a"],
  tiles: ["#b5603c", "#a8553a", "#c06e45", "#9c4f35", "#6d6a66", "#5a5d63", "#7a5a48"],
};
/** Light strips round the tops of the taller offices, and the shops' signs. */
const CROWNS = ["#9fd8ff", "#f4f1ea", "#ffd27a", "#c49bff", "#7de8d3"];
const SIGNS = ["#ff5a5f", "#2ec4b6", "#ffbf00", "#7b61ff", "#ff7f3f", "#3fa7ff"];

/** A roof finish that suits a building of this many storeys with a top roof this size. */
function finishFor(top: Rect, storeys: number, rng: RngHolder): Finish {
  const side = Math.min(top[2] - top[0], top[3] - top[1]);
  const options: [Finish, number][] = [
    ["membrane", 3],
    ["gravel", 2],
  ];
  if (side >= 15) options.push(["solar", 3]);
  if (storeys <= 6) options.push(["green", 1]);
  if (storeys >= 3 && storeys <= 8 && side >= 16) options.push(["pool", 2]);
  if (storeys >= 6 && side >= 20) options.push(["helipad", 4]);
  let r = rand(rng) * options.reduce((sum, [, w]) => sum + w, 0);
  for (const [kind, w] of options) if ((r -= w) < 0) return kind;
  return "membrane";
}

/** Whole storeys a box on `r` may rise to, roof plant included, without ever hiding the office. */
function storeysAllowed(r: Rect): number {
  return Math.floor((gap(r, BUILDING) / CLEAR - ROOF_HEADROOM - GROUND_Y) / STOREY);
}

const level = (storeys: number) => GROUND_Y + storeys * STOREY;
const narrow = (r: Rect) => Math.min(r[2] - r[0], r[3] - r[1]);

/**
 * Pull each side of a rectangle in by `lo` to `hi` metres, each side its own amount. With chance `flush` a side
 * stays nearly in line with the one below, just clear of its parapet.
 */
function setback(r: Rect, rng: RngHolder, lo: number, hi: number, flush = 0.3): Rect {
  const by = () => (rand(rng) < flush ? PARAPET / 2 : randRange(rng, lo, hi));
  return [r[0] + by(), r[1] + by(), r[2] - by(), r[3] - by()];
}

/** A rectangle from a span along a block's length and one across it, whichever way the block lies. */
const span = (alongX: boolean, a0: number, a1: number, c0: number, c1: number): Rect => (alongX ? [a0, c0, a1, c1] : [c0, a0, c1, a1]);

/** A block's length and breadth, as spans, with the way it lies. */
function lengthwise(r: Rect): { alongX: boolean; a0: number; a1: number; c0: number; c1: number } {
  const alongX = r[2] - r[0] >= r[3] - r[1];
  return alongX ? { alongX, a0: r[0], a1: r[2], c0: r[1], c1: r[3] } : { alongX, a0: r[1], a1: r[3], c0: r[0], c1: r[2] };
}

/** The span across a block, whichever way it lies. */
const across = (r: Rect, alongX: boolean): [number, number] => (alongX ? [r[1], r[3]] : [r[0], r[2]]);

/** What a block is used for. */
export type Zone = "offices" | "homes" | "shops" | "hq";

/** The ring-shaped headquarters of the valley's biggest company, round a wooded courtyard. */
export interface Ring {
  x: number;
  z: number;
  /** Radii of its outer and inner walls. */
  outer: number;
  inner: number;
  storeys: number;
}

/** The block the ring stands on: beside the startup's, to the upper right of it from the starting view. */
export const HQ_BLOCK = { i: 0, j: -1 };

/**
 * A billboard on a roof: its middle, which way its face looks (it faces -z at 0), its size, how high its bottom
 * edge stands, and which of the advertisements it carries.
 */
export interface Billboard {
  x: number;
  z: number;
  rot: number;
  w: number;
  h: number;
  y0: number;
  ad: number;
}

/** How many different advertisements there are (see textures.ts). */
export const ADS = 8;
/** A billboard's legs lift it this far above its roof. */
export const BILLBOARD_LEGS = 0.7;

/** A car park: rows of bays across a rectangle of asphalt (see bays). */
export interface CarPark {
  rect: Rect;
}

export interface LawnTree {
  x: number;
  z: number;
  kind: TreeKind;
}

/** Everything that stands in the blocks: one pass over them, so the parts always agree with each other. */
export interface Town {
  buildings: Building[];
  carParks: CarPark[];
  /** Back-yard pools, at ground level. */
  pools: Rect[];
  /** Trees on the lawns of the campus, the office parks and the back yards. */
  lawnTrees: LawnTree[];
  zones: { i: number; j: number; zone: Zone }[];
  ring: Ring | null;
  billboards: Billboard[];
}

function office(r: Rect, rng: RngHolder, far: boolean): Building | null {
  const seed = Math.floor(rand(rng) * 10000);
  const want = Math.round(far && rand(rng) < 0.4 ? randRange(rng, 6, 11) : randRange(rng, 2, 5));
  const n = Math.min(want, storeysAllowed(r));
  if (n < 1) return null;
  const masses: Mass[] = [{ rect: r, y0: GROUND_Y, y1: level(n) }];
  // Some step back for their top floor or few.
  if (n >= 4 && rand(rng) < 0.35) {
    const top = setback(r, rng, 2, 6, 0.4);
    if (narrow(top) >= 10) {
      const k = n >= 7 ? Math.round(randRange(rng, 1, 3)) : 1;
      masses[0].y1 = level(n - k);
      masses.push({ rect: top, y0: level(n - k), y1: level(n) });
    }
  }
  const facade = pick(rng, ["glass", "glass", "glass", "ribbon", "ribbon", "fins", "grid"] as const);
  const finish = finishFor(masses[masses.length - 1].rect, n, rng);
  return {
    masses,
    facade,
    wall: facade === "glass" ? pick(rng, FRAMES) : pick(rng, CONCRETE),
    glass: facade === "glass" ? pick(rng, GLASS_TINTS) : pick(rng, DARK_GLASS),
    roof: pick(rng, ROOFS[finish]),
    finish,
    pitch: "flat",
    lit: randRange(rng, 0.15, 0.45),
    seed,
    crown: n >= 6 && rand(rng) < 0.35 ? pick(rng, CROWNS) : null,
  };
}

function house(r: Rect, rng: RngHolder): Building {
  const seed = Math.floor(rand(rng) * 10000);
  const n = rand(rng) < 0.7 ? 1 : 2;
  return {
    masses: [{ rect: r, y0: GROUND_Y, y1: level(n) }],
    facade: "house",
    wall: pick(rng, STUCCO),
    glass: pick(rng, DARK_GLASS),
    roof: pick(rng, ROOFS.tiles),
    finish: "tiles",
    pitch: pick(rng, ["gable", "gable", "hip"] as const),
    lit: randRange(rng, 0.3, 0.6),
    seed,
    crown: null,
  };
}

function shop(r: Rect, rng: RngHolder): Building {
  const seed = Math.floor(rand(rng) * 10000);
  const finish = rand(rng) < 0.6 ? "membrane" : "gravel";
  return {
    masses: [{ rect: r, y0: GROUND_Y, y1: level(1) }],
    facade: "glass",
    wall: pick(rng, SHOPFRONTS),
    glass: pick(rng, GLASS_TINTS),
    roof: pick(rng, ROOFS[finish]),
    finish,
    pitch: "flat",
    lit: 0.6,
    seed,
    crown: pick(rng, SIGNS),
  };
}

/** Trees scattered over `area`, clear of everything in `avoid` and of each other. */
function plant(area: Rect, avoid: Rect[], count: number, kinds: readonly TreeKind[], rng: RngHolder, out: LawnTree[]): void {
  const mine: LawnTree[] = [];
  for (let tries = 0; mine.length < count && tries < count * 30; tries++) {
    const x = randRange(rng, area[0], area[2]);
    const z = randRange(rng, area[1], area[3]);
    if (avoid.some((a) => inside(x, z, a, 3)) || mine.some((t) => Math.hypot(t.x - x, t.z - z) < 7)) continue;
    mine.push({ x, z, kind: pick(rng, kinds) });
  }
  out.push(...mine);
}

const area = (r: Rect) => Math.max(0, r[2] - r[0]) * Math.max(0, r[3] - r[1]);

/** One or two office buildings, each on a lawn with its car park beside it. */
function officePark(r: Rect, far: boolean, rng: RngHolder, town: Town): void {
  const { alongX, a0, a1 } = lengthwise(r);
  const parts: Rect[] = [];
  if (a1 - a0 > 90 && rand(rng) < 0.6) {
    const cut = a0 + (a1 - a0) * randRange(rng, 0.42, 0.58);
    parts.push(span(alongX, a0, cut - 3, ...across(r, alongX)), span(alongX, cut + 3, a1, ...across(r, alongX)));
  } else parts.push(r);
  for (const p of parts) {
    const { alongX: px, a0: p0, a1: p1, c0, c1 } = lengthwise(p);
    const length = Math.min(70, (p1 - p0) * randRange(rng, 0.45, 0.6));
    const depth = Math.min(42, c1 - c0 - 2 * randRange(rng, 7, 11));
    if (depth < 14 || length < 18) continue;
    const atStart = rand(rng) < 0.5;
    const lawn = randRange(rng, 6, 10);
    const b0 = atStart ? p0 + lawn : p1 - lawn - length;
    const middle = (c0 + c1) / 2 + randRange(rng, -0.25, 0.25) * (c1 - c0 - depth - 14);
    const foot = span(px, b0, b0 + length, middle - depth / 2, middle + depth / 2);
    const made = office(foot, rng, far);
    const avoid: Rect[] = [];
    if (made) {
      town.buildings.push(made);
      avoid.push(foot);
    }
    const k0 = atStart ? b0 + length + 6 : p0 + 3;
    const k1 = atStart ? p1 - 3 : b0 - 6;
    if (k1 - k0 >= 16) {
      const lot = span(px, k0, k1, c0 + 3, c1 - 3);
      town.carParks.push({ rect: lot });
      avoid.push(lot);
    }
    plant(p, avoid, Math.round(area(p) / 400), ["palm", "palm", "round", "round", "blossom", "cone"], rng, town.lawnTrees);
  }
}

/** Two rows of houses back to back, each facing its street, with a front yard, a deep back yard and sometimes a pool. */
function neighbourhood(r: Rect, rng: RngHolder, town: Town): void {
  const { alongX, a0, a1, c0, c1 } = lengthwise(r);
  const n = Math.max(2, Math.round((a1 - a0) / randRange(rng, 16, 20)));
  const lot = (a1 - a0) / n;
  const middle = (c0 + c1) / 2;
  for (const side of [-1, 1] as const) {
    const street = side < 0 ? c0 : c1;
    for (let k = 0; k < n; k++) {
      const width = lot - randRange(rng, 3.5, 5.5);
      const depth = randRange(rng, 9, 13);
      const front = randRange(rng, 5, 7.5);
      const centre = a0 + (k + 0.5) * lot + randRange(rng, -0.8, 0.8);
      const h0 = side < 0 ? street + front : street - front - depth;
      const foot = span(alongX, centre - width / 2, centre + width / 2, h0, h0 + depth);
      town.buildings.push(house(foot, rng));
      // The back yard runs from the house to the middle of the block.
      const y0 = side < 0 ? h0 + depth + 2 : middle + 1.5;
      const y1 = side < 0 ? middle - 1.5 : h0 - 2;
      const avoid: Rect[] = [foot];
      if (y1 - y0 >= 9 && rand(rng) < 0.35) {
        const pw = randRange(rng, 4, Math.min(8, width - 2));
        const pd = randRange(rng, 2.6, 4);
        const py = side < 0 ? y0 + 1.5 : y1 - 1.5 - pd;
        const pool = span(alongX, centre - pw / 2, centre + pw / 2, py, py + pd);
        town.pools.push(pool);
        avoid.push(pool);
      }
      if (y1 - y0 >= 9) plant(span(alongX, centre - lot / 2 + 1.5, centre + lot / 2 - 1.5, y0, y1), avoid, rand(rng) < 0.6 ? 2 : 1, ["round", "round", "palm", "blossom", "cone"], rng, town.lawnTrees);
    }
  }
}

/** A strip of shops along the back of the block, its car park in front on the street, and a small shop on the corner. */
function retail(r: Rect, rng: RngHolder, town: Town): void {
  const { alongX, a0, a1, c0, c1 } = lengthwise(r);
  const facing = rand(rng) < 0.5 ? 1 : -1;
  const length = (a1 - a0) * randRange(rng, 0.7, 0.88);
  const depth = randRange(rng, 18, 24);
  const s0 = a0 + 3 + (a1 - a0 - length - 6) * rand(rng);
  const back = facing > 0 ? c0 + 3 : c1 - 3 - depth;
  const strip = span(alongX, s0, s0 + length, back, back + depth);
  town.buildings.push(shop(strip, rng));
  // One or two billboards along the strip's front edge, facing its car park and the street beyond.
  const boards = length > 60 ? 2 : 1;
  const front = facing > 0 ? back + depth - 1 : back + 1;
  const rot = alongX ? (facing > 0 ? Math.PI : 0) : facing > 0 ? -Math.PI / 2 : Math.PI / 2;
  for (let k = 0; k < boards; k++) {
    const along = s0 + (length * (k + 1)) / (boards + 1);
    const [x, z] = alongX ? [along, front] : [front, along];
    town.billboards.push({ x, z, rot, w: Math.min(10, length / 3), h: 3, y0: level(1) + BILLBOARD_LEGS, ad: Math.floor(rand(rng) * ADS) });
  }
  const f0 = facing > 0 ? back + depth + 6 : c0 + 3;
  const f1 = facing > 0 ? c1 - 3 : back - 6;
  const padLength = randRange(rng, 14, 18);
  const padDepth = Math.min(randRange(rng, 12, 15), f1 - f0 - 2);
  const padAtStart = rand(rng) < 0.5;
  const pad0 = padAtStart ? a0 + 4 : a1 - 4 - padLength;
  if (padDepth >= 10) {
    const pad = span(alongX, pad0, pad0 + padLength, facing > 0 ? f1 - padDepth : f0, facing > 0 ? f1 : f0 + padDepth);
    town.buildings.push(shop(pad, rng));
  }
  const k0 = padAtStart ? pad0 + padLength + 5 : a0 + 3;
  const k1 = padAtStart ? a1 - 3 : pad0 - 5;
  if (k1 - k0 >= 16 && f1 - f0 >= 16) town.carParks.push({ rect: span(alongX, k0, k1, f0, f1) });
}

/** The ring: four storeys of curved glass round a wooded courtyard, with trees in the block's corners outside it. */
function headquarters(r: Rect, rng: RngHolder, town: Town): void {
  const x = (r[0] + r[2]) / 2;
  const z = (r[1] + r[3]) / 2;
  const outer = narrow(r) / 2 - 5;
  const ring: Ring = { x, z, outer, inner: outer - 13, storeys: 4 };
  town.ring = ring;
  const trees: LawnTree[] = [];
  const kinds = ["round", "round", "umbrella", "palm", "cone", "blossom"] as const;
  for (let tries = 0; trees.length < 60 && tries < 3000; tries++) {
    const px = randRange(rng, r[0] + 2, r[2] - 2);
    const pz = randRange(rng, r[1] + 2, r[3] - 2);
    const d = Math.hypot(px - x, pz - z);
    // In the courtyard, clear of the walls, or out in the corners beyond them.
    if (!(d < ring.inner - 5 || d > ring.outer + 6)) continue;
    if (trees.some((t) => Math.hypot(t.x - px, t.z - pz) < 7)) continue;
    trees.push({ x: px, z: pz, kind: pick(rng, kinds) });
  }
  town.lawnTrees.push(...trees);
}

/** The startup's own campus: its car park behind the building, and trees on the lawn round about. */
function campus(rng: RngHolder, town: Town): void {
  const t = towerBlock().rect;
  const lot: Rect = [t[0] + 6, t[1] + 5, t[2] - 6, PODIUM[1] - 8];
  if (lot[3] - lot[1] >= 16) town.carParks.push({ rect: lot });
  plant(inset(t, 1.5), [inset(PODIUM, -2), lot], Math.round(area(t) / 500), ["palm", "palm", "palm", "blossom", "round"], rng, town.lawnTrees);
}

const towns = new Map<number, Town>();

/** Everything in town but the startup's own building, the same every visit. */
export function town(seed = 31): Town {
  const known = towns.get(seed);
  if (known) return known;
  const rng: RngHolder = { rngState: seed };
  const made: Town = { buildings: [], carParks: [], pools: [], lawnTrees: [], zones: [], ring: null, billboards: [] };
  campus(rng, made);
  for (const b of blocks()) {
    if (isTowerBlock(b) || isPark(b)) continue;
    const near = Math.max(Math.abs(b.i), Math.abs(b.j)) <= 1;
    const roll = rand(rng);
    const hq = b.i === HQ_BLOCK.i && b.j === HQ_BLOCK.j;
    const zone: Zone = hq ? "hq" : near ? (roll < 0.55 ? "offices" : roll < 0.8 ? "shops" : "homes") : roll < 0.42 ? "offices" : roll < 0.82 ? "homes" : "shops";
    made.zones.push({ i: b.i, j: b.j, zone });
    const r = inset(b.rect, 1.5);
    if (zone === "hq") headquarters(r, rng, made);
    else if (zone === "offices") officePark(r, !near, rng, made);
    else if (zone === "homes") neighbourhood(r, rng, made);
    else retail(r, rng, made);
  }
  // The tallest office with room for one always has a helipad on its roof.
  const top = (b: Building) => b.masses[b.masses.length - 1];
  const tallest = made.buildings.filter((b) => b.pitch === "flat" && narrow(top(b).rect) >= 20).sort((a, b) => top(b).y1 - top(a).y1)[0];
  if (tallest && !made.buildings.some((b) => b.finish === "helipad")) {
    tallest.finish = "helipad";
    tallest.roof = ROOFS.helipad[0];
  }
  towns.set(seed, made);
  return made;
}

/** Every building in town but the startup's own. */
export const buildings = (seed = 31): Building[] => town(seed).buildings;

/** A bay in a car park: where a car stands and which way it faces (a car faces -z at 0). */
export interface Bay {
  x: number;
  z: number;
  rot: number;
}

/** Bays, the lines between them, and the aisles: 2.6 metres wide and 5.4 deep, two rows to each 7-metre aisle. */
export const BAY = { width: 2.6, depth: 5.4, aisle: 7 };

/** The bays in a car park, in rows along its longer side: two rows facing each other across each aisle. */
export function bays(cp: CarPark): Bay[] {
  const { alongX, a0, a1, c0, c1 } = lengthwise(cp.rect);
  const out: Bay[] = [];
  const stride = 2 * BAY.depth + BAY.aisle;
  const pairs = Math.floor((c1 - c0) / stride);
  const start = c0 + (c1 - c0 - pairs * stride) / 2;
  const count = Math.floor((a1 - a0 - 1) / BAY.width);
  const first = a0 + (a1 - a0 - count * BAY.width) / 2 + BAY.width / 2;
  for (let pair = 0; pair < pairs; pair++) {
    for (const side of [0, 1]) {
      const centre = start + pair * stride + BAY.depth / 2 + side * (BAY.depth + BAY.aisle);
      // Each car faces the aisle it came in from: the first row looks across it, the second back.
      const facing = side === 0 ? 1 : -1;
      for (let k = 0; k < count; k++) {
        const along = first + k * BAY.width;
        const [x, z] = alongX ? [along, centre] : [centre, along];
        const rot = alongX ? (facing > 0 ? Math.PI : 0) : facing > 0 ? -Math.PI / 2 : Math.PI / 2;
        out.push({ x, z, rot });
      }
    }
  }
  return out;
}

export interface ParkedCar extends Bay {
  kind: VehicleKind;
  colour: string;
}

/** Cars in about two bays in three, the same every visit. */
export function parkedCars(seed = 37): ParkedCar[] {
  const rng: RngHolder = { rngState: seed };
  const out: ParkedCar[] = [];
  for (const cp of town().carParks) {
    const share = randRange(rng, 0.45, 0.9);
    for (const b of bays(cp)) {
      if (rand(rng) > share) continue;
      const kind = pick(rng, PARKED);
      out.push({ ...b, kind, colour: kind === "taxi" ? pick(rng, TAXI_COLOURS) : kind === "robotaxi" ? ROBOTAXI : pick(rng, CAR_COLOURS) });
    }
  }
  return out;
}

const PARKED: readonly VehicleKind[] = ["sedan", "sedan", "sedan", "hatch", "suv", "suv", "van", "robotaxi"];

export interface Plant {
  kind: "box" | "tank" | "fan" | "panel" | "pool" | "helipad" | "shrub";
  x: number;
  z: number;
  w: number;
  d: number;
  /** Bottom and top. */
  y0: number;
  y1: number;
}

/** Solar panels: one module, and the rows they stand in. */
const PANEL = { w: 3.2, d: 1.6, gap: 0.4, row: 2.8 };

/**
 * Lift overruns, air handlers, cooling fans and water tanks on a building's roof, and whatever its finish brings: a
 * helipad in the middle, a pool on the terrace, planting, or rows of solar panels over the roof that is left.
 */
export function roofPlant(b: Building): Plant[] {
  // A pitched roof carries nothing.
  if (b.pitch !== "flat") return [];
  const top = b.masses[b.masses.length - 1];
  const rng: RngHolder = { rngState: b.seed };
  const [x0, z0, x1, z1] = inset(top.rect, PARAPET + 0.6);
  const out: Plant[] = [];
  const free = (r: Rect, margin: number) => r[0] >= x0 && r[2] <= x1 && r[1] >= z0 && r[3] <= z1 && !out.some((p) => overlaps(r, rect(p.x, p.z, p.w, p.d), margin));
  const room = (w: number, d: number) => {
    for (let tries = 0; tries < 12; tries++) {
      const x = randRange(rng, x0 + w / 2, x1 - w / 2);
      const z = randRange(rng, z0 + d / 2, z1 - d / 2);
      if (free(rect(x, z, w, d), 0.8)) return { x, z };
    }
    return null;
  };
  const put = (kind: Plant["kind"], x: number, z: number, w: number, d: number, h: number) => out.push({ kind, x, z, w, d, y0: top.y1, y1: top.y1 + h });
  const add = (kind: Plant["kind"], w: number, d: number, h: number) => {
    const at = room(w, d);
    if (at) put(kind, at.x, at.z, w, d, h);
  };
  if (b.finish === "helipad") {
    const s = Math.min(17, x1 - x0, z1 - z0);
    put("helipad", (x0 + x1) / 2, (z0 + z1) / 2, s, s, 0.15);
  }
  if (b.finish === "pool") add("pool", randRange(rng, 7, Math.min(13, x1 - x0 - 4)), randRange(rng, 3.2, 4.6), 0.35);
  add("box", randRange(rng, 4, 6), randRange(rng, 4, 7), randRange(rng, 2.4, 3.4));
  if (b.finish === "solar") {
    // A grid of modules centred on the roof, leaving out any that would sit on the lift overrun. Smaller plant
    // finds room between the rows afterwards, or goes without.
    const cols = Math.floor((x1 - x0 + PANEL.gap) / (PANEL.w + PANEL.gap));
    const rows = Math.floor((z1 - z0 - PANEL.d) / PANEL.row) + 1;
    const left = (x0 + x1) / 2 - (cols * (PANEL.w + PANEL.gap) - PANEL.gap) / 2;
    const back = (z0 + z1) / 2 - ((rows - 1) * PANEL.row + PANEL.d) / 2;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = left + i * (PANEL.w + PANEL.gap) + PANEL.w / 2;
        const z = back + j * PANEL.row + PANEL.d / 2;
        if (free(rect(x, z, PANEL.w, PANEL.d), 0.5)) put("panel", x, z, PANEL.w, PANEL.d, 0.9);
      }
    }
  }
  const units = Math.floor(randRange(rng, 1, 4));
  for (let k = 0; k < units; k++) add("box", randRange(rng, 2, 4.5), randRange(rng, 1.6, 3), randRange(rng, 1.2, 2));
  const fans = Math.floor(randRange(rng, 0, 3));
  for (let k = 0; k < fans; k++) add("fan", 2.4, 2.4, randRange(rng, 1.4, 2));
  if (b.facade === "stone" && rand(rng) < 0.7) add("tank", 3, 3, randRange(rng, 3, 3.8));
  if (b.finish === "green") {
    const shrubs = Math.floor(randRange(rng, 4, 10));
    for (let k = 0; k < shrubs; k++) {
      const s = randRange(rng, 1.2, 2.6);
      add("shrub", s, s, s * 0.75);
    }
  }
  return out;
}

/** Below this many storeys, a building has no aviation lights. Only the few taller offices far out carry them. */
export const BEACON_STOREYS = 9;

/** Red lights on the corners of anything tall enough to trouble a helicopter. */
export function beacons(b: Building): { x: number; y: number; z: number }[] {
  const top = b.masses[b.masses.length - 1];
  if (top.y1 - GROUND_Y < BEACON_STOREYS * STOREY) return [];
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

/**
 * A rounded oak, a narrow cypress, a wide umbrella of a crown, a jacaranda in flower, or a palm. Each pavement is
 * planted with one kind and each median with another, mostly palms; the campus is mostly palms, and the park mixed.
 */
export type TreeKind = "round" | "cone" | "umbrella" | "blossom" | "palm";

export interface Tree {
  x: number;
  z: number;
  /** Height in metres. */
  h: number;
  turn: number;
  kind: TreeKind;
  /** The colour of its leaves, or of its flowers. */
  leaf: string;
}

const LEAVES: Record<TreeKind, readonly string[]> = {
  round: ["#26432f", "#2b4a33", "#30502c", "#22402f", "#36532f", "#2c4626"],
  cone: ["#1f3a2c", "#1c3428", "#24402f", "#1a3a33"],
  umbrella: ["#2f4d2a", "#3a5630", "#29472e", "#40592f"],
  blossom: ["#ad5b84", "#bb739a", "#9461a3", "#c27f8f", "#c995ab", "#b39339"],
  palm: ["#4f7d3a", "#5a8a3f", "#44713a", "#638f45"],
};

/** How tall each kind grows, in metres. */
const TREE_HEIGHT: Record<TreeKind, [number, number]> = { round: [6, 9], cone: [7, 10.5], umbrella: [8, 11.5], blossom: [5, 7.5], palm: [9, 14] };

/** Palms and oaks stand this far apart down the middle of the medians. */
const MEDIAN_GAP = 13;

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

/**
 * A street lamp: the usual arm reaching over the road, a tall slim blade reaching further, or a short lantern on a
 * post. Its light is warm or cool.
 */
export type LampStyle = "arm" | "blade" | "lantern";

export interface Lamp extends Spot {
  style: LampStyle;
  warm: boolean;
}

/** How far each style's head reaches out over the road from its post. */
export const LAMP_REACH: Record<LampStyle, number> = { arm: 1.45, blade: 2.0, lantern: 0 };

/** Whether a lamp stands on the pavement along the park's railings. */
export const byThePark = (l: Spot, park = parkBlock().rect): boolean => inside(l.x, l.z, park, STREET.pavement);

/**
 * Street lamps along both kerbs of every road, evenly spaced between the junctions. Each road has one style and one
 * colour of light, arms or blades, except for warm lanterns along the park's railings.
 */
export function lamps(seed = 29): Lamp[] {
  const rng: RngHolder = { rngState: seed };
  const out: Lamp[] = [];
  const park = parkBlock().rect;
  for (const r of ROADS) {
    const style = pick(rng, ["arm", "arm", "blade"] as const);
    const warm = style === "blade" ? rand(rng) < 0.25 : rand(rng) < 0.8;
    for (const [a, b] of stretches(r)) {
      const n = Math.max(1, Math.round((b - a) / LAMP_GAP));
      for (let k = 0; k <= n; k++) {
        for (const side of [-1, 1] as const) {
          const [x, z] = kerbside(r, a + ((b - a) * k) / n, side, LAMP_IN);
          const rot = r.axis === "x" ? (side === 1 ? 0 : Math.PI) : side === 1 ? Math.PI / 2 : -Math.PI / 2;
          if (fadeAt(x, z) >= 0.95) continue;
          const spot = { x, z, rot };
          out.push(byThePark(spot, park) ? { ...spot, style: "lantern", warm: true } : { ...spot, style, warm });
        }
      }
    }
  }
  return out;
}

/** Width of the park's footpaths. */
const PARK_PATH = 3;

/** Where the park's paths cross. */
export function parkCentre(): [number, number] {
  const [x0, z0, x1, z1] = parkBlock().rect;
  return [(x0 + x1) / 2, (z0 + z1) / 2];
}

/** The outer edge of the loop path inside the railings. */
export const parkLoop = (): Rect => inset(parkBlock().rect, 6);

/** The fountain where the paths cross: its basin's radius, and the round paved square it stands in. */
export const FOUNTAIN = { r: 3.6, square: 7.5 };

/** Street trees halfway between the lamps and down the medians, on the lawns of the blocks, and across the park. */
export function trees(seed = 13): Tree[] {
  const rng: RngHolder = { rngState: seed };
  const out: Tree[] = [];
  const add = (x: number, z: number, kind: TreeKind) =>
    out.push({ x, z, h: randRange(rng, ...TREE_HEIGHT[kind]), turn: randRange(rng, 0, Math.PI * 2), kind, leaf: pick(rng, LEAVES[kind]) });
  ROADS.forEach((r, i) => {
    // Every median is planted, mostly with palms. Not every pavement is, and each that is has one kind of tree.
    const middle = rand(rng) < 0.75 ? "palm" : "round";
    const kerb = i % 3 === 1 ? null : pick(rng, ["palm", "palm", "round", "round", "cone", "blossom"] as const);
    for (const [a, b] of stretches(r)) {
      const n = Math.max(1, Math.round((b - a) / LAMP_GAP));
      for (let k = 0; k < n && kerb; k++) {
        for (const side of [-1, 1] as const) {
          const [x, z] = kerbside(r, a + ((b - a) * (k + 0.5)) / n, side, TREE_IN);
          if (fadeAt(x, z) < 0.9) add(x, z, kerb);
        }
      }
      const m = Math.max(1, Math.round((b - a) / MEDIAN_GAP));
      for (let k = 0; k <= m; k++) {
        const along = a + ((b - a) * k) / m;
        const [x, z] = r.axis === "x" ? [along, r.at] : [r.at, along];
        if (fadeAt(x, z) < 0.9) add(x, z, middle);
      }
    }
  });
  for (const t of town().lawnTrees) if (fadeAt(t.x, t.z) < 0.92) add(t.x, t.z, t.kind);
  // The park: scattered, off the paths, the fountain's square and the flower beds.
  const park = parkBlock().rect;
  const paths = parkPaths();
  const [cx, cz] = parkCentre();
  const planted: Tree[] = [];
  for (let tries = 0; planted.length < 46 && tries < 1500; tries++) {
    const x = randRange(rng, park[0] + 4, park[2] - 4);
    const z = randRange(rng, park[1] + 4, park[3] - 4);
    if (paths.some((p) => inside(x, z, p, 3)) || Math.hypot(x - cx, z - cz) < FOUNTAIN.square + 3 || planted.some((t) => Math.hypot(t.x - x, t.z - z) < 7.5)) continue;
    add(x, z, pick(rng, ["umbrella", "umbrella", "round", "round", "palm", "cone", "blossom"] as const));
    planted.push(out[out.length - 1]);
  }
  return out;
}

/** Footpaths across the park: one each way through the middle and a loop inside the railings. */
export function parkPaths(): Rect[] {
  const [x0, z0, x1, z1] = parkBlock().rect;
  const [cx, cz] = parkCentre();
  const w = PARK_PATH;
  const loop = parkLoop();
  return [
    [x0, cz - w / 2, x1, cz + w / 2],
    [cx - w / 2, z0, cx + w / 2, z1],
    [loop[0], loop[1], loop[2], loop[1] + w],
    [loop[0], loop[3] - w, loop[2], loop[3]],
    [loop[0], loop[1], loop[0] + w, loop[3]],
    [loop[2] - w, loop[1], loop[2], loop[3]],
  ];
}

/** Beds of flowers along both sides of each arm of the paths, from the fountain's square out toward the loop. */
export function flowerBeds(): Rect[] {
  const [cx, cz] = parkCentre();
  const loop = parkLoop();
  const out: Rect[] = [];
  const near = PARK_PATH / 2 + 0.6;
  const far = near + 1.6;
  for (const dir of [-1, 1]) {
    // Along x, then along z, each bed stopping short of the loop.
    const ax = [cx + dir * (FOUNTAIN.square + 2), dir > 0 ? Math.min(cx + dir * (FOUNTAIN.square + 16), loop[2] - PARK_PATH - 3) : Math.max(cx + dir * (FOUNTAIN.square + 16), loop[0] + PARK_PATH + 3)];
    const az = [cz + dir * (FOUNTAIN.square + 2), dir > 0 ? Math.min(cz + dir * (FOUNTAIN.square + 14), loop[3] - PARK_PATH - 3) : Math.max(cz + dir * (FOUNTAIN.square + 14), loop[1] + PARK_PATH + 3)];
    for (const side of [-1, 1]) {
      out.push([Math.min(...ax), Math.min(cz + side * near, cz + side * far), Math.max(...ax), Math.max(cz + side * near, cz + side * far)]);
      out.push([Math.min(cx + side * near, cx + side * far), Math.min(...az), Math.max(cx + side * near, cx + side * far), Math.max(...az)]);
    }
  }
  return out;
}

/** Flowers in the beds: where each stands and its colour. */
export function flowers(seed = 17): { x: number; z: number; colour: string }[] {
  const rng: RngHolder = { rngState: seed };
  const colours = ["#e0567a", "#f2c14e", "#f4f1ea", "#b06ad8", "#ff8a5c", "#e86aa6", "#7fb4ff"];
  return flowerBeds().flatMap(([x0, z0, x1, z1]) => {
    const n = Math.round(((x1 - x0) * (z1 - z0)) / 0.7);
    return Array.from({ length: n }, () => ({ x: randRange(rng, x0 + 0.25, x1 - 0.25), z: randRange(rng, z0 + 0.25, z1 - 0.25), colour: pick(rng, colours) }));
  });
}

/** Benches on the inner side of the loop path, facing it, clear of where the cross paths meet it. A bench faces -z at 0. */
export function benches(): Spot[] {
  const [cx, cz] = parkCentre();
  const loop = parkLoop();
  const out: Spot[] = [];
  const back = PARK_PATH + 0.7;
  for (let x = loop[0] + 14; x <= loop[2] - 14; x += 12) {
    if (Math.abs(x - cx) < 6) continue;
    out.push({ x, z: loop[1] + back, rot: 0 }, { x, z: loop[3] - back, rot: Math.PI });
  }
  for (let z = loop[1] + 14; z <= loop[3] - 14; z += 12) {
    if (Math.abs(z - cz) < 6) continue;
    out.push({ x: loop[0] + back, z, rot: Math.PI / 2 }, { x: loop[2] - back, z, rot: -Math.PI / 2 });
  }
  return out;
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

/**
 * Saloons, hatchbacks, SUVs, taxis and vans all fit within a car's length; trucks and buses within a truck's. The
 * junctions' timing is worked out from those two lengths, so no vehicle may be longer.
 */
export type VehicleKind = "sedan" | "hatch" | "suv" | "taxi" | "robotaxi" | "van" | "truck" | "bus";

export const isLong = (kind: VehicleKind): boolean => kind === "truck" || kind === "bus";

export interface Vehicle {
  lane: number;
  slot: number;
  kind: VehicleKind;
  colour: string;
}

export const CAR_COLOURS = ["#d9d9de", "#26262e", "#8a8f99", "#2f4c8f", "#9c1f2b", "#e8e4d8", "#3d5c47", "#5a5f6b", "#b5562a", "#1d3557"];
const TAXI_COLOURS = ["#e8b31f", "#e8b31f", "#3e9a5f"];
/** Self-driving taxis are all white, with a spinning sensor on the roof. */
const ROBOTAXI = "#f1f1ee";
const BUS_COLOURS = ["#c8323c", "#2f7d4f", "#e8e4d8", "#2f5fa0"];
const SHORT: readonly VehicleKind[] = ["sedan", "sedan", "sedan", "sedan", "hatch", "hatch", "suv", "suv", "taxi", "robotaxi", "robotaxi", "van"];

/** About four places in five filled, a few with trucks and buses; the same traffic every visit. */
export function traffic(seed = 21): Vehicle[] {
  const rng: RngHolder = { rngState: seed };
  const out: Vehicle[] = [];
  LANES.forEach((lane, l) => {
    for (let slot = 0; slot < lane.slots; slot++) {
      if (rand(rng) > 0.8) continue;
      const long = rand(rng) < (lane.axis === "x" ? 0.12 : 0.07);
      const kind: VehicleKind = long ? (rand(rng) < 0.5 ? "bus" : "truck") : pick(rng, SHORT);
      const colour = kind === "taxi" ? pick(rng, TAXI_COLOURS) : kind === "bus" ? pick(rng, BUS_COLOURS) : kind === "robotaxi" ? ROBOTAXI : pick(rng, CAR_COLOURS);
      out.push({ lane: l, slot, kind, colour });
    }
  });
  return out;
}

/** The ground a vehicle covers at time t. */
export function vehicleRect(v: Vehicle, t: number): Rect {
  const lane = LANES[v.lane];
  const { x, z } = vehicleAt(lane, v.slot, t);
  const length = isLong(v.kind) ? VEHICLE.truck : VEHICLE.car;
  const width = isLong(v.kind) ? VEHICLE.width : 1.8;
  return lane.axis === "x" ? rect(x, z, length, width) : rect(x, z, width, length);
}

/* ------------------------------------------------------------------ */
/* Pedestrians                                                         */
/* ------------------------------------------------------------------ */

/**
 * Where people walk: round and round a rectangle, never across a road, since the junctions leave traffic no gap for
 * them. Each block has two loops on its pavement, between the building line and the tree pits, one each way; the
 * park has two on its loop path, and the tower's plaza one round the podium.
 */
/** Building line to each loop, and the most room a passer-by takes either side of it. */
export const WALK = { near: 0.65, far: 1.3, radius: 0.45 };

function walkLoops(): Rect[] {
  const out: Rect[] = [];
  const grow = (r: Rect, by: number): Rect => inset(r, -by);
  for (const b of blocks()) {
    const nx = Math.min(Math.max(FADE.x, b.rect[0]), b.rect[2]);
    const nz = Math.min(Math.max(FADE.z, b.rect[1]), b.rect[3]);
    if (fadeAt(nx, nz) > 0.6) continue;
    out.push(grow(b.rect, WALK.near), grow(b.rect, WALK.far));
  }
  const loop = parkLoop();
  out.push(inset(loop, PARK_PATH / 2 - 0.6), inset(loop, PARK_PATH / 2 + 0.6));
  out.push(grow(PODIUM, 2));
  return out;
}

/** Every walking loop, the same on every visit. */
export const WALKS: Rect[] = walkLoops();

export interface Pedestrian {
  walk: number;
  /** Where round the loop they start, in metres, and which way they go. */
  at: number;
  dir: 1 | -1;
  /** Metres a second. */
  speed: number;
  /** Height relative to an average passer-by. */
  size: number;
  colour: string;
}

export const PEOPLE_COLOURS = ["#ff8fab", "#7fd6ff", "#9be38b", "#ffd166", "#c39bff", "#ff9f68", "#6ee7c8", "#f4f1ea", "#ff6b6b", "#8fb3ff"];

const perimeter = (r: Rect) => 2 * (r[2] - r[0] + r[3] - r[1]);

/** About one person every 22 metres of loop, each loop one way round; the same crowd every visit. */
export function pedestrians(seed = 23): Pedestrian[] {
  const rng: RngHolder = { rngState: seed };
  const out: Pedestrian[] = [];
  WALKS.forEach((r, walk) => {
    const n = Math.round(perimeter(r) / 22);
    const dir: 1 | -1 = walk % 2 === 0 ? 1 : -1;
    for (let k = 0; k < n; k++) {
      out.push({ walk, at: ((k + randRange(rng, -0.3, 0.3)) * perimeter(r)) / n, dir, speed: randRange(rng, 1.0, 1.5), size: randRange(rng, 0.75, 1.2), colour: pick(rng, PEOPLE_COLOURS) });
    }
  });
  return out;
}

/** Where a pedestrian is at time t, and which way they face (they face -z at 0). */
export function walkerAt(p: Pedestrian, t: number): { x: number; z: number; heading: number } {
  const [x0, z0, x1, z1] = WALKS[p.walk];
  const w = x1 - x0;
  const d = z1 - z0;
  const all = 2 * (w + d);
  const s = (((p.at + p.dir * p.speed * t) % all) + all) % all;
  // Round the loop: along the back edge, down the right, along the front backwards, up the left.
  let x: number, z: number, dx: number, dz: number;
  if (s < w) [x, z, dx, dz] = [x0 + s, z0, 1, 0];
  else if (s < w + d) [x, z, dx, dz] = [x1, z0 + s - w, 0, 1];
  else if (s < 2 * w + d) [x, z, dx, dz] = [x1 - (s - w - d), z1, -1, 0];
  else [x, z, dx, dz] = [x0, z1 - (s - 2 * w - d), 0, -1];
  return { x, z, heading: Math.atan2(-dx * p.dir, -dz * p.dir) };
}
