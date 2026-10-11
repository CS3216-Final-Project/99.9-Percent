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
