import type { Floor } from "@/game/floors";
import { STOREY } from "./city";

/*
 * Where the building's two floors stand and how the elevator rides between them (game/floors.ts says which floor
 * each piece of equipment is on). The office is y = 0 and the servers stand one storey below, on the same spots.
 * Switching floors rides the elevator: the car sets off, the camera glides down or up with it, the view dips as the
 * car passes between the floors, and the doors open on arrival.
 *
 * Kept free of React, three.js and the browser so the timing can be tested.
 */

/** Height of each floor's surface. */
export const FLOOR_Y: Record<Floor, number> = { office: 0, servers: -STOREY };

/** The number on the elevator's indicator: the office has six storeys of its building below it. */
export const FLOOR_NUMBER: Record<Floor, number> = { office: 7, servers: 6 };

/** Seconds from pressing a floor to arriving there. A second press, any click or a key skips the rest. */
export const RIDE_SECONDS = 3;
/** Seconds the doors take to open or close, and how long they stand open after the car arrives. */
export const DOORS = { move: 0.4, hold: 2.4 };
/** How dark the view goes as the car passes between the floors, and over what share of the ride either side of halfway. */
export const DIP = { most: 0.9, half: 0.4 };

const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

export interface RideFrame {
  /** How far the car has travelled from the floor it left, 0 to 1. It eases into motion and out of it. */
  car: number;
  /** How dark the view is: deepest halfway, where the floors change places, so neither is seen to vanish. */
  dip: number;
  /** Past halfway: the floor being arrived at is the one shown. */
  arrived: boolean;
}

/** The ride, `t` seconds after it set off. Before it starts the car stands at the floor it leaves; after, at the other. */
export function rideAt(t: number): RideFrame {
  const f = Math.min(1, Math.max(0, t / RIDE_SECONDS));
  const fromMiddle = Math.abs(f - 0.5) / DIP.half;
  return { car: smooth(f), dip: fromMiddle < 1 ? DIP.most * (1 - smooth(fromMiddle)) : 0, arrived: f >= 0.5 };
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
