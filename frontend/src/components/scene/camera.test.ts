import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CAMERA_DISTANCE, CAMERA_FAR, CAMERA_NEAR, MIN_TILT, MAX_TILT } from "./camera";
import { buildings, FADE, GROUND_Y, REACH, ROOF_HEADROOM, TOWER } from "./city";
import { ROOM } from "./layout";

const corners = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
  [x0, x1].flatMap(x => [y0, y1].flatMap(y => [z0, z1].map(z => new THREE.Vector3(x, y, z))));

const city = [...buildings(), TOWER].flatMap(b => b.masses.flatMap(m =>
  corners(m.rect[0], m.rect[2], m.y0, m.y1 + ROOF_HEADROOM, m.rect[1], m.rect[3]),
));
// Include the ground mesh, which extends beyond the streets into the night.
city.push(...corners(FADE.x - REACH - 40, FADE.x + REACH + 40, GROUND_Y, GROUND_Y, FADE.z - REACH - 40, FADE.z + REACH + 40));

function cameraAt(target: THREE.Vector3, tilt: number, yaw: number, distance = CAMERA_DISTANCE, far = CAMERA_FAR) {
  const camera = new THREE.OrthographicCamera(-72, 72, 45, -45, CAMERA_NEAR, far);
  camera.position.copy(target).add(new THREE.Vector3().setFromSphericalCoords(distance, tilt, yaw));
  camera.lookAt(target);
  camera.updateMatrixWorld();
  return camera;
}

describe("city camera clipping", () => {
  it("keeps roofs, facades, roof plant and ground between the clipping planes throughout pan and orbit", () => {
    const targets = corners(ROOM.x0, ROOM.x1, 0, 0, ROOM.z0, ROOM.z1);
    const point = new THREE.Vector3();
    for (const target of targets) {
      for (const tilt of [MIN_TILT, Math.PI / 4, MAX_TILT]) {
        for (let yaw = 0; yaw < 2 * Math.PI; yaw += Math.PI / 8) {
          const camera = cameraAt(target, tilt, yaw);
          let nearest = Infinity;
          let furthest = -Infinity;
          for (const vertex of city) {
            const depth = -point.copy(vertex).applyMatrix4(camera.matrixWorldInverse).z;
            nearest = Math.min(nearest, depth);
            furthest = Math.max(furthest, depth);
          }
          expect(nearest).toBeGreaterThan(camera.near);
          expect(furthest).toBeLessThan(camera.far);
        }
      }
    }
  });

  it("reproduces the old near-plane cut through a foreground building", () => {
    const camera = cameraAt(new THREE.Vector3(ROOM.x1, 0, ROOM.z1), MAX_TILT, Math.PI / 4, 240, 640);
    const sliced = buildings().some(b => b.masses.some(m => {
      const depths = corners(m.rect[0], m.rect[2], m.y0, m.y1, m.rect[1], m.rect[3])
        .map(v => -v.applyMatrix4(camera.matrixWorldInverse).z);
      return Math.min(...depths) < camera.near && Math.max(...depths) > camera.near;
    }));
    expect(sliced).toBe(true);
  });

  it("preserves the orthographic framing when the camera moves back", () => {
    const target = new THREE.Vector3(-1, 0, 0.6);
    const before = cameraAt(target, Math.PI / 4, Math.PI / 4, 240, 640);
    const after = cameraAt(target, Math.PI / 4, Math.PI / 4);
    for (const vertex of city) {
      const a = vertex.clone().project(before);
      const b = vertex.clone().project(after);
      expect(b.x).toBeCloseTo(a.x, 10);
      expect(b.y).toBeCloseTo(a.y, 10);
    }
  });
});
