import * as THREE from "three";
import { fromAvatar, type Viewpoint } from "@/game/viewpoints";
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
  Object.assign(viewNow, { want: "overview", perspective: false, inHead: false, spin: 0 });
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

/** Whether a view from the avatar is asked for now, so the camera buttons and keys answer to it. */
export const lookingFromAvatar = () => fromAvatar(viewNow.want);

let fadeEl: HTMLDivElement | null = null;
/** The dimming laid over the room as the view cuts between the overview and a view from the avatar. */
export const bindViewFade = (el: HTMLDivElement | null) => {
  fadeEl = el;
};
export function setViewFade(dark: number): void {
  if (fadeEl) fadeEl.style.opacity = dark > 0.001 ? dark.toFixed(3) : "0";
}
