import { otherFloor, type Floor } from "@/game/floors";
import { DOORS, doorsAt, FLOOR_Y, RIDE_SECONDS, rideAt } from "./levels";
import { doorsNow, ride, rideClock, riding } from "./ride";
import { worldNow } from "./worldClock";

/*
 * The car's errands for the crew, between the player's own rides (ride.ts). The car rests at the floor in view.
 * Someone waiting there calls it and its doors open. Someone aboard for the other floor, or waiting on it, sends
 * it on an errand: the doors shut, it travels there, stands with its doors open while they get on and off, and
 * comes back, so it is home again for the player. The player's own ride always comes first: it ends an errand at
 * once, wherever the car is.
 *
 * Errands and calls run on the world's clock (worldClock.ts), so they hold while the company is paused; the
 * player's own ride runs on the page's clock and is read without `at`.
 *
 * Plain arithmetic on the clock, kept free of React and three.js so it can be tested; the room reads the car's
 * height and doors from here rather than from the ride.
 */

export type ErrandPhase = "closing" | "out" | "stop" | "back" | "home";

export interface Errand {
  /** The floor in view, where the car rests, and the other one it goes to. */
  home: Floor;
  away: Floor;
  phase: ErrandPhase;
  /** Seconds on the world's clock when this phase began. */
  since: number;
  /** How far open the doors at home were as it set off; they close from there. */
  closing: number;
  /** When the doors at the far floor began to close, once they have. */
  leaving: number | null;
}

/** How long the car stands at the far floor with its doors open: at least, and at most whoever is slow. */
export const STOP = { least: 2.2, most: 9 };

let errand: Errand | null = null;
/** The doors opened for whoever waits where the car rests, and when. */
let call: { floor: Floor; at: number } | null = null;
const ended = new Set<(e: Errand, at: number) => void>();

const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/** The errand under way, if any. */
export const errandNow = (): Errand | null => errand;

/** Hear when an errand ends, whether it came home or the player's ride cut it short. Returns the way to stop. */
export function onErrandEnd(listener: (e: Errand, at: number) => void): () => void {
  ended.add(listener);
  return () => ended.delete(listener);
}

/** How far open a floor's doors are now: for the player's ride, an errand, or a call where the car rests. */
export function carDoors(floor: Floor, at = worldNow()): number {
  if (riding()) return doorsNow(floor);
  if (errand) {
    const e = errand;
    const t = at - e.since;
    if (e.phase === "closing") return floor === e.home ? e.closing * (1 - smooth(t / DOORS.move)) : 0;
    if (e.phase === "stop") {
      if (floor !== e.away) return 0;
      return e.leaving === null ? smooth(t / DOORS.move) : 1 - smooth((at - e.leaving) / DOORS.move);
    }
    if (e.phase === "home") return floor === e.home ? doorsAt(t) : 0;
    return 0;
  }
  const open = doorsNow(floor);
  return call && call.floor === floor ? Math.max(open, doorsAt(at - call.at)) : open;
}

/** The height of the car's floor now. */
export function carY(at = worldNow()): number {
  if (riding() || !errand) return ride.y;
  const e = errand;
  const [home, away] = [FLOOR_Y[e.home], FLOOR_Y[e.away]];
  const t = at - e.since;
  if (e.phase === "out") return home + (away - home) * rideAt(t).car;
  if (e.phase === "stop") return away;
  if (e.phase === "back") return away + (home - away) * rideAt(t).car;
  return home;
}

/** The floor the car stands still at now, where its doors can open, or null while it travels. */
export function carStandsAt(): Floor | null {
  if (riding()) return null;
  if (!errand) return ride.to;
  if (errand.phase === "stop") return errand.away;
  if (errand.phase === "home" || errand.phase === "closing") return errand.home;
  return null;
}

/** What the floor indicators show now: the floor the car is at or passing, and which way it is going. */
export function carIndicator(at = worldNow()): { floor: Floor; arrow: "up" | "down" | null } {
  const toward = (from: Floor, to: Floor) => (FLOOR_Y[to] > FLOOR_Y[from] ? "up" : "down");
  if (riding()) return { floor: rideAt(rideClock()).arrived ? ride.to : ride.from, arrow: toward(ride.from, ride.to) };
  if (!errand) return { floor: ride.to, arrow: null };
  const e = errand;
  const half = rideAt(at - e.since).arrived;
  if (e.phase === "out") return { floor: half ? e.away : e.home, arrow: toward(e.home, e.away) };
  if (e.phase === "back") return { floor: half ? e.home : e.away, arrow: toward(e.away, e.home) };
  return { floor: e.phase === "stop" ? e.away : e.home, arrow: null };
}

/** The floor the car is on its way to, for its panel to light, or null while it stands still. */
export function carBound(): Floor | null {
  if (riding()) return ride.to;
  if (!errand) return null;
  if (errand.phase === "closing" || errand.phase === "out") return errand.away;
  if (errand.phase === "back") return errand.home;
  return null;
}

/** Whether the car is on its way somewhere: the player's ride or an errand, but not standing still. */
export const carMoving = () => carStandsAt() === null;

/** Open the doors where the car rests for whoever waits there, or keep them open while someone is still getting on. */
export function holdDoors(floor: Floor, at = worldNow()): void {
  if (riding() || errand || ride.to !== floor) return;
  // Once open, a call is kept open by starting it again, as far along as the doors fully open.
  const open = carDoors(floor, at);
  call = { floor, at: open >= 1 ? at - DOORS.move : at - DOORS.move * open };
}

/** Send the car from where it rests to the other floor and back. False if it is busy. */
export function sendCar(at = worldNow()): boolean {
  if (riding() || errand) return false;
  const home = ride.to;
  errand = { home, away: otherFloor(home), phase: "closing", since: at, closing: carDoors(home, at), leaving: null };
  call = null;
  return true;
}

/**
 * Move an errand along: doors shut, out, a stop at the far floor until `settled` says nobody is still getting on
 * or off there (or STOP.most runs out), back, and the doors at home opening and closing again before it ends.
 */
export function stepErrand(settled: (floor: Floor) => boolean, at = worldNow()): void {
  const e = errand;
  if (!e || riding()) return;
  const t = at - e.since;
  const next = (phase: ErrandPhase) => Object.assign(e, { phase, since: at, leaving: null });
  if (e.phase === "closing" && t >= DOORS.move) next("out");
  else if (e.phase === "out" && t >= RIDE_SECONDS) next("stop");
  else if (e.phase === "stop") {
    if (e.leaving === null && ((t >= DOORS.move + STOP.least && settled(e.away)) || t >= STOP.most)) e.leaving = at;
    else if (e.leaving !== null && at - e.leaving >= DOORS.move) next("back");
  } else if (e.phase === "back" && t >= RIDE_SECONDS) next("home");
  else if (e.phase === "home" && t >= 2 * DOORS.move + DOORS.hold) finish(at);
}

function finish(at: number): void {
  const e = errand;
  errand = null;
  if (e) for (const l of ended) l(e, at);
}

/** End any errand at once, the car home, as the player's ride sets off. */
export function settleErrand(at = worldNow()): void {
  call = null;
  finish(at);
}

/** Forget every errand and call, as when the room first opens. */
export function resetErrands(): void {
  errand = null;
  call = null;
}
