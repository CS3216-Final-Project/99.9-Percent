import * as THREE from "three";
import { fromAvatar, type Viewpoint } from "@/game/viewpoints";
import { riding } from "./ride";
import { avatar } from "./walk";
import { FOLLOW, type Pose } from "./views";

/*
 * What the views from the avatar share with the rest of the room (see ViewRig.tsx): the cameras, where the view
 * looks, whether the pointer is locked for looking round, and what the camera buttons do meanwhile.
 */

/** The overview's orthographic camera, the canvas's own, kept for while the perspective one draws. */
export const cameras: { overview: THREE.OrthographicCamera | null; perspective: THREE.PerspectiveCamera } = {
  overview: null,
  perspective: new THREE.PerspectiveCamera(FOLLOW.fov, 1, 0.05, 150),
};

/** What the views from the avatar tell the rest of the room each frame. */
export const viewNow = {
  /** The view asked for: what the steering and the camera buttons answer to, even while it is easing in. */
  want: "overview" as Viewpoint,
  /** The perspective camera is drawing. */
  perspective: false,
  /** The camera is in the avatar's head, so its body is not drawn. */
  inHead: false,
  /** Where the views from the avatar look. */
  heading: 0,
  pitch: FOLLOW.pitch,
  eyesPitch: 0.12,
  distance: FOLLOW.distance,
  /** Turn still to apply from Q, E or a rotate button. */
  spin: 0,
  /** The pointer is locked to the room for looking round. */
  locked: false,
  /** The browser would not lock the pointer, so first person looks round by pointing instead (see POINT). */
  lockRefused: false,
  /** Where the mouse is over the room, from -1 to 1 across and down from the middle; null when it is elsewhere. */
  pointing: null as { x: number; y: number } | null,
  /** The room is being dragged to look round, which pointing gives way to. */
  dragging: false,
  /** Where the overview's camera looks on the floor and the way it faces, for the map to turn with the view. */
  overview: { x: 0, z: 0, heading: 0 },
};

/** The rig's own state between frames: reset whenever a room mounts it. */
export const rig = {
  /** The view drawn once any move between views is over. */
  settled: "overview" as Viewpoint,
  /** A move between views under way. */
  move: null as { from: Viewpoint; to: Viewpoint; at: number; pose: Pose | null; cut: boolean } | null,
  /** The follow view as drawn, catching up with the avatar. */
  trailing: null as Pose | null,
  /** The pose last drawn, held while dimming away from it. */
  drawn: null as Pose | null,
  /** Where the avatar stood when last seen from, for the overview to pick up. */
  lastSeen: { x: 0, y: 0, z: 0 },
  /** A frame has been drawn, so a change of view from now on is the player's, and is heard. */
  started: false,
};

export function resetRig(): void {
  Object.assign(rig, { settled: "overview", move: null, trailing: null, drawn: null, started: false });
  Object.assign(viewNow, { want: "overview", perspective: false, inHead: false, spin: 0, lockRefused: false, pointing: null, dragging: false });
}

/** What the camera buttons do in a view from the avatar. */
export const lookApi = {
  swing: (radians: number) => {
    viewNow.spin += radians;
  },
  /** Zoom in or out: in follow, nearer or farther; through the avatar's eyes there is nothing to zoom. */
  dolly: (factor: number) => {
    viewNow.distance = THREE.MathUtils.clamp(viewNow.distance / factor, FOLLOW.nearest, FOLLOW.farthest);
  },
  reset: () => {
    viewNow.spin = 0;
    viewNow.heading = avatar.yaw;
    viewNow.pitch = FOLLOW.pitch;
    viewNow.eyesPitch = 0.12;
    viewNow.distance = FOLLOW.distance;
  },
};

/**
 * Take the mouse for looking round through the avatar's eyes, as a click on the room or the pause card's Look
 * around does. The view rig fills this in; until then it does nothing.
 */
export const mouse = { take: () => {} };

/** Whether a view from the avatar is asked for now, so the camera buttons and keys answer to it. */
export const lookingFromAvatar = () => fromAvatar(viewNow.want);

/** Riding from the avatar, the whole shaft can be seen as the car passes between the floors, so both are drawn. */
export const bothFloors = () => riding() && lookingFromAvatar();

/**
 * The heights of the shaft that can be seen now, as two clipping planes the car and whoever rides in it are cut by,
 * so a car off on an errand is never seen above or below the floor on screen. The shaft's frame owner keeps them up
 * to date (see Elevator.tsx).
 */
export const SHAFT_CLIP: THREE.Plane[] = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6), new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e6)];

/** Cut the car and its riders to heights from `lo` to `hi`. */
export function clipShaft(lo: number, hi: number): void {
  SHAFT_CLIP[0].constant = hi;
  SHAFT_CLIP[1].constant = -lo;
}

let fadeEl: HTMLDivElement | null = null;
/** What the dimming was last set to, so a frame with nothing to change writes nothing to the page. */
let fadeShown = "";
/** The dimming laid over the room as the view cuts between the overview and a view from the avatar. */
export const bindViewFade = (el: HTMLDivElement | null) => {
  fadeEl = el;
  fadeShown = "";
};
export function setViewFade(dark: number): void {
  const next = dark > 0.001 ? dark.toFixed(3) : "0";
  if (!fadeEl || next === fadeShown) return;
  fadeEl.style.opacity = next;
  fadeShown = next;
}
