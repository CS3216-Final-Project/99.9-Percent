import { otherFloor, type Floor } from "@/game/floors";
import { pick, randRange, type RngHolder } from "@/sim/rng";
import { ALL_ROLES, creature, type Activity, type Species } from "./cast";
import { SERVER_ROOMS, SERVER_ZONE_NAMES, ZONE_NAMES } from "./floorplan";
import { inCabin, RIDER_SPOTS } from "./lift";
import { findPath, nearestFree } from "./navgrid";
import { atElevator, facing, followPath, turnTowards } from "./player";
import { now, ride, riding } from "./ride";
import { apart, clearOf, intrudes, radiusOf, sidestep, type Body } from "./spacing";
import { carDoors, carStandsAt, errandNow, holdDoors, sendCar, stepErrand, type Errand } from "./trips";
import { avatar, gridHere, LOBBY } from "./walk";

/*
 * People about the building who are not the company's own crew: they wander from one part of a floor to another,
 * stop a while, and now and then take the elevator to the other floor. Waiting in the lobby they call the car; they
 * get on when its doors open, ride, and get off at their floor. Someone waiting on the other floor, or aboard for
 * it, sends the car on an errand there (trips.ts), and they ride along when the player rides their way.
 *
 * All of it is plain arithmetic on the clock with a seeded random walk, kept free of React and three.js so it can
 * be tested; one component steps it each frame and draws them (see Visitors.tsx).
 */

export type Doing = "roam" | "linger" | "wait" | "board" | "aboard" | "alight";

export interface Visitor {
  id: number;
  species: Species;
  /** The floor it stands on, or last stood on before it got in the car. */
  floor: Floor;
  x: number;
  z: number;
  yaw: number;
  doing: Doing;
  /** Where it is walking, from a path over the floor's grid. */
  path: [number, number][];
  /** When a stop ends, in seconds on the page's clock. */
  until: number;
  /** The floor it means to be on. */
  bound: Floor;
  /** Its place in the car while it gets on and rides. */
  seat: number | null;
  moving: boolean;
  activity: Activity;
  stuck: number;
}

/** Metres a second they walk, and a little brisker getting in and out of the car. */
export const PACE = { walk: 0.62, lift: 0.95 };
/** Seconds they stop where they go. */
const LINGER: [number, number] = [5, 14];
/** How often, as a share of their stops, they set off for the other floor. */
const TRAVEL = 0.3;
/** How near ahead the avatar must be for them to wait for it to pass. */
const MAKE_WAY = 0.9;
/** Seconds a visitor waits before abandoning a blocked walk. */
const PATIENCE = 2.5;
/** Seconds the car rests between errands, so the doors are not forever opening and closing. */
const REST = 4;

/** Where they wait for the car, either side of the lobby in front of its doors. */
const WAITING: [number, number][] = [
  [LOBBY[0] + 0.45, LOBBY[1] - 0.95],
  [LOBBY[0] + 0.5, LOBBY[1] + 0.95],
  [LOBBY[0] + 1.2, LOBBY[1] - 0.35],
  [LOBBY[0] + 1.25, LOBBY[1] + 0.45],
];

/** The places on each floor worth walking to: the zones the room names, and what they stop to do there. */
const PLACES: Record<Floor, { at: [number, number]; activity: Activity }[]> = {
  office: ZONE_NAMES.map(([name, x, z]) => ({ at: [x, z] as [number, number], activity: /Kitchen|Dining/.test(name) ? "mug" : /Lounge|Games|Foosball|Events/.test(name) ? "chat" : "idle" })),
  servers: [...SERVER_ZONE_NAMES.map(([, x, z]): [number, number] => [x, z]), ...SERVER_ROOMS.map(([, r]): [number, number] => [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2])].map((at) => ({ at, activity: "idle" as Activity })),
};

export interface Crowd {
  visitors: Visitor[];
  rng: RngHolder;
  /** The page's clock when they were last moved, so a second caller in the same frame does nothing. */
  last: number;
  /** When the car last came home from an errand. */
  rested: number;
}

let crowd: Crowd = { visitors: [], rng: { rngState: 1 }, last: -Infinity, rested: -Infinity };

/** Everyone about now. */
export const visitors = (): readonly Visitor[] => crowd.visitors;

/** A free place near (x, z) on a floor, a little to either side at random. */
function near(floor: Floor, [x, z]: [number, number], spread: number): [number, number] | null {
  const r = crowd.rng;
  return nearestFree(gridHere(floor), x + randRange(r, -spread, spread), z + randRange(r, -spread, spread), 2.5);
}

function bodiesFor(v: Visitor, around: (floor: Floor) => Body[]): Body[] {
  return [
    ...crowd.visitors
      .filter((other) => other !== v && other.floor === v.floor && other.doing !== "aboard" && other.doing !== "board")
      .map((other) => ({ x: other.x, z: other.z, r: radiusOf(other.species) })),
    ...around(v.floor),
  ];
}

function driftApart(v: Visitor, dt: number, around: (floor: Floor) => Body[]): void {
  const [x, z] = apart(gridHere(v.floor).world, bodiesFor(v, around), radiusOf(v.species), v.x, v.z, dt * 0.4);
  v.x = x;
  v.z = z;
}

/** Walk `v` to (x, z) on its floor; false if there is no way there. */
function head(v: Visitor, to: [number, number], doing: Doing): boolean {
  const path = findPath(gridHere(v.floor), [v.x, v.z], to);
  if (!path) return false;
  Object.assign(v, { path, doing });
  return true;
}

/** Decide where `v` goes next: somewhere on its floor, or, now and then, to the lobby for the other floor. */
function nextGoal(v: Visitor, t: number, around: (floor: Floor) => Body[]): void {
  const r = crowd.rng;
  const bodies = bodiesFor(v, around);
  const radius = radiusOf(v.species);
  if (randRange(r, 0, 1) < TRAVEL) {
    v.bound = otherFloor(v.floor);
    for (let tries = 0; tries < 4; tries++) {
      const spot = near(v.floor, pick(r, WAITING), 0.15);
      if (spot && clearOf(bodies, radius, spot[0], spot[1]) && head(v, spot, "roam")) return;
    }
    v.bound = v.floor;
  }
  for (let tries = 0; tries < 4; tries++) {
    const place = pick(r, PLACES[v.floor]);
    const spot = near(v.floor, place.at, 1.4);
    if (spot && clearOf(bodies, radius, spot[0], spot[1]) && head(v, spot, "roam")) {
      v.activity = place.activity;
      return;
    }
  }
  // Nowhere to go: stay a while longer.
  Object.assign(v, { doing: "linger", until: t + randRange(r, ...LINGER) });
}

/** Fill the building with `count` people, about half on each floor, from `seed`. */
export function populate(count: number, seed: number, t = now()): void {
  crowd = { visitors: [], rng: { rngState: seed | 0 || 1 }, last: -Infinity, rested: -Infinity };
  const r = crowd.rng;
  for (let i = 0; i < count; i++) {
    const floor: Floor = i % 2 === 0 ? "office" : "servers";
    const species = creature(Math.floor(randRange(r, 0, 60)), pick(r, ALL_ROLES));
    const radius = radiusOf(species);
    const bodies = crowd.visitors.filter((v) => v.floor === floor).map((v) => ({ x: v.x, z: v.z, r: radiusOf(v.species) }));
    let place = pick(r, PLACES[floor]);
    let at: [number, number] | null = null;
    for (let tries = 0; tries < 12 && !at; tries++) {
      place = pick(r, PLACES[floor]);
      const candidate = near(floor, place.at, 1.4);
      if (candidate && clearOf(bodies, radius, candidate[0], candidate[1])) at = candidate;
    }
    if (!at) continue;
    crowd.visitors.push({
      id: i,
      species,
      floor,
      x: at[0],
      z: at[1],
      yaw: randRange(r, -Math.PI, Math.PI),
      doing: "linger",
      path: [],
      until: t + randRange(r, 0, LINGER[1]),
      bound: floor,
      seat: null,
      moving: false,
      activity: place.activity,
      stuck: 0,
    });
  }
}

/** Whether the player's avatar stands just ahead of `v`, in its way. */
function avatarAhead(v: Visitor, walking: boolean): boolean {
  if (!walking || riding() || avatar.floor !== v.floor) return false;
  const dx = avatar.x - v.x;
  const dz = avatar.z - v.z;
  return Math.hypot(dx, dz) < MAKE_WAY && dx * -Math.sin(v.yaw) + dz * -Math.cos(v.yaw) > 0;
}

/** Walk `v` along its path for `dt` seconds; true once it has arrived. */
function walk(v: Visitor, dt: number, pace: number, walking: boolean, bodies?: Body[], t = 0): boolean {
  if (!v.path.length) {
    v.moving = false;
    return true;
  }
  if (avatarAhead(v, walking)) {
    v.moving = false;
    return false;
  }
  const next = followPath(gridHere(v.floor).world, v.x, v.z, v.path, pace, dt);
  if (bodies && intrudes(bodies, radiusOf(v.species), v.x, v.z, next.x, next.z)) {
    v.stuck += dt;
    const heading = next.dx || next.dz ? facing(next.dx, next.dz) : v.yaw;
    const side = sidestep(gridHere(v.floor).world, bodies, radiusOf(v.species), v.x, v.z, heading, PACE.walk * dt * 0.7);
    if (side) Object.assign(v, { x: side[0], z: side[1], moving: true });
    else v.moving = false;
    v.yaw = turnTowards(v.yaw, heading, dt, 6);
    if (v.stuck > PATIENCE) {
      Object.assign(v, { bound: v.floor, doing: "linger", until: t + 1, path: [], moving: false, stuck: 0 });
    }
    return false;
  }
  v.moving = Math.hypot(next.x - v.x, next.z - v.z) > 1e-4;
  Object.assign(v, { x: next.x, z: next.z, path: next.path });
  if (v.moving) v.stuck = 0;
  if (next.dx || next.dz) v.yaw = turnTowards(v.yaw, facing(next.dx, next.dz), dt, 6);
  return v.path.length === 0;
}

/** The car's seats not taken by anyone getting on or riding. */
function freeSeat(): number | null {
  const taken = new Set(crowd.visitors.filter((v) => v.seat !== null).map((v) => v.seat));
  const free = RIDER_SPOTS.findIndex((_, i) => !taken.has(i));
  return free < 0 ? null : free;
}

/** Off the car where it stands, out through the doors and on to wherever next. */
function getOff(v: Visitor, floor: Floor): void {
  Object.assign(v, { floor, seat: null, bound: floor });
  const out = near(floor, [LOBBY[0] + 0.6, LOBBY[1]], 0.5) ?? LOBBY;
  if (!head(v, out, "alight")) Object.assign(v, { x: out[0], z: out[1], doing: "alight", path: [] });
}

/** Into the car where it stands, to a free seat; false if it is full or there is no way in. */
function getOn(v: Visitor): boolean {
  const seat = freeSeat();
  if (seat === null) return false;
  const path = findPath(gridHere(v.floor), [v.x, v.z], RIDER_SPOTS[seat]);
  if (!path) return false;
  Object.assign(v, { seat, path, doing: "board" });
  return true;
}

/**
 * Someone who was riding, or getting on, when the car was taken from them: the player's ride set off, or an errand
 * was cut short. Riders reach the floor they were going to after all, as if they had got off there; anyone still
 * getting on goes back to waiting.
 */
function setDown(v: Visitor, to: Floor): void {
  if (v.doing === "board") Object.assign(v, { doing: "wait", seat: null, path: [] });
  else if (v.doing === "aboard") {
    const out = near(to, [LOBBY[0] + 0.6, LOBBY[1]], 0.5) ?? LOBBY;
    Object.assign(v, { floor: to, x: out[0], z: out[1], seat: null, bound: to, doing: "linger", until: now() + 1, path: [] });
  }
}

/** The player's ride sets off: whoever is aboard for its floor rides along; anyone else aboard or getting on is set down. */
export function playerDeparts(from: Floor, to: Floor): void {
  for (const v of crowd.visitors) {
    if (v.doing === "aboard" && v.bound === to) continue;
    if (v.doing === "aboard") setDown(v, v.bound);
    else if (v.doing === "board" && v.floor === from) setDown(v, from);
  }
}

/**
 * An errand ended: the car rests a while before the next. Cut short before it came home, its riders are set down
 * where they were going.
 */
export function errandEnded(e: Errand, t = now()): void {
  crowd.rested = t;
  if (e.phase === "home") return;
  for (const v of crowd.visitors) if (v.doing === "aboard" || v.doing === "board") setDown(v, v.bound);
}

/** Nobody is still getting on or off at `floor`. */
function settled(floor: Floor): boolean {
  return !crowd.visitors.some((v) => (v.doing === "board" && v.floor === floor) || (v.doing === "alight" && v.floor === floor && inCabin(v.x, v.z)) || (v.doing === "aboard" && v.bound === floor));
}

/**
 * One step of everyone's day, `dt` seconds long, ending at `t`: walking, stopping, waiting for the car, getting on and
 * off; and the car's errands, sent off and moved along. `walking` says whether the player's avatar is out on foot,
 * so they make way for it and the car is never sent off with it inside or at its doors.
 */
export function stepVisitors(dt: number, t: number, walking: boolean, around: (floor: Floor) => Body[] = () => []): void {
  if (t <= crowd.last) return;
  crowd.last = t;
  dt = Math.min(dt, 0.1);
  const stands = carStandsAt();
  for (const v of crowd.visitors) {
    const open = stands === v.floor && carDoors(v.floor, t) > 0.6;
    switch (v.doing) {
      case "linger":
        v.moving = false;
        driftApart(v, dt, around);
        if (t >= v.until) nextGoal(v, t, around);
        break;
      case "roam":
        if (walk(v, dt, PACE.walk, walking, bodiesFor(v, around), t)) {
          if (v.bound !== v.floor) Object.assign(v, { doing: "wait", activity: "idle" });
          else Object.assign(v, { doing: "linger", until: t + randRange(crowd.rng, ...LINGER) });
        }
        break;
      case "wait":
        v.moving = false;
        driftApart(v, dt, around);
        // Facing the doors, until they open and there is room.
        v.yaw = turnTowards(v.yaw, facing(LOBBY[0] - 1 - v.x, LOBBY[1] - v.z), dt, 4);
        if (open) getOn(v);
        else if (stands === v.floor && !errandNow()) holdDoors(v.floor, t);
        break;
      case "board":
        if (stands === v.floor) holdDoors(v.floor, t);
        if (walk(v, dt, PACE.lift, walking)) Object.assign(v, { doing: "aboard", moving: false });
        else if (!open && stands !== v.floor) setDown(v, v.floor);
        break;
      case "aboard":
        v.moving = false;
        v.yaw = turnTowards(v.yaw, facing(1, 0), dt, 4);
        if (stands === v.bound && carDoors(v.bound, t) > 0.6) getOff(v, v.bound);
        break;
      case "alight":
        if (walk(v, dt, PACE.lift, walking)) nextGoal(v, t, around);
        break;
    }
  }
  // The car's errands: on with any under way, or off on one if someone needs the other floor and nobody needs it here.
  const errand = errandNow();
  if (errand) stepErrand(settled, t);
  else if (!riding() && t - crowd.rested >= REST) {
    const home = ride.to;
    const away = otherFloor(home);
    const busyHere = crowd.visitors.some((v) => (v.doing === "board" && v.floor === home) || (v.doing === "alight" && v.floor === home && inCabin(v.x, v.z)));
    const wanted = crowd.visitors.some((v) => (v.doing === "aboard" && v.bound === away) || (v.doing === "wait" && v.floor === away));
    // Never with the player's avatar in the car or at its doors.
    const blocked = walking && avatar.floor === home && (inCabin(avatar.x, avatar.z) || atElevator(avatar.x, avatar.z));
    if (wanted && !busyHere && !blocked && sendCar(t)) crowd.rested = Infinity;
  }
}
