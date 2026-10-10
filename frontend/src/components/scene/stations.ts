import { BALANCE, type EquipmentId, type GameState } from "@/sim";
import { throughGlass } from "./floorplan";
import { appSlot, dbSlot, footprint, POS } from "./layout";

/*
 * Where the founder can work each machine from, and where it walks to when
 * sent there. Every machine has a square zone: its footprint with a margin all
 * round, so the founder can work it from any side, though never through glass.
 * A click sends the founder to the machine's spot, a known open place in its
 * zone, and it stops as soon as it is inside. The racks stand in rows on the
 * server floor, so their spots are in the aisle beside the row; the rows grow
 * as the company does, so the spots and zones move with them. Kept free of
 * React and three.js so nav.test.ts can check every spot is open and reachable.
 */

type Point = { x: number; z: number };

export interface Station {
  x: number;
  z: number;
}

/** How far past a machine's footprint, on every side, the founder can work it from, in metres. */
export const ZONE_MARGIN = 0.9;

/** A machine's zone, from (x0, z0) to (x1, z1). */
export function zone(s: GameState, id: EquipmentId): { x0: number; z0: number; x1: number; z1: number } {
  const f = footprint(s, id);
  return { x0: f.x - f.w / 2 - ZONE_MARGIN, z0: f.z - f.d / 2 - ZONE_MARGIN, x1: f.x + f.w / 2 + ZONE_MARGIN, z1: f.z + f.d / 2 + ZONE_MARGIN };
}

/** The point of a machine's footprint nearest to p: what the founder works at, and turns to face. */
export function workPoint(s: GameState, id: EquipmentId, p: Point): Point {
  const f = footprint(s, id);
  const x = Math.max(f.x - f.w / 2, Math.min(f.x + f.w / 2, p.x));
  const z = Math.max(f.z - f.d / 2, Math.min(f.z + f.d / 2, p.z));
  // Standing on the footprint itself, face its middle.
  return x === p.x && z === p.z ? { x: f.x, z: f.z } : { x, z };
}

/**
 * How far the founder at p is from a machine, when it can work the machine from there: inside the machine's zone
 * with no glass in between. Null when it cannot.
 */
export function workDistance(s: GameState, id: EquipmentId, p: Point): number | null {
  const z = zone(s, id);
  if (p.x < z.x0 || p.x > z.x1 || p.z < z.z0 || p.z > z.z1) return null;
  const at = workPoint(s, id, p);
  if (throughGlass(p.x, p.z, at.x, at.z)) return null;
  const f = footprint(s, id);
  return Math.max(0, Math.abs(p.x - f.x) - f.w / 2, Math.abs(p.z - f.z) - f.d / 2);
}

export function canWork(s: GameState, id: EquipmentId, p: Point): boolean {
  return workDistance(s, id, p) !== null;
}

/** Of the given machines, the one the founder at p can work, preferring the nearest where zones overlap. */
export function machineAt(s: GameState, ids: EquipmentId[], p: Point): EquipmentId | null {
  let best: EquipmentId | null = null;
  let bestScore = Infinity;
  for (const id of ids) {
    const d = workDistance(s, id, p);
    if (d === null) continue;
    // Ties (standing on two footprints, as in a row of racks) go to the nearer middle.
    const f = footprint(s, id);
    const score = d + 1e-3 * Math.hypot(p.x - f.x, p.z - f.z);
    if (score < bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}

/** The aisle between the two rows of app servers. */
const APP_AISLE_Z = -4.95;
/** The strip of floor between the database row and the glass in front of it. */
const DATA_FRONT_Z = 4.3;

/** Where the founder first appears: the front corridor, by the release console. */
export const SPAWN = { x: 2.0, z: 9.75 };

export function station(s: GameState, id: EquipmentId): Station {
  switch (id) {
    case "gateway":
      return { x: POS.gateway.x + 0.6, z: APP_AISLE_Z };
    case "app": {
      const n = Math.max(1, Math.min(s.infra.appHosts.length, BALANCE.server.maxWithLb, 6));
      const x = (appSlot(0).x + appSlot(n - 1).x) / 2;
      return { x, z: APP_AISLE_Z };
    }
    case "standby":
      return { x: POS.standby.x, z: APP_AISLE_Z };
    case "cache":
      return { x: POS.cache.x, z: DATA_FRONT_Z };
    case "db": {
      const n = s.infra.dbTier + 1;
      const x = (dbSlot(0).x + dbSlot(n - 1).x) / 2;
      return { x, z: DATA_FRONT_Z };
    }
    case "replica":
      return { x: POS.replica.x, z: DATA_FRONT_Z };
    case "backup":
      return { x: POS.backup.x, z: DATA_FRONT_Z };
    case "monitoring":
      // Beside the on-call desk, looking up at the wall of screens.
      return { x: 10.3, z: -6.6 };
    case "deploy":
      return { x: POS.deploy.x - 1.0, z: 8.6 };
    case "growth":
      // In front of the results board, clear of the marketer's chair.
      return { x: POS.growth.x + 1.2, z: 8.5 };
    case "team":
      // Between the two pods of engineering desks.
      return { x: -7.3, z: 8.0 };
  }
}
