import type * as THREE from "three";

/* Which walls stand at full height, given the direction the camera looks in. */

export type WallId = "back" | "left" | "front" | "right";

/** Unit vector on the floor pointing from each wall into the room. */
const INWARD: Record<WallId, [number, number]> = { back: [0, 1], left: [1, 0], front: [0, -1], right: [-1, 0] };

/** Which walls stand at full height. Starts as the default view: looking at the back and left walls. */
export const wallUp: Record<WallId, boolean> = { back: true, left: true, front: false, right: false };

/** Call every frame with the direction the camera looks in. */
export function updateWalls(view: THREE.Vector3): void {
  for (const id of Object.keys(INWARD) as WallId[]) {
    const [x, z] = INWARD[id];
    const facing = view.x * x + view.z * z;
    // Looking at a wall's inner face means it stands behind the room. The margin stops flicker when side-on.
    if (facing < -0.08) wallUp[id] = true;
    else if (facing > 0.08) wallUp[id] = false;
  }
}
