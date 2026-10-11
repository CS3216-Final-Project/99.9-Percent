import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CAMERA_DISTANCE, CAMERA_FAR, CAMERA_NEAR, MIN_TILT, MAX_TILT, turnAbout } from "./camera";
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

describe("turning the camera", () => {
  const towards = (camera: THREE.Camera, target: THREE.Vector3) => target.clone().sub(camera.position).normalize();
  const yaws = [0, Math.PI / 4, -Math.PI / 4, Math.PI, 2.6];

  it("holds the anchor at the same place on screen through turns and tilts", () => {
    const anchor = new THREE.Vector3(-2.4, 1.1, 1.3);
    for (const [tilt, nextTilt] of [[Math.PI / 4, Math.PI / 4], [MIN_TILT, MAX_TILT], [MAX_TILT, 0.7]]) {
      for (const yaw of yaws) {
        const target = new THREE.Vector3(-1, 0, 0.6);
        const before = cameraAt(target, tilt, yaw);
        const turned = turnAbout(target.clone(), anchor, towards(before, target), towards(cameraAt(target, nextTilt, yaw + Math.PI / 4), target));
        expect(turned.y).toBeCloseTo(0, 10);
        const after = cameraAt(turned, nextTilt, yaw + Math.PI / 4);
        const a = anchor.clone().project(before);
        const b = anchor.clone().project(after);
        expect(b.x).toBeCloseTo(a.x, 10);
        expect(b.y).toBeCloseTo(a.y, 10);
      }
    }
  });

  it("turns about the middle of the screen when the anchor is the floor point in view", () => {
    for (const yaw of yaws) {
      const target = new THREE.Vector3(3, 0, -2);
      const from = towards(cameraAt(target, 0.9, yaw), target);
      const to = towards(cameraAt(target, 0.9, yaw + 1), target);
      const turned = turnAbout(target.clone(), target, from, to);
      expect(turned.distanceTo(target)).toBeCloseTo(0, 10);
    }
  });

  it("keeps a raised anchor in the middle of the screen, which orbiting the floor point beneath it would not", () => {
    // The framing looks at the floor point straight behind the middle of the equipment, as seen from the camera.
    const anchor = new THREE.Vector3(-1, 1.5, 0.6);
    const view = new THREE.Vector3().setFromSphericalCoords(1, Math.PI / 4, Math.PI / 4).negate();
    const target = anchor.clone().addScaledVector(view, -anchor.y / view.y);
    const before = cameraAt(target, Math.PI / 4, Math.PI / 4);
    expect(anchor.clone().project(before).x).toBeCloseTo(0, 10);
    const orbit = cameraAt(target, Math.PI / 4, Math.PI / 2);
    expect(Math.abs(anchor.clone().project(orbit).x)).toBeGreaterThan(0.01);
    const turned = turnAbout(target.clone(), anchor, towards(before, target), towards(orbit, target));
    expect(anchor.clone().project(cameraAt(turned, Math.PI / 4, Math.PI / 2)).x).toBeCloseTo(0, 10);
  });
});
