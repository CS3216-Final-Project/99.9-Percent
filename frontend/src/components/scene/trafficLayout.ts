import { AISLE_Z, POS, ROOM, appSlot, dbSlot } from "./layout";
import type { TrafficEdge, TrafficNode } from "./traffic";

export type P2 = [number, number];

/** Where requests enter the server hall, on its west wall, and where served ones leave, by its east door. */
export const IN_GATE = { x: -12.75, z: AISLE_Z };
export const OUT_GATE = { x: 8.55, z: 0.4 };
/** Lanes on the floor: finished work heads back along the aisle, down the trunk, and served requests run to Out. */
const RETURN_Z = AISLE_Z + 0.42;
const TRUNK_X = -8.3;
const DATA_Z = 4.65;
const SERVED_Z = 4.15;
const OUT_LANE_X = OUT_GATE.x - 0.35;

/** One user per this many requests a second becomes a dot on a cable. */
export const REQUESTS_PER_DOT = 15;
export const MAX_DOTS = 64;
export const dots = (rate: number) => rate > 0 ? Math.min(MAX_DOTS, Math.ceil(rate / REQUESTS_PER_DOT)) : 0;

/** Packets slow as latency rises, so a congested floor looks congested. Metres per second. */
export const packetSpeed = (latencyMs: number) => 2.6 / (1 + Math.max(0, latencyMs - 100) / 400);

export interface FloorLayout {
  /** App ids in slot order: app `apps[i]` stands at `appSlot(i)`. */
  apps: string[];
  dbCabinets: number;
}

const dbFirst = () => dbSlot(0);
const dbLast = (l: FloorLayout) => dbSlot(Math.max(1, l.dbCabinets) - 1);

/** The floor point a machine's drops and queue gather at: in front of it, on the aisle side. */
export function nodePoint(node: TrafficNode, l: FloorLayout): P2 | null {
  if (node === "in") return [IN_GATE.x + 0.45, IN_GATE.z];
  if (node === "gateway") return [POS.gateway.x, AISLE_Z];
  if (node === "out") return [OUT_GATE.x - 0.45, OUT_GATE.z];
  // The data tier is seen from its south-east, so its piles sit beside it rather than behind.
  if (node === "cache") return [POS.cache.x + 1.05, POS.cache.z];
  if (node === "db") return [dbLast(l).x + 1.2, dbLast(l).z];
  const i = l.apps.indexOf(node);
  if (i < 0) return null;
  const p = appSlot(i), front = Math.sign(AISLE_Z - p.z) || 1;
  return [p.x, p.z + front * 0.78];
}

/** The polyline an edge's packets follow, in floor coordinates. Null for an edge with nowhere to go. */
export function edgePath(e: Pick<TrafficEdge, "from" | "to">, l: FloorLayout): P2[] | null {
  const { from, to } = e;
  if (from === "in" && to === "gateway") return [[IN_GATE.x, AISLE_Z], [POS.gateway.x, AISLE_Z]];
  if (from === "gateway") {
    const i = l.apps.indexOf(to);
    if (i < 0) return null;
    const p = appSlot(i);
    return [[POS.gateway.x, AISLE_Z], [p.x, AISLE_Z], [p.x, p.z]];
  }
  if (to === "db" || to === "cache") {
    const i = l.apps.indexOf(from);
    if (i < 0) return null;
    const p = appSlot(i);
    const head: P2[] = [[p.x, p.z], [p.x, RETURN_Z], [TRUNK_X, RETURN_Z]];
    return to === "db"
      ? [...head, [TRUNK_X, DATA_Z], [dbLast(l).x + 0.4, DATA_Z]]
      : [...head, [TRUNK_X, POS.cache.z], [POS.cache.x - 0.5, POS.cache.z]];
  }
  if (from === "db" && to === "out") return [[dbFirst().x, dbFirst().z + 0.6], [dbFirst().x, SERVED_Z], [OUT_LANE_X, SERVED_Z], [OUT_LANE_X, OUT_GATE.z]];
  if (from === "cache" && to === "out") return [[POS.cache.x, POS.cache.z + 0.55], [POS.cache.x, SERVED_Z], [OUT_LANE_X, SERVED_Z], [OUT_LANE_X, OUT_GATE.z]];
  return null;
}

/** The plain cable from the city to the In gate, which carries no dots of its own. */
export const INTERNET_RUN: P2[] = [[ROOM.x0 + 0.2, AISLE_Z], [IN_GATE.x, AISLE_Z]];

export function pathLength(points: P2[]): number {
  let n = 0;
  for (let i = 1; i < points.length; i++) n += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return n;
}

/** The point `d` metres along a polyline, clamped to its ends. */
export function pointAt(points: P2[], d: number): P2 {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d <= len || i === points.length - 1) {
      const f = len ? Math.min(1, Math.max(0, d / len)) : 0;
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    }
    d -= len;
  }
  return points[0];
}
