import type { Floor } from "@/game/floors";
import { DOORS, doorsAt, FLOOR_Y, HURRY_SECONDS, RIDE_SECONDS, rideAt } from "./levels";

/*
 * The elevator's ride between the floors, shared by the room that draws it, the labels that wait for it and the
 * sounds that go with it. It runs on the wall clock, not on frames, so a slow graphics card only makes the glide
 * choppier: the car always arrives on time and the new floor's labels appear when it does.
 */

export interface Ride {
  /** The floor the car left and the one it is going to; the same when it has never moved. */
  from: Floor;
  to: Floor;
  /** Seconds on the page's clock when the car set off and when it arrived; -Infinity before the first ride. */
  start: number;
  arrived: number;
  /** Height of the view when the car set off, so a ride turned round halfway carries on from where it was. */
  fromY: number;
  /** Height of the view now, kept up to date by the room. */
  y: number;
  /** How far open the doors were when the car set off; they close as it leaves. */
  closing: number;
  /** How fast the ride's clock runs against the page's: 1, or more once the player has hurried it. */
  rate: number;
}

export type RideEvent = "depart" | "arrive";

export const ride: Ride = { from: "servers", to: "servers", start: -Infinity, arrived: -Infinity, fromY: 0, y: 0, closing: 0, rate: 1 };

const listeners = new Set<(event: RideEvent) => void>();
let timer = 0;
let stopSkipping: (() => void) | null = null;

/** Seconds on the page's clock. */
export const now = () => performance.now() / 1000;

/** The car is between floors. */
export const riding = () => ride.arrived < ride.start;

/** Hear when the car sets off and arrives. Returns the way to stop listening. */
export function onRide(listener: (event: RideEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Stand the car at a floor without riding, as when the room first opens. */
export function placeCar(floor: Floor): void {
  window.clearTimeout(timer);
  stopSkipping?.();
  Object.assign(ride, { from: floor, to: floor, start: -Infinity, arrived: -Infinity, fromY: FLOOR_Y[floor], y: FLOOR_Y[floor], closing: 0, rate: 1 });
}

/**
 * Ride to `to`. With `instant` (reduced motion) the view cuts straight there. Otherwise any click or key press
 * during the ride hurries the rest of it along, though not the press that started it.
 */
export function depart(to: Floor, instant: boolean): void {
  window.clearTimeout(timer);
  stopSkipping?.();
  const t = now();
  Object.assign(ride, { from: ride.to, to, start: t, arrived: -Infinity, fromY: ride.y, closing: riding() ? 0 : doorsAt(t - ride.arrived), rate: 1 });
  for (const l of listeners) l("depart");
  if (instant) {
    arrive();
    return;
  }
  timer = window.setTimeout(arrive, RIDE_SECONDS * 1000);
  // Listen from the next turn, so the click or key press that set off the ride is not taken as a hurry.
  const skip = (e: Event) => {
    if (e instanceof KeyboardEvent && e.repeat) return;
    hurry();
  };
  const start = window.setTimeout(() => {
    window.addEventListener("pointerdown", skip, true);
    window.addEventListener("keydown", skip, true);
  }, 0);
  stopSkipping = () => {
    window.clearTimeout(start);
    window.removeEventListener("pointerdown", skip, true);
    window.removeEventListener("keydown", skip, true);
    stopSkipping = null;
  };
}

/** Hurry the rest of the ride into HURRY_SECONDS at most, carrying on from where the car is, so the view never jumps. */
export function hurry(): void {
  if (!riding()) return;
  stopSkipping?.();
  const t = now();
  const elapsed = rideClock(t);
  const left = RIDE_SECONDS - elapsed;
  if (left <= 0) {
    arrive();
    return;
  }
  // Never slower than the car already goes: late in the ride, or hurried twice, it keeps its pace.
  const rate = Math.max(ride.rate, left / HURRY_SECONDS);
  ride.start = t - elapsed / rate;
  ride.rate = rate;
  window.clearTimeout(timer);
  timer = window.setTimeout(arrive, (left / rate) * 1000);
}

/** The car arrives now, if it has not already. */
export function arrive(): void {
  if (!riding()) return;
  window.clearTimeout(timer);
  stopSkipping?.();
  ride.arrived = now();
  for (const l of listeners) l("arrive");
}

const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/** How far open a floor's elevator doors are now, 0 to 1: they part when the car arrives and close as it leaves. */
export function doorsNow(floor: Floor, at = now()): number {
  if (riding()) return floor === ride.from ? ride.closing * (1 - smooth(rideClock(at) / DOORS.move)) : 0;
  return floor === ride.to ? doorsAt(at - ride.arrived) : 0;
}

/** Seconds into the ride now; past RIDE_SECONDS once the car has arrived, even if it was hurried along early. */
export function rideClock(at = now()): number {
  return riding() ? (at - ride.start) * ride.rate : RIDE_SECONDS + Math.max(0, at - ride.arrived);
}

/** The floor drawn now: the one being left until halfway through a ride, when the view is darkest, then the other. */
export function shownFloor(at = now()): Floor {
  return riding() && !rideAt(rideClock(at)).arrived ? ride.from : ride.to;
}

/** The height the view looks at now, gliding from where it was to the floor being ridden to. */
export function viewHeight(at = now()): number {
  if (!riding()) return FLOOR_Y[ride.to];
  return ride.fromY + (FLOOR_Y[ride.to] - ride.fromY) * rideAt(rideClock(at)).car;
}
