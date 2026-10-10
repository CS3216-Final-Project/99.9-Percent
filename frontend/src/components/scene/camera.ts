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
