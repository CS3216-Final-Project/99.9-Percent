import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { LABEL_GAP, LABEL_TAIL, screenPoint, stackDown, stackUnder, type LabelSpot } from "./labels";

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

  it("packs stacked labels tight: each clears the one above only by a tail and a gap", () => {
    // Coincident anchors must fan out; the spacing is exactly a tail plus a gap, no dead space.
    for (const heights of [[34, 34, 34, 23], [23], [40, 23, 34, 34, 45, 30, 34, 23]]) {
      const spots = heights.map((h) => ({ x: 0, y: 0, w: 100, h }));
      const outs = stackDown(spots, -10);
      expect(outs[0]).toBe(-10);
      for (let i = 1; i < heights.length; i++) {
        expect(outs[i] - heights[i]).toBe(outs[i - 1] + LABEL_TAIL + LABEL_GAP);
      }
    }
    expect(stackDown([], -10)).toEqual([]);
  });

  it("leaves labels whose marks never overlap on their own spots", () => {
    // Machines a stretch apart project pills that miss each other; stacking them wastes the room.
    const spots = [100, 240, 380, 520].map((x, i) => ({ x, y: 200 + i * 20, w: 120, h: 34 }));
    expect(stackDown(spots, -10)).toEqual([190, 210, 230, 250]);
  });

  it("lets a label keep its spot once the stack above stops overlapping it", () => {
    // The second app column's anchors sit below and clear of the first column's labels.
    const spots = [
      { x: 100, y: 100, w: 120, h: 34 },
      { x: 128, y: 115, w: 120, h: 34 },
      { x: 500, y: 400, w: 120, h: 34 },
    ];
    const outs = stackDown(spots, -10);
    expect(outs[0]).toBe(90);
    expect(outs[1]).toBe(90 + 34 + LABEL_TAIL + LABEL_GAP);
    expect(outs[2]).toBe(390);
  });

  it("keeps every label clear of every earlier label it overlaps, at small and large counts", () => {
    const cases: LabelSpot[][] = [
      Array.from({ length: 12 }, () => ({ x: 0, y: 0, w: 130, h: 57 })),
      // Office rows: each next anchor steps right and down but its pill still meets the neighbours'.
      Array.from({ length: 6 }, (_, i) => ({ x: 700 + i * 28, y: 180 + i * 15, w: 130, h: i % 3 ? 34 : 57 })),
      // A second column interleaved with the first, plus one far clear of both.
      [
        ...Array.from({ length: 6 }, (_, i) => ({ x: 700 + i * 28, y: 180 + i * 15, w: 130, h: 34 })),
        ...Array.from({ length: 6 }, (_, i) => ({ x: 560 + i * 28, y: 400 + i * 15, w: 130, h: 57 })),
        { x: 100, y: 600, w: 130, h: 34 },
      ],
    ];
    for (const spots of cases) {
      const outs = stackDown(spots, -10);
      for (let i = 0; i < spots.length; i++) {
        for (let j = 0; j < i; j++) {
          if (Math.abs(spots[j].x - spots[i].x) < (spots[j].w + spots[i].w) / 2) {
            expect(outs[i] - spots[i].h).toBeGreaterThanOrEqual(outs[j] + LABEL_TAIL + LABEL_GAP);
          }
        }
      }
    }
  });

  it("stacks labels under a ceiling with the same clearance", () => {
    const heights = [34, 34, 23];
    const out = stackUnder(heights, 300);
    expect(out[2]).toBe(300);
    for (let i = heights.length - 2; i >= 0; i--) {
      expect(out[i] + LABEL_TAIL + LABEL_GAP).toBeLessThanOrEqual(out[i + 1] - heights[i + 1]);
    }
    expect(stackUnder([], 300)).toEqual([]);
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
