import { deskSlot, POS } from "./layout";
import { RALLY, TABLE } from "./rally";

/*
 * The parts of the floor plans that more than the drawing needs: the glass
 * partitions, where the crew stand or sit, and what a walker must keep clear
 * of. Kept free of React and three.js so the routes can be tested.
 *
 * The building has two floors on the same footprint (see game/floors.ts). The
 * office is on top; the lists without a floor in their name are its own. The
 * server floor below keeps the server hall, the network and power room and the
 * monitoring room where they always stood.
 */

/** The nap room, as [x0, z0, x1, z1]: between the engineering pods and the east corridor. */
export const NAP_ROOM: [number, number, number, number] = [8.9, 6.05, 12.5, 9.05];

/** The three nap pods' centres, head to the east wall, lying along x. */
export const NAP_PODS: [number, number][] = [
  [11.45, 6.6],
  [11.45, 7.55],
  [11.45, 8.5],
];

/** The foosball table's centre, its length along x, in the corner beside reception. */
export const FOOSBALL = { x: 10.3, z: 12.4 };

/** The low stage in the events space, in front of the townhall screen, as its centre and size. */
export const STAGE = { x: -15.45, z: 4.5, w: 1.7, d: 4.0, h: 0.18 };

/** On the office floor, the quiet room where the network and power room is below, as [x0, z0, x1, z1]. */
export const QUIET_ROOM: [number, number, number, number] = [-22, -9.5, -13, -1];
/** On the office floor, the small meeting room over the monitoring room, by the elevator. */
export const HUDDLE_ROOM: [number, number, number, number] = [5.5, -9.5, 11.5, -4.6];

/** The glass round the monitoring room below and the huddle room above it, the same on both floors. Its door faces the elevator. */
const CORNER_GLASS: [number, number, number, number][] = [
  [5.5, -9.5, 5.5, -4.6],
  [5.5, -4.6, 9.6, -4.6],
  [10.6, -4.6, 11.5, -4.6],
  [11.5, -9.5, 11.5, -4.6],
];

/** The server floor's glass: the server hall, the monitoring room and the network and power room. */
export const SERVER_GLASS: [number, number, number, number][] = [
  // Server hall
  [-13, 5, -2.0, 5],
  [-0.8, 5, 9, 5],
  [9, -4.6, 9, -0.2],
  [9, 1.0, 9, 5],
  [-13, -9.5, -13, -0.6],
  [-13, 0.6, -13, 5],
  ...CORNER_GLASS,
  // Network and power room
  [-22, -1, -15.2, -1],
  [-14.0, -1, -13, -1],
];

/** Glass partition runs on the office floor as [x1, z1, x2, z2]. Gaps for doors are already left out. */
export const GLASS: [number, number, number, number][] = [
  // Quiet desks, its door to the open floor
  [QUIET_ROOM[0], QUIET_ROOM[3], -15.2, QUIET_ROOM[3]],
  [-14.0, QUIET_ROOM[3], QUIET_ROOM[2], QUIET_ROOM[3]],
  [QUIET_ROOM[2], QUIET_ROOM[1], QUIET_ROOM[2], QUIET_ROOM[3]],
  // The huddle room
  ...CORNER_GLASS,
  // Meeting room
  [-13, 10.2, -6.8, 10.2],
  [-5.9, 10.2, -5.5, 10.2],
  [-5.5, 10.2, -5.5, 14.5],
  [-13, 10.2, -13, 14.5],
  // Nap room, its door on the west side
  [NAP_ROOM[0], NAP_ROOM[1], NAP_ROOM[2], NAP_ROOM[1]],
  [NAP_ROOM[2], NAP_ROOM[1], NAP_ROOM[2], NAP_ROOM[3]],
  [NAP_ROOM[0], NAP_ROOM[3], NAP_ROOM[2], NAP_ROOM[3]],
  [NAP_ROOM[0], NAP_ROOM[1], NAP_ROOM[0], 7.05],
  [NAP_ROOM[0], 8.05, NAP_ROOM[0], NAP_ROOM[3]],
];

export const GLASS_H = 2.6;

/** The office floor's rooms behind glass, as [x0, z0, x1, z1]. Nobody wanders into them. */
export const CLOSED_ROOMS: [number, number, number, number][] = [QUIET_ROOM, HUDDLE_ROOM, [-13, 10.2, -5.5, 14.5], NAP_ROOM];

/**
 * The elevator's shaft between the floors, as [x0, z0, x1, z1], in the east corridor beside the monitoring room's
 * door. Its doors face the corridor (+x). Nothing else may stand in it and no walk may cross it.
 */
export const ELEVATOR_SPOT: [number, number, number, number] = [9, -3.5, 11.5, -1];

/**
 * Each zone's name and where it floats, as [name, x, z], over the zone and clear of the equipment's own labels. The
 * rooms of machines are named by their equipment labels already.
 */
export const ZONE_NAMES: [string, number, number][] = [
  ["Events", -17.5, 4.3],
  ["Library", -17.5, 12.0],
  ["Meeting room", -9.25, 12.35],
  ["Engineering", -3.6, 9.6],
  ["Open desks", -2.7, -4.4],
  ["Quiet desks", (QUIET_ROOM[0] + QUIET_ROOM[2]) / 2, -5.6],
  ["Huddle room", (HUDDLE_ROOM[0] + HUDDLE_ROOM[2]) / 2, -6.6],
  ["Reception", 3.2, 13.4],
  ["Foosball", FOOSBALL.x, FOOSBALL.z + 1.3],
  ["Nap pods", (NAP_ROOM[0] + NAP_ROOM[2]) / 2, (NAP_ROOM[1] + NAP_ROOM[3]) / 2],
  ["Kitchen", 18.25, -6.0],
  ["Dining", 18.25, 0],
  ["Lounge", 18.25, 6.2],
  ["Games room", 18.25, 11.9],
];

/** The server floor's zones that have no equipment of their own to name them. */
export const SERVER_ZONE_NAMES: [string, number, number][] = [
  ["Cooling plant", -17.5, 7.0],
  ["Workshop", -2.0, 9.9],
  ["Stores", 17.6, 3.0],
];

/** How high the zone names float: above the glass, below the walls' tops. */
export const ZONE_NAME_HEIGHT = 2.95;

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

/** Where whoever works at a desk sits. */
export function seatAt(s: Spot): Spot {
  return { x: s.x + Math.sin(s.rot) * CHAIR_OFFSET, z: s.z + Math.cos(s.rot) * CHAIR_OFFSET, rot: s.rot };
}

/** Where the engineer at desk i sits. */
export function deskSeat(i: number): Spot {
  return seatAt(deskSlot(i));
}

/** The pods of four desks on the open floor, where the server room used to be, as their centres. */
export const OPEN_PODS: [number, number][] = [
  [-9.6, -7.0],
  [-5.0, -7.0],
  [-0.4, -7.0],
  [-9.6, -1.8],
  [-5.0, -1.8],
];
export const OPEN_DESKS = OPEN_PODS.length * 4;

/** Open desk i, laid out like the engineers' pods: two desks facing two, monitors back to back. */
export function openDeskSlot(i: number): Spot {
  const [x, z] = OPEN_PODS[Math.floor(i / 4)];
  const k = i % 4;
  const back = k >= 2;
  return { x: x + (k % 2 === 0 ? -0.8 : 0.8), z: z + (back ? -0.42 : 0.42), rot: back ? Math.PI : 0 };
}

/** The quiet room's desks, in a row against the back wall, facing it. */
export const QUIET_DESKS: Spot[] = [-20.6, -18.6, -16.6, -14.6].map((x) => ({ x, z: -8.75, rot: 0 }));

/** The breakout corner on the open floor: a sofa facing two armchairs round a coffee table, and a standing table. */
export const BREAKOUT = { x: 5.4, z: 0.6 };
export const STANDING_TABLE = { x: -0.4, z: -1.8, w: 2.4, d: 0.9 };
/** The long shared table on the open floor, with chairs along both sides. */
export const SHARED_TABLE = { x: -6.0, z: 2.5, w: 6.0, d: 1.1, chairs: [-8.25, -6.75, -5.25, -3.75] };

/**
 * The meeting room's chairs either side of its table, as the z of each row. They stand far enough back that a
 * creature leaning forward to clear the backrest still keeps clear of the table.
 */
export const MEETING_CHAIRS = { near: 11.15, far: 13.55, xs: [-10.4, -9.2, -8.0] };

/** Where the crew who are not at engineering desks are. */
export const SPOTS = {
  releaseEngineer: { x: POS.deploy.x, z: POS.deploy.z + 0.78, rot: 0 },
  marketer: { x: POS.growth.x - 0.4, z: POS.growth.z + 0.92, rot: 0 },
  /** On the server floor, at the monitoring desk. */
  onCall: { x: 8.2, z: -6.18, rot: 0 },
  /** On the open floor: two at the desks, one at the standing table and one in the breakout corner. */
  openDeskA: seatAt(openDeskSlot(1)),
  openDeskB: seatAt(openDeskSlot(14)),
  standing: { x: STANDING_TABLE.x + 0.6, z: STANDING_TABLE.z + 0.85, rot: 0 },
  breakout: { x: BREAKOUT.x - 0.45, z: BREAKOUT.z + 1.65, rot: 0 },
  quietDesk: seatAt(QUIET_DESKS[1]),
  huddleCall: { x: 7.9, z: -6.45, rot: 0 },
  receptionist: { x: 3.2, z: 11.3, rot: Math.PI },
  presenter: { x: -12.1, z: 12.0, rot: -Math.PI / 2 },
  founder: { x: -10.4, z: MEETING_CHAIRS.near, rot: Math.PI },
  designerInMeeting: { x: -8.0, z: MEETING_CHAIRS.far, rot: 0 },
  analystInMeeting: { x: -9.2, z: MEETING_CHAIRS.far, rot: 0 },
  kitchenBreak: { x: 16.25, z: -5.35, rot: -2.4 },
  kitchenChat: { x: 17.5, z: -4.85, rot: 0.81 },
  // On the sofa's cushions, in front of its backrest.
  sofa: { x: 19.7, z: 5.9, rot: Math.PI / 2 },
  sofaListener: { x: 19.7, z: 7.1, rot: Math.PI / 2 },
  /** Where an engineer too big for the sofa stands instead, between the television and the coffee table, facing the sofa. */
  loungeStand: { x: 16.9, z: 6.5, rot: -Math.PI / 2 },
  phoneBooth: { x: -14.8, z: 13.7, rot: Math.PI },
  townhallReader: { x: -18.6, z: 3.6, rot: -Math.PI / 2 },
  /** The two foosball players, either side of the table's length. */
  foosballSouth: { x: FOOSBALL.x, z: FOOSBALL.z - 0.85, rot: Math.PI },
  foosballNorth: { x: FOOSBALL.x, z: FOOSBALL.z + 0.85, rot: 0 },
  /** Dozing at the open end of the middle pod, out from under its hood, facing the room. */
  napper: { x: NAP_PODS[1][0] - 0.45, z: NAP_PODS[1][1], rot: Math.PI / 2 },
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
  box("foosball table and handles", FOOSBALL.x, FOOSBALL.z, 1.3, 1.25),

  // The open floor: pods of desks, the standing table, the shared table and the breakout corner
  ...Array.from({ length: OPEN_DESKS }, (_, i) => {
    const s = openDeskSlot(i);
    const seat = seatAt(s);
    return [box(`open desk ${i}`, s.x, s.z, 1.5, 0.78), box(`open desk chair ${i}`, seat.x, seat.z, 0.93, 0.85)];
  }).flat(),
  box("standing table and stools", STANDING_TABLE.x, STANDING_TABLE.z, STANDING_TABLE.w + 0.2, STANDING_TABLE.d + 1.6),
  box("shared table and chairs", SHARED_TABLE.x, SHARED_TABLE.z, SHARED_TABLE.w, SHARED_TABLE.d + 1.7),
  box("breakout sofa", BREAKOUT.x, BREAKOUT.z + 1.75, 2.4, 1.0),
  box("breakout coffee table", BREAKOUT.x, BREAKOUT.z, 1.2, 0.7),
  box("breakout armchairs", BREAKOUT.x, BREAKOUT.z - 1.3, 2.4, 0.95),
  box("lockers", 3.6, -9.2, 3.2, 0.55),
  disc("plant by the lockers", 1.6, -9.05, PLANT_R),
  disc("plant by the breakout", 8.3, -0.6, PLANT_R * 1.2),

  // Townhall and library
  box("townhall steps", -19.5, 4.5, 4.8, 6.6),
  box("townhall screen", -14.3, 4.5, 0.4, 2.3),
  box("events stage", STAGE.x, STAGE.z, STAGE.w, STAGE.d),
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
