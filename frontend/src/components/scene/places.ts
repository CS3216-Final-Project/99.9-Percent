import { FLOOR_NAME, type Floor } from "@/game/floors";
import { CLOSED_ROOMS, ELEVATOR_SPOT, SERVER_ROOMS, SERVER_ZONE_NAMES, ZONE_NAMES } from "./floorplan";
import { ROOM } from "./layout";
import { atElevator, ELEVATOR_APRON } from "./player";

/*
 * Where on a floor a spot is, by name: the room behind glass it stands in, or else the open zone whose name is
 * nearest. The names are the ones the room hangs over its zones (see floorplan.ts), so the map, its location line
 * and the room cannot disagree. Kept free of React and three.js so it can be tested.
 */

type Rect = [number, number, number, number];

const inside = (r: Rect, x: number, z: number) => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3];

/** The office's rooms behind glass, each named by the zone name that hangs inside it. */
const OFFICE_ROOMS: [string, Rect][] = CLOSED_ROOMS.map((r) => [ZONE_NAMES.find(([, x, z]) => inside(r, x, z))?.[0] ?? "Office", r]);

/** The names hung over open floor, where the nearest one says where a spot is. */
const OPEN: Record<Floor, [string, number, number][]> = {
  office: ZONE_NAMES.filter(([, x, z]) => !CLOSED_ROOMS.some((r) => inside(r, x, z))),
  servers: SERVER_ZONE_NAMES,
};

const ROOMS: Record<Floor, [string, Rect][]> = { office: OFFICE_ROOMS, servers: SERVER_ROOMS };

/** The name of the place on `floor` that (x, z) stands in. */
export function placeAt(floor: Floor, x: number, z: number): string {
  if (inside(ELEVATOR_SPOT, x, z) || atElevator(x, z)) return "Elevator";
  const room = ROOMS[floor].find(([, r]) => inside(r, x, z));
  if (room) return room[0];
  let best = OPEN[floor][0];
  let bestD = Infinity;
  for (const zone of OPEN[floor]) {
    const d = Math.hypot(zone[1] - x, zone[2] - z);
    if (d < bestD) {
      best = zone;
      bestD = d;
    }
  }
  return best[0];
}

/** The zones' names on a floor, where they hang in the room. */
export function zoneNamesOn(floor: Floor): [string, number, number][] {
  return floor === "office" ? ZONE_NAMES : [...SERVER_ZONE_NAMES, ...SERVER_ROOMS.map(([n, r]): [string, number, number] => [n, (r[0] + r[2]) / 2, n === "Server hall" ? r[1] + 1.4 : (r[1] + r[3]) / 2])];
}

type Point = [number, number];

/** A zone as the map draws it: its name, its outline on the floor, and which of the map's tints it takes. */
export interface ZoneArea {
  name: string;
  points: Point[];
  /** One of the ZONE_TONES tints, or null for the elevator, which is drawn plain. */
  tone: number | null;
}

/** How many tints the map's zones take turns with: as many as stay easy to tell apart. Zones that meet never share one. */
export const ZONE_TONES = 5;

const rectPoints = ([x0, z0, x1, z1]: Rect): Point[] => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];

/** The part of a convex outline nearer `a` than `b`: one side of the line halfway between them. */
function nearerTo(outline: Point[], a: Point, b: Point): Point[] {
  const nx = b[0] - a[0];
  const nz = b[1] - a[1];
  const c = (b[0] * b[0] + b[1] * b[1] - a[0] * a[0] - a[1] * a[1]) / 2;
  const side = (p: Point) => c - (p[0] * nx + p[1] * nz);
  const kept: Point[] = [];
  outline.forEach((p, i) => {
    const q = outline[(i + 1) % outline.length];
    const sp = side(p);
    const sq = side(q);
    if (sp >= 0) kept.push(p);
    if (sp >= 0 !== sq >= 0) {
      const t = sp / (sp - sq);
      kept.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  });
  return kept;
}

/** Metres between the spots sampled to tell which zones meet. */
const MEET_STEP = 0.5;

/** Which zones on a floor meet, by name, found the way the location line names spots. */
function meetings(floor: Floor): Map<string, Set<string>> {
  const meet = new Map<string, Set<string>>();
  const touch = (a: string, b: string) => {
    if (a === b) return;
    meet.set(a, (meet.get(a) ?? new Set()).add(b));
    meet.set(b, (meet.get(b) ?? new Set()).add(a));
  };
  for (let x = ROOM.x0 + MEET_STEP / 2; x < ROOM.x1; x += MEET_STEP)
    for (let z = ROOM.z0 + MEET_STEP / 2; z < ROOM.z1; z += MEET_STEP) {
      const here = placeAt(floor, x, z);
      if (x + MEET_STEP < ROOM.x1) touch(here, placeAt(floor, x + MEET_STEP, z));
      if (z + MEET_STEP < ROOM.z1) touch(here, placeAt(floor, x, z + MEET_STEP));
    }
  return meet;
}

const areas = new Map<Floor, ZoneArea[]>();

/**
 * A floor's zones as the map draws them, in drawing order, each the very area the location line names. The open
 * floor is shared out to the nearest name, the rooms behind glass lie over it, the first one looked up on top, and
 * the elevator, with the floor in front of its doors, lies over everything. Worked out once per floor.
 */
export function zoneAreas(floor: Floor): ZoneArea[] {
  const known = areas.get(floor);
  if (known) return known;
  const open = OPEN[floor];
  const shapes: { name: string; points: Point[] }[] = [
    ...open.map(([name, x, z], i) => ({
      name,
      points: open.reduce<Point[]>((outline, [, ox, oz], j) => (i === j ? outline : nearerTo(outline, [x, z], [ox, oz])), rectPoints([ROOM.x0, ROOM.z0, ROOM.x1, ROOM.z1])),
    })),
    ...[...ROOMS[floor]].reverse().map(([name, r]) => ({ name, points: rectPoints(r) })),
    ...[ELEVATOR_SPOT, ELEVATOR_APRON].map((r) => ({ name: "Elevator", points: rectPoints(r) })),
  ].filter((s) => s.points.length >= 3);
  // Each zone takes a tint none of the zones it meets has taken, the one used least so far, so all of them show.
  const meet = meetings(floor);
  const tones = new Map<string, number>();
  const used: number[] = Array(ZONE_TONES).fill(0);
  for (const { name } of shapes) {
    if (name === "Elevator" || tones.has(name)) continue;
    const taken = new Set([...(meet.get(name) ?? [])].map((n) => tones.get(n)));
    const free = used.map((_, t) => t).filter((t) => !taken.has(t));
    const tone = free.length ? free.reduce((best, t) => (used[t] < used[best] ? t : best)) : tones.size % ZONE_TONES;
    tones.set(name, tone);
    used[tone]++;
  }
  const drawn = shapes.map((s) => ({ ...s, tone: tones.get(s.name) ?? null }));
  areas.set(floor, drawn);
  return drawn;
}

/** The map's line saying where the avatar is, such as "Lounge, office floor", or that it is riding between them. */
export function whereLine(floor: Floor, x: number, z: number, ridingTo: Floor | null = null, shown: Floor | null = null): string {
  if (ridingTo) return `In the elevator, going ${ridingTo === "office" ? "up" : "down"} to the ${FLOOR_NAME[ridingTo].toLowerCase()}`;
  const place = placeAt(floor, x, z);
  return floor === shown ? place : `${place}, ${FLOOR_NAME[floor].toLowerCase()}`;
}
