import * as THREE from "three";

const ndc = new THREE.Vector3();

/**
 * Where a point in the room appears on a canvas of this size, in pixels from its top-left corner, with the camera
 * exactly as it stands now.
 *
 * Moving a camera only changes its position and orientation. Its view matrix is refreshed when the renderer draws, so
 * until then `project` still answers for the previous frame. Refresh it first, or anything placed from this answer
 * trails the picture by a frame while the camera moves.
 */
export function screenPoint(point: THREE.Vector3, camera: THREE.Camera, width: number, height: number, out: THREE.Vector2): THREE.Vector2 {
  camera.updateMatrixWorld();
  ndc.copy(point).project(camera);
  return out.set((ndc.x * 0.5 + 0.5) * width, (-ndc.y * 0.5 + 0.5) * height);
}

/** Pixels a label's marker tail reaches below its anchor point (the ::after triangle under the pill). */
export const LABEL_TAIL = 9;
/** Breathing room between two labels stacked on the same machine. */
export const LABEL_GAP = 4;

/**
 * Y offsets that fan a row of anchored labels out downward so no two cover each other, given each label's real
 * height: the first keeps `first`, and every next one starts clear of the label above plus its tail. Works for any
 * count, and for labels of mixed heights (a status note or a load bar makes one taller than another).
 */
export function stackDown(heights: number[], first = 0): number[] {
  const out = [first];
  for (let i = 1; i < heights.length; i++) out.push(out[i - 1] + heights[i] + LABEL_TAIL + LABEL_GAP);
  return out;
}

/** Same idea under a ceiling the labels must stay above: the last label sits at `ceiling`, each earlier one above it. */
export function stackUnder(heights: number[], ceiling: number): number[] {
  const out = new Array<number>(heights.length);
  if (heights.length) out[heights.length - 1] = ceiling;
  for (let i = heights.length - 2; i >= 0; i--) out[i] = out[i + 1] - heights[i + 1] - LABEL_TAIL - LABEL_GAP;
  return out;
}
