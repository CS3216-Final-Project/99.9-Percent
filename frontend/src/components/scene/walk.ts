import type { Floor } from "@/game/floors";
import type { EquipmentId } from "@/sim";
import { ELEVATOR_DOOR, ELEVATOR_SPOT, type FunProp } from "./floorplan";
import type { Footprint } from "./layout";
import { findPath, gridOf, nearestFree } from "./navgrid";
import { facing, followPath, promptAt, slide, SPEED, steer, turnTowards, type Keys, type Prompt } from "./player";

/*
 * The player's avatar in walk mode, shared by the room that draws it, the camera that follows it and the controls
 * on the page: where it stands, the keys held, a walk it is following, what it is busy with and what is within
 * reach. Moving it is plain arithmetic on the clock (see player.ts and navgrid.ts); none of it is ever saved.
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
}

export const avatar: AvatarState = { floor: "office", x: 0, z: 0, yaw: 0, moving: false, running: false, path: [], busy: null, prompt: null };

/** Others on the move who open doors as they come near, by name: the engineers called down to the racks. */
export const others = new Map<string, { floor: Floor; x: number; z: number }>();

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
  Object.assign(avatar, { floor, x: at[0], z: at[1], yaw, moving: false, running: false, path: [], busy: null });
  held.clear();
}

/** Walk to (x, z) by the shortest way, or to the nearest free place to it; false if there is no way there. */
export function walkTo(x: number, z: number): boolean {
  const g = gridOf(avatar.floor);
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

function keysHeld(): Keys {
  const k: Keys = { up: false, down: false, left: false, right: false };
  for (const code of held) {
    const dir = KEYS[code];
    if (dir) k[dir] = true;
  }
  return k;
}

/**
 * One frame of walking, `dt` seconds long: steer by the keys held relative to `forward` (across the floor from the
 * camera to what it looks at), or follow the walk planned; turn to face the way it goes; and work out what is within
 * reach, telling the page when that changes.
 */
export function stepAvatar(dt: number, forward: [number, number], footprints: Record<EquipmentId, Footprint>, names: Record<EquipmentId, string>, now: number): void {
  const world = gridOf(avatar.floor).world;
  const run = held.has("ShiftLeft") || held.has("ShiftRight");
  const speed = run ? SPEED.run : SPEED.walk;
  const [dx, dz] = steer(keysHeld(), forward);
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
  if (avatar.busy && now > avatar.busy.until) avatar.busy = null;
  avatar.moving = moved;
  avatar.running = moved && run;
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
