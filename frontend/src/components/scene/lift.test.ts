import { describe, expect, it } from "vitest";
import { ELEVATOR_DOOR, ELEVATOR_SPOT } from "./floorplan";
import { FLOOR_Y } from "./levels";
import { ROOM } from "./layout";
import {
  aroundShaft,
  CABIN,
  cableLength,
  cableLoop,
  carTop,
  clipSpan,
  COUNTERWEIGHT,
  counterweightFoot,
  PIT,
  RAILS,
  RIDER_SPOTS,
  ROPE_LINES,
  SHAFT_SPAN,
  SHEAVE,
  SLAB,
  TRAVELLING,
  visibleBand,
} from "./lift";
import { CAR } from "./walk";

const [SX0, SZ0, SX1, SZ1] = ELEVATOR_SPOT;
const ends = [FLOOR_Y.servers, (FLOOR_Y.servers + FLOOR_Y.office) / 2, FLOOR_Y.office];

describe("the elevator's working parts", () => {
  it("fit the car inside the shaft, clear of the counterweight behind it, with its doors in line with the landing's", () => {
    expect(CABIN.x0).toBeGreaterThan(SX0);
    expect(CABIN.x1).toBeLessThan(SX1);
    expect(CABIN.z0).toBeGreaterThan(SZ0);
    expect(CABIN.z1).toBeLessThan(SZ1);
    expect(COUNTERWEIGHT.x + COUNTERWEIGHT.w / 2).toBeLessThan(CABIN.x0);
    expect(COUNTERWEIGHT.x - COUNTERWEIGHT.w / 2).toBeGreaterThan(SX0);
    const door = ELEVATOR_DOOR.z;
    expect(door - ELEVATOR_DOOR.w / 2).toBeGreaterThanOrEqual(CABIN.z0);
    expect(door + ELEVATOR_DOOR.w / 2).toBeLessThanOrEqual(CABIN.z1);
  });

  it("have room in the car for whoever rides: the avatar in the middle and the others in the corners, all apart", () => {
    const all = [CAR, ...RIDER_SPOTS];
    for (const [x, z] of all) {
      expect(x).toBeGreaterThan(CABIN.x0 + 0.25);
      expect(x).toBeLessThan(CABIN.x1 - 0.25);
      expect(z).toBeGreaterThan(CABIN.z0 + 0.25);
      expect(z).toBeLessThan(CABIN.z1 - 0.25);
    }
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) expect(Math.hypot(all[i][0] - all[j][0], all[i][1] - all[j][1])).toBeGreaterThan(0.55);
  });

  it("lower the counterweight a metre for every metre the car rises, and keep it between the pit and the sheave", () => {
    expect(counterweightFoot(FLOOR_Y.office) - counterweightFoot(FLOOR_Y.servers)).toBeCloseTo(FLOOR_Y.servers - FLOOR_Y.office, 9);
    for (const y of ends) {
      expect(counterweightFoot(y)).toBeGreaterThan(SHAFT_SPAN.bottom + 0.3);
      expect(counterweightFoot(y) + COUNTERWEIGHT.h).toBeLessThan(SHEAVE.y - SHEAVE.r);
    }
  });

  it("hang the car's ropes and the counterweight's from either side of the sheave, below it at every height", () => {
    expect(ROPE_LINES.car - ROPE_LINES.counterweight).toBeCloseTo(2 * SHEAVE.r, 9);
    expect(SHEAVE.y + SHEAVE.r).toBeLessThan(SHAFT_SPAN.top);
    for (const y of ends) expect(carTop(y)).toBeLessThan(SHEAVE.y);
    expect(ROPE_LINES.z).toHaveLength(4);
    expect(ROPE_LINES.car).toBeGreaterThan(CABIN.x0);
  });

  it("keep the travelling cable one length, its loop under the car and above the pit's floor", () => {
    const length = cableLength(FLOOR_Y.office);
    for (const y of [...ends, -1.3, -3.1]) {
      expect(cableLength(y)).toBeCloseTo(length, 9);
      expect(cableLoop(y)).toBeLessThan(y - CABIN.floor);
      expect(cableLoop(y)).toBeLessThan(TRAVELLING.anchor);
      expect(cableLoop(y) - TRAVELLING.r).toBeGreaterThan(FLOOR_Y.servers - PIT.depth);
    }
    expect(TRAVELLING.x.car).toBeGreaterThan(CABIN.x0);
    expect(TRAVELLING.x.car - TRAVELLING.x.wall).toBeCloseTo(2 * TRAVELLING.r, 9);
  });

  it("stand every rail inside the shaft", () => {
    for (const [x, z] of [...RAILS.car, ...RAILS.counterweight]) {
      expect(x).toBeGreaterThan(SX0);
      expect(x).toBeLessThan(SX1);
      expect(z).toBeGreaterThan(SZ0);
      expect(z).toBeLessThan(SZ1);
    }
  });

  it("show only the floor in view's part of the shaft, from its slab or pit to its ceiling, or the whole shaft riding between", () => {
    expect(visibleBand("office")).toEqual([FLOOR_Y.office - SLAB, FLOOR_Y.office + 3.4]);
    expect(visibleBand("servers")[0]).toBeCloseTo(FLOOR_Y.servers - PIT.depth, 9);
    expect(visibleBand("servers")[1]).toBeCloseTo(FLOOR_Y.office - SLAB, 9);
    expect(visibleBand("both")).toEqual([SHAFT_SPAN.bottom, SHAFT_SPAN.top]);
    expect(SLAB).toBeGreaterThan(0);
  });

  it("clip a run up the shaft to what can be seen", () => {
    expect(clipSpan(-3, 2, -0.6, 3.4)).toEqual([-0.6, 2]);
    expect(clipSpan(1, 2, -0.6, 3.4)).toEqual([1, 2]);
    expect(clipSpan(-4, -1, -0.6, 3.4)).toBeNull();
  });
});

describe("the floor round the shaft", () => {
  it("covers the whole room but the shaft, without overlapping itself", () => {
    const pieces = aroundShaft(0.25);
    const area = pieces.reduce((sum, [x0, z0, x1, z1]) => sum + (x1 - x0) * (z1 - z0), 0);
    const [sx0, sz0, sx1, sz1] = ELEVATOR_SPOT;
    expect(area).toBeCloseTo((ROOM.w + 0.5) * (ROOM.d + 0.5) - (sx1 - sx0) * (sz1 - sz0), 9);
    for (const [x0, z0, x1, z1] of pieces) {
      expect(x1).toBeGreaterThan(x0);
      expect(z1).toBeGreaterThan(z0);
      // None reaches into the shaft.
      const overlapX = Math.min(x1, sx1) - Math.max(x0, sx0);
      const overlapZ = Math.min(z1, sz1) - Math.max(z0, sz0);
      expect(overlapX > 1e-9 && overlapZ > 1e-9).toBe(false);
    }
  });
});
