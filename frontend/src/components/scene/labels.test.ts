import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { screenPoint } from "./labels";

const WIDTH = 1280;
const HEIGHT = 720;
const TARGET = new THREE.Vector3(-1, 0, 0.6);
/** A machine a few metres from the middle of the view, with a label above it. */
const ANCHOR = new THREE.Vector3(6, 1.8, -3);

/** A camera like the game's: orthographic at 30 pixels to the metre, looking at the target from `yaw` radians round. */
function cameraAt(yaw: number, zoom = 30) {
  const camera = new THREE.OrthographicCamera(-WIDTH / 2, WIDTH / 2, HEIGHT / 2, -HEIGHT / 2, 0.1, 600);
  camera.zoom = zoom;
  camera.updateProjectionMatrix();
  camera.position.copy(TARGET).add(new THREE.Vector3(20, 18, 20).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
  camera.lookAt(TARGET);
  return camera;
}

/** Where the renderer puts the anchor once it has drawn this camera. */
function drawn(camera: THREE.OrthographicCamera) {
  camera.updateMatrixWorld();
  const p = ANCHOR.clone().project(camera);
  return new THREE.Vector2((p.x * 0.5 + 0.5) * WIDTH, (-p.y * 0.5 + 0.5) * HEIGHT);
}

/** Turn a camera the way the game does between frames: position and aim change, matrices wait for the renderer. */
function turn(camera: THREE.OrthographicCamera, yaw: number) {
  const moved = cameraAt(yaw, camera.zoom);
  camera.position.copy(moved.position);
  camera.lookAt(TARGET);
}

describe("label placement", () => {
  it("puts the target of the view in the middle of the canvas", () => {
    const camera = cameraAt(0.3);
    const at = screenPoint(TARGET, camera, WIDTH, HEIGHT, new THREE.Vector2());
    expect(at.x).toBeCloseTo(WIDTH / 2, 6);
    expect(at.y).toBeCloseTo(HEIGHT / 2, 6);
  });

  it("follows a camera turned since the last render, landing where the renderer will draw the machine", () => {
    const camera = cameraAt(0);
    camera.updateMatrixWorld();
    for (const yaw of [Math.PI / 64, Math.PI / 8, Math.PI / 4, Math.PI]) {
      turn(camera, yaw);
      const expected = drawn(cameraAt(yaw));
      const at = screenPoint(ANCHOR, camera, WIDTH, HEIGHT, new THREE.Vector2());
      expect(at.x).toBeCloseTo(expected.x, 6);
      expect(at.y).toBeCloseTo(expected.y, 6);
    }
  });

  it("follows a camera that was zoomed and panned since the last render", () => {
    const camera = cameraAt(0.5);
    camera.updateMatrixWorld();
    camera.zoom = 45;
    camera.updateProjectionMatrix();
    camera.position.x += 2;
    camera.position.z -= 1.5;
    const expected = drawn(camera.clone());
    const at = screenPoint(ANCHOR, camera, WIDTH, HEIGHT, new THREE.Vector2());
    expect(at.x).toBeCloseTo(expected.x, 6);
    expect(at.y).toBeCloseTo(expected.y, 6);
  });

  it("is what separates a steady label from one a frame behind: projecting without it misses by pixels", () => {
    const camera = cameraAt(0);
    camera.updateMatrixWorld();
    // An eighth of a turn eased at 16% a frame starts at about 7 degrees.
    const step = (Math.PI / 4) * 0.16;
    turn(camera, step);
    const expected = drawn(cameraAt(step));

    const stale = ANCHOR.clone().project(camera);
    const staleAt = new THREE.Vector2((stale.x * 0.5 + 0.5) * WIDTH, (-stale.y * 0.5 + 0.5) * HEIGHT);
    expect(staleAt.distanceTo(expected)).toBeGreaterThan(10);

    const at = screenPoint(ANCHOR, camera, WIDTH, HEIGHT, new THREE.Vector2());
    expect(at.distanceTo(expected)).toBeLessThan(1e-6);
  });
});
