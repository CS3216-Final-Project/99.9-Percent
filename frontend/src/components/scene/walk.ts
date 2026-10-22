import type { Floor } from "@/game/floors";
import type { EquipmentId } from "@/sim";
import { ALL_RACKS, ELEVATOR_DOOR, ELEVATOR_SPOT, SPOTS, type FunProp, type Racks } from "./floorplan";
import type { Footprint } from "./layout";
import { blocked, findPath, gridOf, nearestFree, type Grid } from "./navgrid";
import { facing, followPath, promptAt, slide, SPEED, steer, turnTowards, type Keys, type Prompt } from "./player";
import { ride, riding } from "./ride";

/*
 * The player's avatar in walk mode, shared by the room that draws it and the controls on the page: where it stands,
 * the keys held, a walk it is following, what it is busy with and what is within reach. Moving it is plain arithmetic
 * on the clock (see player.ts and navgrid.ts); only where it stands is remembered in the browser (see
 * game/exploration.ts), never its path, busy animation or keys held.
 */

export interface AvatarState {
  floor: Floor;
  x: number;
  z: number;
  yaw: number;
  moving: boolean;
  running: boolean;
  /** A walk to follow, from a click on the floor; empty when steering by keys or standing. */
  path: [number, number][];
  /** A fun thing it is doing, until a time on the page's clock. */
  busy: { clip: FunProp["clip"]; until: number } | null;
  /** Within reach now. */
  prompt: Prompt | null;
  /** Height above the floor while jumping. */
  lift: number;
  /** Vertical speed while jumping. */
  vy: number;
}

export const avatar: AvatarState = { floor: "office", x: 0, z: 0, yaw: 0, moving: false, running: false, path: [], busy: null, prompt: null, lift: 0, vy: 0 };

/** Others on the move who open doors as they come near, by name: the engineers called down to the racks. */
export const others = new Map<string, { floor: Floor; x: number; z: number }>();

/** The machines standing in the server hall, which the avatar walks round. Every place counts until the room says. */
let racks: Racks = ALL_RACKS;

/** Where the avatar can walk on a floor, with the machines standing now. */
export const gridHere = (floor: Floor = avatar.floor): Grid => gridOf(floor, racks);

/**
 * Hear which machines stand in the server hall now. A machine fitted where the avatar stands moves it aside to the
 * nearest free place, and a walk planned before it was fitted is dropped.
 */
export function setRacks(next: Racks): void {
  racks = next;
  if (avatar.floor !== "servers") return;
  const g = gridHere();
  if (!blocked(g.world, avatar.x, avatar.z)) return;
  const free = nearestFree(g, avatar.x, avatar.z);
  if (!free) return;
  Object.assign(avatar, { x: free[0], z: free[1], path: [] });
}

/** The movement keys held, by `KeyboardEvent.code`. */
export const held = new Set<string>();

const promptListeners = new Set<(p: Prompt | null) => void>();

/** Hear when what is within reach changes. */
export function onPrompt(listener: (p: Prompt | null) => void): () => void {
  promptListeners.add(listener);
  return () => promptListeners.delete(listener);
}

/** The middle of the elevator's car, and the spot in front of its doors where whoever rode steps out. */
export const CAR: [number, number] = [(ELEVATOR_SPOT[0] + ELEVATOR_SPOT[2]) / 2 - 0.1, ELEVATOR_DOOR.z];
export const LOBBY: [number, number] = [ELEVATOR_DOOR.x + 0.8, ELEVATOR_DOOR.z];

/**
 * Where walk mode begins: up from the founder's chair, in the open east end of the meeting room by its door, or out
 * of the elevator downstairs.
 */
export const MEETING_START: [number, number] = [-6.6, 11.8];
export function startAt(floor: Floor): [number, number] {
  return floor === "servers" ? LOBBY : MEETING_START;
}

/** Stand the avatar on a floor, still, facing away from the camera's usual view. */
export function placeAvatar(floor: Floor, at: [number, number] = startAt(floor), yaw = Math.PI * 0.75): void {
  Object.assign(avatar, { floor, x: at[0], z: at[1], yaw, moving: false, running: false, path: [], busy: null, lift: 0, vy: 0 });
  held.clear();
}

export function jump(): boolean {
  if (avatar.lift !== 0 || riding() || avatar.busy) return false;
  avatar.vy = 3.2;
  return true;
}

export function resetJump(): void {
  avatar.lift = 0;
  avatar.vy = 0;
}

/** Where the maps draw and name the avatar: walking, where it walks; otherwise in the founder's chair upstairs. */
export function avatarSpot(walking: boolean): { floor: Floor; x: number; z: number; yaw: number; to: Floor | null } {
  if (!walking) return { floor: "office", x: SPOTS.founder.x, z: SPOTS.founder.z, yaw: SPOTS.founder.rot, to: null };
  return { floor: avatar.floor, x: avatar.x, z: avatar.z, yaw: avatar.yaw, to: riding() ? ride.to : null };
}

/** Walk to (x, z) by the shortest way, or to the nearest free place to it; false if there is no way there. */
export function walkTo(x: number, z: number): boolean {
  const g = gridHere();
  const target = nearestFree(g, x, z, 2);
  if (!target) return false;
  const path = findPath(g, [avatar.x, avatar.z], target);
  if (!path) return false;
  avatar.path = path;
  avatar.busy = null;
  return true;
}

/** Play a fun thing's animation for a few seconds, turned to face it. */
export function play(prop: FunProp, now: number): void {
  avatar.path = [];
  avatar.yaw = facing(prop.face[0] - avatar.x, prop.face[1] - avatar.z);
  avatar.busy = { clip: prop.clip, until: now + 2.6 };
}

const KEYS: Record<string, keyof Keys> = {
  KeyW: "up",
  ArrowUp: "up",
  KeyS: "down",
  ArrowDown: "down",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
};

/** Whether a key is one that moves the avatar. */
export const movesAvatar = (code: string) => code in KEYS;

/** The arrow keys that turn the view through the avatar's eyes rather than step sideways. */
export const TURN_KEYS = { left: "ArrowLeft", right: "ArrowRight" } as const;

function keysHeld(turning: boolean): Keys {
  const k: Keys = { up: false, down: false, left: false, right: false };
  for (const code of held) {
    if (turning && (code === TURN_KEYS.left || code === TURN_KEYS.right)) continue;
    const dir = KEYS[code];
    if (dir) k[dir] = true;
  }
  return k;
}

/** Seeing through the avatar's eyes: it faces where the view looks and walks a little slower. */
export interface Eyes {
  heading: number;
  pace: number;
}

/**
 * One frame of walking, `dt` seconds long: steer by the keys held relative to `forward` (across the floor from the
 * camera to what it looks at), or follow the walk planned; turn to face the way it goes; and work out what is within
 * reach, telling the page when that changes. Seen through its `eyes`, the left and right arrows turn the view
 * instead of stepping sideways, and the avatar faces wherever the view looks.
 */
export function stepAvatar(dt: number, forward: [number, number], footprints: Record<EquipmentId, Footprint>, names: Record<EquipmentId, string>, now: number, eyes?: Eyes): void {
  const world = gridHere().world;
  const run = held.has("ShiftLeft") || held.has("ShiftRight");
  const speed = (run ? SPEED.run : SPEED.walk) * (eyes?.pace ?? 1);
  const [dx, dz] = steer(keysHeld(!!eyes), forward);
  let moved = false;
  if (dx || dz) {
    // Steering takes over from a planned walk or a fun thing.
    avatar.path = [];
    avatar.busy = null;
    const [x, z] = slide(world, avatar.x, avatar.z, dx * speed * dt, dz * speed * dt);
    moved = Math.hypot(x - avatar.x, z - avatar.z) > 1e-4;
    avatar.x = x;
    avatar.z = z;
    avatar.yaw = turnTowards(avatar.yaw, facing(dx, dz), dt);
  } else if (avatar.path.length) {
    const next = followPath(world, avatar.x, avatar.z, avatar.path, speed, dt);
    moved = Math.hypot(next.x - avatar.x, next.z - avatar.z) > 1e-4;
    Object.assign(avatar, { x: next.x, z: next.z, path: next.path });
    if (next.dx || next.dz) avatar.yaw = turnTowards(avatar.yaw, facing(next.dx, next.dz), dt);
  }
  if (eyes && !avatar.busy) avatar.yaw = eyes.heading;
  if (avatar.busy && now > avatar.busy.until) avatar.busy = null;
  avatar.moving = moved;
  avatar.running = moved && run;
  if (avatar.lift > 0 || avatar.vy > 0) {
    avatar.vy -= 9.8 * dt;
    avatar.lift = Math.max(0, avatar.lift + avatar.vy * dt);
    if (avatar.lift === 0) avatar.vy = 0;
  }
  const prompt = promptAt(avatar.floor, avatar.x, avatar.z, footprints, names);
  if (!samePrompt(prompt, avatar.prompt)) {
    avatar.prompt = prompt;
    for (const l of promptListeners) l(prompt);
  }
}

function samePrompt(a: Prompt | null, b: Prompt | null): boolean {
  if (!a || !b) return a === b;
  return a.kind === b.kind && a.label === b.label;
}

/** Clear what is within reach, as when walk mode ends. */
export function clearPrompt(): void {
  if (!avatar.prompt) return;
  avatar.prompt = null;
  for (const l of promptListeners) l(null);
}
