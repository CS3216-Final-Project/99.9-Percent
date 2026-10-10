import { deskSlot, POS } from "./layout";
import { RALLY, TABLE } from "./rally";

/*
 * The parts of the office floor plan that more than the drawing needs: the
 * glass partitions, where the crew stand or sit, and what a walker must keep
 * clear of. Kept free of React and three.js so the routes can be tested.
 */

/** Glass partition runs as [x1, z1, x2, z2]. Gaps for doors are already left out. */
export const GLASS: [number, number, number, number][] = [
  // Server floor
  [-13, 5, -2.0, 5],
  [-0.8, 5, 9, 5],
  [9, -4.6, 9, -0.2],
  [9, 1.0, 9, 5],
  [-13, -9.5, -13, -0.6],
  [-13, 0.6, -13, 5],
  // Monitoring room
  [5.5, -9.5, 5.5, -4.6],
  [5.5, -4.6, 9.6, -4.6],
  [10.6, -4.6, 11.5, -4.6],
  [11.5, -9.5, 11.5, -4.6],
  // Network and power room
  [-22, -1, -15.2, -1],
  [-14.0, -1, -13, -1],
  // Meeting room
  [-13, 10.2, -6.8, 10.2],
  [-5.9, 10.2, -5.5, 10.2],
  [-5.5, 10.2, -5.5, 14.5],
  [-13, 10.2, -13, 14.5],
];

export const GLASS_H = 2.6;

/** The rooms behind glass, as [x0, z0, x1, z1]. Nobody wanders into them. */
export const CLOSED_ROOMS: [number, number, number, number][] = [
  [-13, -9.5, 9, 5],
  [5.5, -9.5, 11.5, -4.6],
  [-22, -9.5, -13, -1],
  [-13, 10.2, -5.5, 14.5],
];

/** The arcade cabinets, side by side in the games corner. */
export const ARCADES: [string, number][] = [
  ["purple", 20.4],
  ["red", 21.3],
];
export const ARCADE_Z = 10.5;

/** Where pieces of furniture that people walk round stand. */
export const FIXTURES = {
  /** The office plants moved aside so the corridor past the whiteboard is clear. */
  plantByWhiteboard: { x: -12.45, z: 8.95 },
  plantByLibrary: { x: -14.0, z: 9.0 },
  kitchenBin: { x: 21.55, z: -5.5 },
};

/** A crew member who stays put, as [x, z] and the way they face. */
export interface Spot {
  x: number;
  z: number;
  rot: number;
}

/** Desk chairs sit this far behind their desk's centre. */
export const CHAIR_OFFSET = 0.72;

/** Where the engineer at desk i sits. */
export function deskSeat(i: number): Spot {
  const s = deskSlot(i);
  return { x: s.x + Math.sin(s.rot) * CHAIR_OFFSET, z: s.z + Math.cos(s.rot) * CHAIR_OFFSET, rot: s.rot };
}

/** Where the crew who are not at engineering desks are. */
export const SPOTS = {
  releaseEngineer: { x: POS.deploy.x, z: POS.deploy.z + 0.78, rot: 0 },
  marketer: { x: POS.growth.x - 0.4, z: POS.growth.z + 0.92, rot: 0 },
  onCall: { x: 8.2, z: -6.18, rot: 0 },
  receptionist: { x: 3.2, z: 11.3, rot: Math.PI },
  presenter: { x: -12.1, z: 12.0, rot: -Math.PI / 2 },
  founder: { x: -10.4, z: 11.42, rot: Math.PI },
  designerInMeeting: { x: -8.0, z: 13.28, rot: 0 },
  analystInMeeting: { x: -9.2, z: 13.28, rot: 0 },
  kitchenBreak: { x: 16.6, z: -5.7, rot: -2.4 },
  kitchenChat: { x: 17.5, z: -4.85, rot: 0.81 },
  sofa: { x: 19.9, z: 5.9, rot: Math.PI / 2 },
  sofaListener: { x: 19.9, z: 7.1, rot: Math.PI / 2 },
  phoneBooth: { x: -14.8, z: 13.7, rot: Math.PI },
  townhallReader: { x: -18.6, z: 3.6, rot: -Math.PI / 2 },
  pingPlayer: { x: RALLY.x - RALLY.stand, z: RALLY.z, rot: -Math.PI / 2 },
  pongPlayer: { x: RALLY.x + RALLY.stand, z: RALLY.z, rot: Math.PI / 2 },
} satisfies Record<string, Spot>;

/** Something on the floor to walk round: a box from x0, z0 to x1, z1, or a disc. */
export type Obstacle = { name: string; box: [number, number, number, number] } | { name: string; disc: [number, number, number] };

const box = (name: string, x: number, z: number, w: number, d: number): Obstacle => ({ name, box: [x - w / 2, z - d / 2, x + w / 2, z + d / 2] });
const disc = (name: string, x: number, z: number, r: number): Obstacle => ({ name, disc: [x, z, r] });

/** A potted plant's footprint at scale 1. */
const PLANT_R = 0.3;

/**
 * Furniture on the open floor, with the footprints of the models Office.tsx
 * draws (Kenney models are 1.93 m a unit, KayKit 0.62). The rooms behind
 * glass are left out: nobody walks there.
 */
export const OBSTACLES: Obstacle[] = [
  // Engineering pods: the desks and their chairs
  ...Array.from({ length: 8 }, (_, i) => {
    const s = deskSlot(i);
    const seat = deskSeat(i);
    return [box(`desk ${i}`, s.x, s.z, 1.5, 0.78), box(`desk chair ${i}`, seat.x, seat.z, 0.93, 0.85)];
  }).flat(),
  box("growth desk", POS.growth.x - 0.4, POS.growth.z + 0.2, 2.2, 0.78),
  box("growth chair", SPOTS.marketer.x, SPOTS.marketer.z - 0.2, 0.93, 0.85),
  box("growth board", POS.growth.x + 1.15, POS.growth.z - 0.55, 1.27, 0.1),
  box("release console", POS.deploy.x + 0.45, POS.deploy.z, 1.6, 0.8),
  box("whiteboard", -12.32, 7.4, 0.06, 2.1),
  disc("plant by the whiteboard", FIXTURES.plantByWhiteboard.x, FIXTURES.plantByWhiteboard.z, PLANT_R),
  disc("plant by the library", FIXTURES.plantByLibrary.x, FIXTURES.plantByLibrary.z, PLANT_R * 1.1),
  disc("coat rack by the pods", -3.0, 5.6, 0.26),
  box("bin by the pods", -3.0, 9.0, 0.77, 0.68),
  disc("plant by the release console", 2.2, 8.9, PLANT_R),
  disc("cactus by the growth desk", 8.9, 5.6, 0.41),

  // Reception and the waiting area
  box("reception desk", 3.2, 12.15, 3.3, 1.1),
  disc("reception coat rack", 5.6, 13.9, 0.26),
  disc("reception plant", 6.4, 13.9, PLANT_R),
  box("waiting armchairs", -2.2, 12.6, 2.95, 0.95),
  disc("waiting cactus", -4.4, 13.9, 0.44),

  // Townhall and library
  box("townhall steps", -19.5, 4.5, 4.8, 6.6),
  box("townhall screen", -14.3, 4.5, 0.4, 2.3),
  box("library shelves", -21.75, 11.65, 0.4, 4.0),
  box("library armchair", -19.6, 10.8, 0.94, 1.06),
  box("library armchair facing", -18.4, 12.6, 1.06, 0.94),
  disc("library side table", -19.1, 11.9, 0.4),
  disc("library lamp", -20.9, 13.7, 0.15),
  box("phone booths", -15.5, 13.6, 2.68, 1.28),

  // East corridor
  box("corridor shelf", 11.6, 5.45, 2.4, 0.4),
  box("corridor benches", 14.0, 1.6, 0.39, 1.6),
  disc("corridor plant, south", 13.9, -4.0, PLANT_R),
  disc("corridor plant, north", 13.9, 9.6, PLANT_R),
  disc("corridor cactus", 9.6, 4.4, 0.38),
  box("red vending machine", 12.6, -9.0, 0.9, 0.8),
  box("blue vending machine", 13.7, -9.0, 0.9, 0.8),

  // Kitchen
  box("fridge", 15.35, -9.1, 0.9, 0.8),
  box("counters", 18.99, -9.06, 6.02, 0.93),
  box("side cabinets", 21.565, -7.37, 0.93, 2.49),
  box("kitchen island", 18.4, -6.2, 2.88, 0.8),
  box("bar stools", 18.45, -5.35, 1.42, 0.44),
  box("water cooler", 15.0, -4.0, 0.45, 0.45),
  box("kitchen bin", FIXTURES.kitchenBin.x, FIXTURES.kitchenBin.z, 0.77, 0.68),

  // Dining
  box("dining table and chairs", 18.5, 0, 4.0, 2.14),
  disc("dining plant", 15.0, 2.6, PLANT_R),
  disc("dining cactus", 21.4, -2.6, 0.41),

  // Lounge
  box("lounge television", 15.3, 6.5, 0.48, 1.54),
  disc("lounge speaker, south", 15.3, 5.1, 0.15),
  disc("lounge speaker, north", 15.3, 7.9, 0.15),
  box("lounge coffee table", 18.0, 6.5, 0.69, 1.15),
  box("lounge sofa", 19.8, 6.5, 1.19, 2.23),
  box("lounge chair", 17.6, 8.8, 0.85, 1.16),
  disc("beanbag, south", 16.9, 4.4, 0.48),
  disc("beanbag, north", 16.6, 8.6, 0.48),
  disc("lounge lamp", 21.3, 4.1, 0.12),
  disc("lounge plant", 21.4, 9.3, PLANT_R),
  disc("games plant", 15.0, 13.9, PLANT_R),

  // Games corner
  box("ping-pong table", RALLY.x, RALLY.z, TABLE.length, TABLE.width),
  ...ARCADES.map(([variant, x]) => box(`${variant} arcade`, x, ARCADE_Z, 0.72, 0.75)),
];
