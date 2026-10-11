import { pick, randRange, type RngHolder } from "@/sim/rng";
import type { Activity } from "./cast";
import { SPOTS } from "./floorplan";

/*
 * Wandering routes for the office crew. Waypoints sit along the corridors and
 * beside things worth stopping at: the vending machines, the coffee machine,
 * the water cooler, a colleague's desk, the whiteboard, the window. A walker's
 * day is a seeded random walk over them that ends where it began, so it loops
 * for ever without a seam, and a remount, or StrictMode's double mount, picks
 * up at the same place for the same clock.
 *
 * Nothing here touches React or three.js; floorplan.ts holds what the routes
 * keep clear of and routes.test.ts checks they do.
 */

/** A pause at a waypoint: what the walker does there, for how long, and what it turns to face. */
export interface Stop {
  activity: Activity;
  seconds: [number, number];
  face: [number, number];
}

export interface Waypoint {
  x: number;
  z: number;
  stop?: Stop;
}

const at = (x: number, z: number, stop?: Stop): Waypoint => ({ x, z, stop });

export const WAYPOINTS = {
  // The east corridor, from the vending machines to the games corner
  spineVending: at(13.2, -6.9),
  spineCooler: at(13.2, -2.4),
  spineLounge: at(13.2, 3.35),
  spineFront: at(13.2, 9.75),
  spineGames: at(13.2, 10.6),
  vending: at(13.15, -7.9, { activity: "idle", seconds: [3, 6], face: [13.15, -9.0] }),

  // The kitchen aisle between the counters and the island
  kitchenWest: at(15.6, -7.4),
  kitchenMid: at(17.23, -7.4),
  kitchenEast: at(20.0, -7.4),
  espresso: at(17.23, -7.95, { activity: "mug", seconds: [4, 8], face: [17.23, -9.15] }),
  microwave: at(20.55, -7.95, { activity: "idle", seconds: [4, 7], face: [20.55, -9.15] }),

  // The water cooler, the dining table and the east window
  coolerLane: at(15.75, -2.4),
  cooler: at(15.75, -3.6, { activity: "mug", seconds: [4, 8], face: [15.0, -4.0] }),
  diningLane: at(19.2, -2.4),
  pizza: at(19.2, -1.55, { activity: "mug", seconds: [5, 9], face: [19.4, 0.15] }),
  eastLow: at(20.6, -2.0),
  eastLane: at(21.25, -1.3),
  window: at(21.25, 2.0, { activity: "idle", seconds: [4, 8], face: [22, 2.0] }),

  // The lounge and the games corner
  loungeLane: at(17.9, 3.35),
  lounge: at(17.65, 5.25, { activity: "chat", seconds: [5, 9], face: [SPOTS.sofa.x, SPOTS.sofa.z] }),
  gamesLane: at(18.6, 10.6),
  spectate: at(18.6, 11.1, { activity: "listen", seconds: [5, 10], face: [18.2, 12.6] }),

  // The front corridor, past reception and the engineering pods to the library
  frontReception: at(5.6, 9.75),
  receptionSide: at(5.6, 13.15),
  reception: at(3.2, 13.3, { activity: "chat", seconds: [4, 8], face: [SPOTS.receptionist.x, SPOTS.receptionist.z] }),
  frontDeploy: at(-0.5, 9.75),
  deploy: at(-0.6, 8.75, { activity: "chat", seconds: [4, 8], face: [SPOTS.releaseEngineer.x, SPOTS.releaseEngineer.z] }),
  frontGap: at(-7.3, 9.75),
  deskVisit: at(-7.3, 8.0, { activity: "chat", seconds: [5, 9], face: [-8.8, 8.54] }),
  frontWhiteboard: at(-11.7, 9.75),
  whiteboard: at(-11.75, 7.6, { activity: "present", seconds: [5, 9], face: [-12.32, 7.6] }),
  libraryLane: at(-20.95, 9.75),
  library: at(-20.95, 11.65, { activity: "idle", seconds: [5, 10], face: [-21.75, 11.65] }),
} satisfies Record<string, Waypoint>;

export type WaypointId = keyof typeof WAYPOINTS;

/** Straight walks between waypoints; each goes both ways. */
export const PATHS: [WaypointId, WaypointId][] = [
  ["spineVending", "spineCooler"],
  ["spineCooler", "spineLounge"],
  ["spineLounge", "spineFront"],
  ["spineFront", "spineGames"],
  ["spineVending", "vending"],
  ["spineVending", "kitchenWest"],
  ["kitchenWest", "kitchenMid"],
  ["kitchenMid", "kitchenEast"],
  ["kitchenMid", "espresso"],
  ["kitchenEast", "microwave"],
  ["spineCooler", "coolerLane"],
  ["coolerLane", "cooler"],
  ["coolerLane", "diningLane"],
  ["diningLane", "pizza"],
  ["diningLane", "eastLow"],
  ["eastLow", "eastLane"],
  ["eastLane", "window"],
  ["spineLounge", "loungeLane"],
  ["loungeLane", "lounge"],
  ["spineGames", "gamesLane"],
  ["gamesLane", "spectate"],
  ["spineFront", "frontReception"],
  ["frontReception", "receptionSide"],
  ["receptionSide", "reception"],
  ["frontReception", "frontDeploy"],
  ["frontDeploy", "deploy"],
  ["frontDeploy", "frontGap"],
  ["frontGap", "deskVisit"],
  ["frontGap", "frontWhiteboard"],
  ["frontWhiteboard", "whiteboard"],
  ["frontWhiteboard", "libraryLane"],
  ["libraryLane", "library"],
];

const NEIGHBOURS = new Map<WaypointId, WaypointId[]>();
for (const [a, b] of PATHS) {
  NEIGHBOURS.set(a, [...(NEIGHBOURS.get(a) ?? []), b]);
  NEIGHBOURS.set(b, [...(NEIGHBOURS.get(b) ?? []), a]);
}

export function neighbours(id: WaypointId): WaypointId[] {
  return NEIGHBOURS.get(id) ?? [];
}

/** The fewest walks from one waypoint to another. */
function shortestPath(from: WaypointId, to: WaypointId): WaypointId[] {
  const previous = new Map<WaypointId, WaypointId | null>([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const id = queue.shift() as WaypointId;
    if (id === to) break;
    for (const n of neighbours(id)) {
      if (previous.has(n)) continue;
      previous.set(n, id);
      queue.push(n);
    }
  }
  if (!previous.has(to)) throw new Error(`No path from ${from} to ${to}`);
  const path: WaypointId[] = [];
  for (let id: WaypointId | null = to; id; id = previous.get(id) ?? null) path.unshift(id);
  return path;
}

/** Radians a walker turns each second. */
export const TURN_RATE = Math.PI / 0.8;

/** The way a creature faces to look along (dx, dz); creatures face -z at 0. */
export function heading(dx: number, dz: number): number {
  return Math.atan2(-dx, -dz);
}

/** An angle brought into [-pi, pi], so turns take the short way round. */
export function wrapAngle(a: number): number {
  return a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
}

export interface Step {
  kind: "walk" | "turn" | "stop";
  /** Seconds into the loop at which the step begins, and how long it lasts. */
  start: number;
  seconds: number;
  from: [number, number];
  to: [number, number];
  /** Facing at the start and end of the step. */
  yaw: [number, number];
  activity: Activity;
  /** The waypoint the step ends at. */
  waypoint: WaypointId;
}

export interface Plan {
  steps: Step[];
  /** Seconds before the loop repeats. */
  total: number;
  /** Walking speed in metres a second. */
  speed: number;
  /** Waypoints in the order visited, starting and ending at the same one. */
  route: WaypointId[];
}

export interface PlanOptions {
  /** How many walks to take at random before heading home. */
  legs: number;
  /** Metres a second. */
  speed: number;
}

/**
 * A walker's loop: a seeded random walk over the waypoints, never doubling back
 * unless at a dead end, then the shortest way home. Every waypoint with a stop
 * is a pause on arrival.
 */
export function planLoop(start: WaypointId, seed: number, { legs, speed }: PlanOptions): Plan {
  if (!(start in WAYPOINTS)) throw new Error(`Unknown waypoint ${start}`);
  const rng: RngHolder = { rngState: seed | 0 };
  const route: WaypointId[] = [start];
  let previous: WaypointId | null = null;
  for (let i = 0; i < legs; i++) {
    const here = route[route.length - 1];
    const onward = neighbours(here).filter((n) => n !== previous);
    const next = pick(rng, onward.length ? onward : neighbours(here));
    previous = here;
    route.push(next);
  }
  route.push(...shortestPath(route[route.length - 1], start).slice(1));
  if (route.length < 2) throw new Error(`${start} leads nowhere`);

  const steps: Step[] = [];
  let t = 0;
  const first = WAYPOINTS[route[1]];
  const origin = WAYPOINTS[start];
  const startYaw = heading(first.x - origin.x, first.z - origin.z);
  let yaw = startYaw;
  const push = (kind: Step["kind"], seconds: number, from: Waypoint, to: Waypoint, endYaw: number, activity: Activity, waypoint: WaypointId) => {
    steps.push({ kind, start: t, seconds, from: [from.x, from.z], to: [to.x, to.z], yaw: [yaw, endYaw], activity, waypoint });
    t += seconds;
    yaw = endYaw;
  };
  const turnTo = (p: Waypoint, target: number, id: WaypointId) => {
    const delta = wrapAngle(target - yaw);
    if (Math.abs(delta) > 1e-3) push("turn", Math.abs(delta) / TURN_RATE, p, p, yaw + delta, "walk", id);
  };

  for (let i = 1; i < route.length; i++) {
    const a = WAYPOINTS[route[i - 1]];
    const b: Waypoint = WAYPOINTS[route[i]];
    turnTo(a, heading(b.x - a.x, b.z - a.z), route[i - 1]);
    push("walk", Math.hypot(b.x - a.x, b.z - a.z) / speed, a, b, yaw, "walk", route[i]);
    if (b.stop) {
      turnTo(b, heading(b.stop.face[0] - b.x, b.stop.face[1] - b.z), route[i]);
      push("stop", randRange(rng, ...b.stop.seconds), b, b, yaw, b.stop.activity, route[i]);
    }
  }
  // Face the way the loop sets off, so the end runs straight into the start.
  turnTo(origin, startYaw, start);
  return { steps, total: t, speed, route };
}

const smooth = (f: number) => f * f * (3 - 2 * f);

export interface Pose {
  x: number;
  z: number;
  yaw: number;
  /** Which step of the plan this is. */
  index: number;
  activity: Activity;
}

/** Where a walker following the plan is at time t seconds; the plan repeats. */
export function poseAt(plan: Plan, t: number): Pose {
  const time = ((t % plan.total) + plan.total) % plan.total;
  let lo = 0;
  let hi = plan.steps.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (plan.steps[mid].start <= time) lo = mid;
    else hi = mid - 1;
  }
  const s = plan.steps[lo];
  const f = s.seconds > 0 ? Math.min(1, (time - s.start) / s.seconds) : 1;
  const e = s.kind === "turn" ? smooth(f) : f;
  return {
    x: s.from[0] + (s.to[0] - s.from[0]) * f,
    z: s.from[1] + (s.to[1] - s.from[1]) * f,
    yaw: s.yaw[0] + (s.yaw[1] - s.yaw[0]) * e,
    index: lo,
    activity: s.activity,
  };
}
