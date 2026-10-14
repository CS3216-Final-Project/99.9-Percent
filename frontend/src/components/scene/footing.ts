import type { Floor } from "@/game/floors";
import { HUDDLE_ROOM, NAP_ROOM, QUIET_ROOM } from "./floorplan";

/*
 * What is underfoot where the avatar walks, for the sound of its steps: carpet muffles them, tile, stone and concrete
 * click, and the server hall's raised floor sounds hollow. Kept free of React and audio so it can be tested.
 */

export type Footing = "soft" | "hard" | "hollow";

type Patch = [Footing, number, number, number, number];

/** Each floor's surfaces as [footing, x0, z0, x1, z1], the first that holds a place winning; elsewhere is hard. */
const PATCHES: Record<Floor, Patch[]> = {
  office: [
    // Carpet in the rooms, the open floor, engineering, the events space, the library, the lounge and the games.
    ["soft", ...QUIET_ROOM],
    ["soft", ...HUDDLE_ROOM],
    ["soft", ...NAP_ROOM],
    ["soft", -13, -9.5, 9, 10.2],
    ["soft", -13, 10.2, -5.5, 14.5],
    ["soft", -22, -1, -13, 14.5],
    ["soft", 8, 10.2, 12.6, 14.5],
    ["soft", 14.5, 3, 22, 14.5],
  ],
  servers: [
    // The monitoring room's carpet, then the hall's raised floor.
    ["soft", 5.5, -9.5, 11.5, -4.6],
    ["hollow", -13, -9.5, 9, 5],
  ],
};

export function footingAt(floor: Floor, x: number, z: number): Footing {
  for (const [kind, x0, z0, x1, z1] of PATCHES[floor]) if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return kind;
  return "hard";
}

/** Metres between footsteps: a walk's stride and a run's. */
export const STRIDE = { walk: 0.55, run: 0.95 };
