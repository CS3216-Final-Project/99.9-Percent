import { FLOOR_NAME, type Floor } from "@/game/floors";
import { CLOSED_ROOMS, ELEVATOR_SPOT, SERVER_ROOMS, SERVER_ZONE_NAMES, ZONE_NAMES } from "./floorplan";
import { atElevator } from "./player";

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

/** The map's line saying where the avatar is, such as "Lounge, office floor", or that it is riding between them. */
export function whereLine(floor: Floor, x: number, z: number, ridingTo: Floor | null = null): string {
  if (ridingTo) return `In the elevator, going ${ridingTo === "office" ? "up" : "down"} to the ${FLOOR_NAME[ridingTo].toLowerCase()}`;
  return `${placeAt(floor, x, z)}, ${FLOOR_NAME[floor].toLowerCase()}`;
}
