import type { Floor } from "@/game/floors";
import { STOREY } from "./city";

/*
 * Where the building's two floors stand and how the elevator rides between them (game/floors.ts says which floor
 * each piece of equipment is on). The office is y = 0 and the servers stand one storey below, on the same spots.
 * Switching floors rides the elevator as a short cutscene: the view glides in to the car as it sets off, glides
 * down or up with it, the view dips and goes dark for a moment as the car passes the slab between the floors,
 * the doors open on arrival in a wash of light and the view eases back out to where the player had it.
 *
 * Kept free of React, three.js and the browser so the timing can be tested.
 */

/** Height of each floor's surface. */
export const FLOOR_Y: Record<Floor, number> = { office: 0, servers: -STOREY };

/** The number on the elevator's indicator: the office has six storeys of its building below it. */
export const FLOOR_NUMBER: Record<Floor, number> = { office: 7, servers: 6 };

/** Seconds from pressing a floor to arriving there. A second press, any click or a key hurries the rest along. */
export const RIDE_SECONDS = 5;
/** Seconds the doors take to open or close, and how long they stand open after the car arrives. */
export const DOORS = { move: 0.4, hold: 2.4 };
/** Seconds the rest of a ride takes at most once the player hurries it along with a click or a key. */
export const HURRY_SECONDS = 0.7;
/**
 * How dark the view goes as the car passes between the floors, and over what share of the ride either side of
 * halfway: `slab` is the share over which the floor slab between the storeys blacks the view out.
 */
export const DIP = { most: 0.76, half: 0.42, slab: 0.1 };

const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

const smoother = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * c * (c * (c * 6 - 15) + 10);
};

export interface RideFrame {
  /** How far the car has travelled from the floor it left, 0 to 1. It eases into motion and out of it. */
  car: number;
  /** How dark the view is: deepest halfway, where the floors change places, so neither is seen to vanish. */
  dip: number;
  /** How much the floor slab between the storeys hides, 0 to 1: the shaft goes dark as the car passes it, exactly when the floors change places. */
  slab: number;
  /** Past halfway: the floor being arrived at is the one shown. */
  arrived: boolean;
}

/** The ride, `t` seconds after it set off. Before it starts the car stands at the floor it leaves; after, at the other. */
export function rideAt(t: number): RideFrame {
  const f = Math.min(1, Math.max(0, t / RIDE_SECONDS));
  const fromMiddle = Math.abs(f - 0.5) / DIP.half;
  const slab = Math.abs(f - 0.5) / DIP.slab;
  return {
    car: smoother(f),
    dip: fromMiddle < 1 ? DIP.most * (1 - smooth(fromMiddle)) : 0,
    slab: slab < 1 ? 1 - smooth(slab) : 0,
    arrived: f >= 0.5,
  };
}

/** The ride's cutscene: seconds the view takes to glide in to the car as it sets off, and to ease back to the player's view once it arrives. */
export const CUT = { glide: 0.9, back: 0.9 };
/** How far the view has glided in to the car, 0 to 1, `t` seconds into the ride. */
export const glideAt = (t: number): number => smoother(t / CUT.glide);
/** How far the view has eased back to the player's own, 0 to 1, `t` seconds after the car arrived. */
export const backAt = (t: number): number => smoother(t / CUT.back);
/** The light that floods in as the doors part: how strong at most, and for how many seconds. */
export const WASH = { most: 0.45, seconds: 0.7 };
/** How strong the wash is `t` seconds after the car arrived; nothing before it arrives, or once it has faded. */
export function washAt(t: number): number {
  if (!(t >= 0) || t >= WASH.seconds) return 0;
  return WASH.most * (1 - smooth(t / WASH.seconds));
}

/**
 * How far open the doors are, 0 to 1, `t` seconds after the car arrived: they slide open, wait and close again.
 * Before the car arrives, or if it never has, they are shut.
 */
export function doorsAt(t: number): number {
  if (!(t >= 0)) return 0;
  if (t < DOORS.move) return smooth(t / DOORS.move);
  if (t < DOORS.move + DOORS.hold) return 1;
  return 1 - smooth((t - DOORS.move - DOORS.hold) / DOORS.move);
}
