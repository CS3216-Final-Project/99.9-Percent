import { pick, rand, randRange, type RngHolder } from "@/sim/rng";
import { ROOM } from "./layout";

/*
 * The world outside the office, at night: a Silicon Valley tech campus. The
 * building sits in a parking lot ringed with palms, with a palm-lined drive,
 * a "99.99%" monument sign at the entrance, low glass offices next door, an
 * eight-lane expressway behind it and a commuter railway beyond that.
 *
 * Everything here is plain data and arithmetic, kept free of React and
 * three.js so the layout and the traffic can be tested; exterior.tsx draws
 * it. The world fades into the night sky with distance from the building, so
 * it has no edge.
 */

/** Ground level outside: the bottom of the building's plinth. */
export const GROUND_Y = -0.5;
/** The night sky, which the world fades into. Matches the scene background. */
export const NIGHT = "#1a1633";
/** The point the fade is measured from, and where it starts and is complete. */
export const FADE = { x: ROOM.cx, z: ROOM.cz, from: 70, to: 150 };

/** How far into the fade a point is: 0 is clear, 1 is lost in the night. */
export function fadeAt(x: number, z: number): number {
  const d = Math.hypot(x - FADE.x, z - FADE.z);
  const t = Math.min(1, Math.max(0, (d - FADE.from) / (FADE.to - FADE.from)));
  return t * t * (3 - 2 * t);
}

/** A rectangle on the ground: x0, z0 to x1, z1. */
export type Rect = [number, number, number, number];

const rect = (x: number, z: number, w: number, d: number): Rect => [x - w / 2, z - d / 2, x + w / 2, z + d / 2];

export function overlaps(a: Rect, b: Rect, margin = 0): boolean {
  return a[0] < b[2] + margin && b[0] < a[2] + margin && a[1] < b[3] + margin && b[1] < a[3] + margin;
}

export function inside(x: number, z: number, r: Rect, margin = 0): boolean {
  return x > r[0] - margin && x < r[2] + margin && z > r[1] - margin && z < r[3] + margin;
}

/** The office and the pavement round it. */
export const BUILDING: Rect = [ROOM.x0 - 0.25, ROOM.z0 - 0.25, ROOM.x1 + 0.25, ROOM.z1 + 0.25];
export const PAVEMENT = 3;
/**
 * How far tall things (trees, lamps, other buildings) keep from the office. Seen from the usual tilt, anything
 * h metres tall standing nearer than about 1.6h would stand in front of the office and hide the crew.
 */
export const CLEAR = 18;

/** Distance from a point to the office's outline, zero inside it. */
export function fromBuilding(x: number, z: number): number {
  const [x0, z0, x1, z1] = BUILDING;
  return Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1));
}

/** How far the long roads and the railway run each way before they are lost in the night. */
export const REACH = 170;

/* ------------------------------------------------------------------ */
/* Roads and the railway                                               */
/* ------------------------------------------------------------------ */

export const LANE = 3.4;

/** The expressway behind the office: three lanes each way either side of a barrier. */
export const EXPRESSWAY = { z: -38, lanes: 3, median: 1.2, shoulder: 1.5 };
export const EXPRESSWAY_WIDTH = 2 * (EXPRESSWAY.lanes * LANE + EXPRESSWAY.shoulder) + EXPRESSWAY.median;
/** The two tracks of the railway beyond it. */
export const RAILWAY = { z: -58, gauge: 1.435, spacing: 4.2, width: 9 };
/** The local road in front of the campus, one lane each way. */
export const AVENUE = { z: 62, width: 2 * LANE + 1.2 };
/** The road up the east side, from the avenue to a frontage road along the expressway. */
export const SIDE_ROAD = { x: 44, width: 2 * LANE + 1.2 };
export const FRONTAGE = { z: -20, width: 2 * LANE };
/** The palm-lined drive from the avenue to the front door. */
export const DRIVE = { x: 3.2, width: 7 };

/** Every stretch of tarmac and track, as rectangles. */
export const ROADS: { name: string; rect: Rect }[] = [
  { name: "expressway", rect: rect(0, EXPRESSWAY.z, 2 * REACH, EXPRESSWAY_WIDTH) },
  { name: "railway", rect: rect(0, RAILWAY.z, 2 * REACH, RAILWAY.width) },
  { name: "avenue", rect: rect(0, AVENUE.z, 2 * REACH, AVENUE.width) },
  { name: "side road", rect: [SIDE_ROAD.x - SIDE_ROAD.width / 2, FRONTAGE.z - FRONTAGE.width / 2, SIDE_ROAD.x + SIDE_ROAD.width / 2, AVENUE.z] },
  { name: "frontage road", rect: [-60, FRONTAGE.z - FRONTAGE.width / 2, SIDE_ROAD.x + SIDE_ROAD.width / 2, FRONTAGE.z + FRONTAGE.width / 2] },
  { name: "drive", rect: [DRIVE.x - DRIVE.width / 2, ROOM.z1 + PAVEMENT + 0.25, DRIVE.x + DRIVE.width / 2, AVENUE.z - AVENUE.width / 2] },
];

/* ------------------------------------------------------------------ */
/* The parking lot                                                     */
/* ------------------------------------------------------------------ */

export const STALL = { w: 2.7, d: 5.2 };
/** The lot in front of the office, between the pavement and the avenue. */
export const LOT: Rect = [-38, ROOM.z1 + PAVEMENT + 0.25, 36, 55];
/** Rows of stalls as the z of their nearer edge and the way the cars face (+1 towards +z). The middle two meet nose to nose. */
const ROWS: { z: number; facing: 1 | -1 }[] = [
  { z: LOT[1] + 0.5, facing: -1 },
  { z: 31, facing: 1 },
  { z: 31 + STALL.d, facing: -1 },
  { z: 48.6, facing: 1 },
];
/** Where the lot's lamps stand, on islands between the middle rows. */
export const LOT_LAMPS = [-30, -16, 18, 30];
export const LOT_LAMP_Z = 31 + STALL.d;
/** Planted strips either side of the drive, for its palms and lamps. */
export const DRIVE_VERGE = 1.4;

export interface Parked {
  x: number;
  z: number;
  rot: number;
  colour: string;
}

export const CAR_COLOURS = ["#d9d9de", "#26262e", "#8a8f99", "#2f4c8f", "#9c1f2b", "#e8e4d8", "#3d5c47", "#5a5f6b", "#c8a24a", "#1d3557"];

/** Stalls in the lot, leaving the drive and its verges clear and an island round each lamp. Cars face -z at rot 0. */
export function stalls(): { x: number; z: number; rot: number }[] {
  const out: { x: number; z: number; rot: number }[] = [];
  ROWS.forEach((row, r) => {
    for (let x = LOT[0] + STALL.w / 2; x <= LOT[2] - STALL.w / 2; x += STALL.w) {
      if (Math.abs(x - DRIVE.x) < DRIVE.width / 2 + DRIVE_VERGE + STALL.w / 2) continue;
      if ((r === 1 || r === 2) && LOT_LAMPS.some((l) => Math.abs(x - l) < STALL.w)) continue;
      out.push({ x, z: row.z + STALL.d / 2, rot: row.facing === -1 ? 0 : Math.PI });
    }
  });
  return out;
}

/** Cars parked in about two thirds of the stalls, the same ones every visit. */
export function parkedCars(seed = 99): Parked[] {
  const rng: RngHolder = { rngState: seed };
  return stalls()
    .filter(() => rand(rng) < 0.68)
    .map((s) => ({ ...s, x: s.x + randRange(rng, -0.15, 0.15), colour: pick(rng, CAR_COLOURS) }));
}

/* ------------------------------------------------------------------ */
/* Neighbours                                                          */
/* ------------------------------------------------------------------ */

export interface Neighbour {
  x: number;
  z: number;
  w: number;
  d: number;
  /** Storeys, four metres each. */
  floors: number;
  glass: string;
}

export const STOREY = 4;

/** Low glass offices on the neighbouring lots, and across the railway. */
export const NEIGHBOURS: Neighbour[] = [
  { x: 72, z: -2, w: 24, d: 30, floors: 3, glass: "#24476b" },
  { x: 74, z: 36, w: 20, d: 20, floors: 2, glass: "#2b3d5c" },
  { x: -66, z: 0, w: 26, d: 26, floors: 4, glass: "#1f4a5c" },
  { x: -64, z: 38, w: 20, d: 24, floors: 2, glass: "#33355e" },
  { x: -18, z: -84, w: 40, d: 18, floors: 5, glass: "#20405f" },
  { x: 34, z: -82, w: 26, d: 20, floors: 3, glass: "#2a3f66" },
];

export const neighbourRect = (n: Neighbour): Rect => rect(n.x, n.z, n.w, n.d);

/* ------------------------------------------------------------------ */
/* Trees, lamps and the sign                                           */
/* ------------------------------------------------------------------ */

export interface Tree {
  x: number;
  z: number;
  /** Height in metres. */
  h: number;
  /** A palm's lean, or an oak's turn, in radians. */
  lean: number;
  turn: number;
}

/** Where the drive's palms stand along its verges; its lamps stand halfway between. */
const DRIVE_PALMS = Array.from({ length: 5 }, (_, i) => BUILDING[3] + CLEAR + 0.5 + i * 6);
const verge = (side: -1 | 1) => DRIVE.x + side * (DRIVE.width / 2 + DRIVE_VERGE / 2);

/** Palms line the drive and the avenue, and stand at the corners of the lot. */
export function palms(seed = 7): Tree[] {
  const rng: RngHolder = { rngState: seed };
  const spots: [number, number][] = [];
  for (const z of DRIVE_PALMS) spots.push([verge(-1), z], [verge(1), z]);
  for (let x = -90; x <= 90; x += 15) if (Math.abs(x - DRIVE.x) > 8) spots.push([x, AVENUE.z + AVENUE.width / 2 + 2.2]);
  spots.push([LOT[0] - 2.5, LOT[1] + 6], [LOT[2] + 2.5, LOT[1] + 6], [LOT[0] - 2.5, LOT[3] - 2], [LOT[2] + 2.5, LOT[3] - 2]);
  return spots.map(([x, z]) => ({ x, z, h: randRange(rng, 8, 11), lean: randRange(rng, -0.08, 0.08), turn: randRange(rng, 0, Math.PI * 2) }));
}

/** Oaks shade the lawns round the neighbours and the side of the office. */
export function oaks(seed = 13): Tree[] {
  const rng: RngHolder = { rngState: seed };
  const out: Tree[] = [];
  const blocked = (x: number, z: number) =>
    fromBuilding(x, z) < CLEAR ||
    inside(x, z, LOT, 2.5) ||
    ROADS.some((r) => inside(x, z, r.rect, 3)) ||
    NEIGHBOURS.some((n) => inside(x, z, neighbourRect(n), 3)) ||
    out.some((t) => Math.hypot(t.x - x, t.z - z) < 7);
  for (let tries = 0; out.length < 70 && tries < 2000; tries++) {
    const x = randRange(rng, -110, 110);
    const z = randRange(rng, -100, 100);
    if (fadeAt(x, z) > 0.6 || blocked(x, z)) continue;
    out.push({ x, z, h: randRange(rng, 5, 8.5), lean: 0, turn: randRange(rng, 0, Math.PI * 2) });
  }
  return out;
}

/** Street lamps: along the drive, through the lot, the avenue and both sides of the expressway. */
export function lamps(): { x: number; z: number; rot: number }[] {
  const out: { x: number; z: number; rot: number }[] = [];
  for (const z of DRIVE_PALMS.slice(0, -1)) out.push({ x: verge(-1), z: z + 3, rot: -Math.PI / 2 }, { x: verge(1), z: z + 3, rot: Math.PI / 2 });
  for (const x of LOT_LAMPS) out.push({ x, z: LOT_LAMP_Z, rot: 0 });
  for (let x = -120; x <= 120; x += 24) out.push({ x, z: AVENUE.z - AVENUE.width / 2 - 0.6, rot: Math.PI });
  for (let x = -150; x <= 150; x += 30) {
    out.push({ x, z: EXPRESSWAY.z + EXPRESSWAY_WIDTH / 2 + 0.6, rot: 0 });
    out.push({ x: x + 15, z: EXPRESSWAY.z - EXPRESSWAY_WIDTH / 2 - 0.6, rot: Math.PI });
  }
  // Where a run of lamps crosses another road, that lamp is left out.
  return out.filter((l) => fadeAt(l.x, l.z) < 0.95 && fromBuilding(l.x, l.z) >= CLEAR && !ROADS.some((r) => inside(l.x, l.z, r.rect, 0.5)));
}

/** The company's monument sign at the end of the drive. */
export const MONUMENT = { x: DRIVE.x - DRIVE.width / 2 - DRIVE_VERGE - 4, z: LOT[3] + 1.5, w: 6.4, h: 1.5, d: 0.9 };

/* ------------------------------------------------------------------ */
/* Traffic                                                             */
/* ------------------------------------------------------------------ */

export interface Lane {
  /** The z of the lane's centre line, and which way along x it runs. */
  z: number;
  dir: 1 | -1;
  /** Metres a second. */
  speed: number;
  /** How many vehicles share the lane, evenly spread over its loop. */
  count: number;
  /** A shift so lanes do not line up. */
  offset: number;
}

/** Length of a lane's loop; vehicles leave one end and come back at the other, unseen in the night. */
export const LOOP = 2 * REACH;
/** The longest vehicle, a truck, and the gap it keeps. */
export const VEHICLE = { car: 4.6, truck: 9, gap: 6 };

export const LANES: Lane[] = [
  ...Array.from({ length: EXPRESSWAY.lanes }, (_, i): Lane => ({
    z: EXPRESSWAY.z + EXPRESSWAY.median / 2 + LANE / 2 + i * LANE,
    dir: 1,
    speed: 24 - i * 3,
    count: 7 - i,
    offset: i * 37,
  })),
  ...Array.from({ length: EXPRESSWAY.lanes }, (_, i): Lane => ({
    z: EXPRESSWAY.z - EXPRESSWAY.median / 2 - LANE / 2 - i * LANE,
    dir: -1,
    speed: 25 - i * 3,
    count: 7 - i,
    offset: 19 + i * 41,
  })),
  { z: AVENUE.z + 0.6 + LANE / 2, dir: 1, speed: 11, count: 4, offset: 11 },
  { z: AVENUE.z - 0.6 - LANE / 2, dir: -1, speed: 12, count: 4, offset: 53 },
];

/** Where vehicle i of a lane is along x at time t, or where it would be off in the night. */
export function vehicleX(lane: Lane, i: number, t: number): number {
  const travelled = lane.offset + (i * LOOP) / lane.count + lane.speed * t;
  const along = ((travelled % LOOP) + LOOP) % LOOP;
  return lane.dir * (along - REACH);
}

/** Every sixth expressway vehicle is a truck. */
export const isTruck = (laneIndex: number, i: number) => laneIndex < 2 * EXPRESSWAY.lanes && (i + laneIndex) % 6 === 0;

/* ------------------------------------------------------------------ */
/* The train                                                           */
/* ------------------------------------------------------------------ */

export const TRAIN = { cars: 5, carLength: 25, gap: 1, speed: 22, height: 4.6, width: 3.1, every: 55 };
export const TRAIN_LENGTH = TRAIN.cars * TRAIN.carLength + (TRAIN.cars - 1) * TRAIN.gap;

/**
 * The x of the front of the train at time t, and the way it runs, or null
 * while no train is passing. Trains alternate direction and track.
 */
export function trainAt(t: number): { x: number; dir: 1 | -1; z: number } | null {
  const run = Math.floor(t / TRAIN.every);
  const since = t - run * TRAIN.every;
  const distance = 2 * REACH + TRAIN_LENGTH;
  const travelled = since * TRAIN.speed;
  if (travelled > distance) return null;
  const dir: 1 | -1 = run % 2 === 0 ? 1 : -1;
  const z = RAILWAY.z + (dir === 1 ? RAILWAY.spacing / 2 : -RAILWAY.spacing / 2);
  return { x: dir * (travelled - REACH), dir, z };
}
