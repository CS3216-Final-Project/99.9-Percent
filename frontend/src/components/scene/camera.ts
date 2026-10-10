import * as THREE from "three";
import { REACH } from "./city";

// Orthographic framing depends on zoom, not distance. Stand outside the whole
// city so its foreground roofs and walls cannot cross the near clipping plane
// as the player pans, rotates or tilts. Leave the same reach behind the target.
export const CAMERA_DISTANCE = 2 * REACH;
export const CAMERA_FAR = 2 * CAMERA_DISTANCE;
export const CAMERA_NEAR = 0.1;

/** Tilt measured from straight down: nearly top-down to a low three-quarter view. */
export const MIN_TILT = 0.22;
export const MAX_TILT = 1.2;

const UP = new THREE.Vector3(0, 1, 0);
const right = new THREE.Vector3();
const up = new THREE.Vector3();
const offset = new THREE.Vector3();

/** Screen axes of an orthographic view looking along `dir`. */
function screenAxes(dir: THREE.Vector3): void {
  right.crossVectors(dir, UP).normalize();
  up.crossVectors(right, dir).normalize();
}

/**
 * Moves the floor point the camera looks at so that `anchor` stays at the same place on screen when the view
 * direction turns from `from` to `to`. Both directions point from the camera into the scene.
 */
export function turnAbout(target: THREE.Vector3, anchor: THREE.Vector3, from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3 {
  screenAxes(from);
  offset.copy(anchor).sub(target);
  const x = offset.dot(right);
  const y = offset.dot(up);
  screenAxes(to);
  target.copy(anchor).addScaledVector(right, -x).addScaledVector(up, -y);
  // Slide along the new view direction back onto the floor.
  return target.addScaledVector(to, -target.y / to.y);
}
