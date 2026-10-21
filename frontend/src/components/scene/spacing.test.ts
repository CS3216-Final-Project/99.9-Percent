import { describe, expect, it } from "vitest";
import { makeWorld } from "./navgrid";
import { apart, clearOf, intrudes, sidestep, sweptIntrudes } from "./spacing";

describe("body spacing", () => {
  it("allows retreat from contact but not an approach", () => {
    const bodies = [{ x: 0, z: 0, r: 0.3 }];
    expect(intrudes(bodies, 0.3, 0.7, 0, 0.8, 0)).toBe(false);
    expect(intrudes(bodies, 0.3, 0.7, 0, 0.6, 0)).toBe(true);
    expect(intrudes(bodies, 0.3, 1, 0, 0.7, 0)).toBe(true);
    expect(intrudes(bodies, 0.3, 0.7, 0, 0.7, 0.1)).toBe(false);
  });

  it("requires room around both radii and the gap", () => {
    const bodies = [{ x: 0, z: 0, r: 0.3 }];
    expect(clearOf(bodies, 0.3, 0.719, 0)).toBe(false);
    expect(clearOf(bodies, 0.3, 0.72, 0)).toBe(true);
    expect(clearOf(bodies, 0.3, 0.721, 0)).toBe(true);
    expect(clearOf([], 0.4, 0, 0)).toBe(true);
  });

  it("blocks a step that sweeps through a body while allowing retreat", () => {
    const bodies = [{ x: 0, z: 0, r: 0.3 }];
    expect(sweptIntrudes(bodies, 0.3, -1, 0, 1, 0)).toBe(true);
    expect(sweptIntrudes(bodies, 0.3, 0.5, 0, 1, 0)).toBe(false);
  });

  it("tries the right side first, then the left, and respects walls", () => {
    const world = makeWorld([], []);
    expect(sidestep(world, [], 0.3, 0, 0, 0, 0.2)).toEqual([0.2, 0]);
    expect(sidestep(world, [{ x: 0.2, z: 0, r: 0.3 }], 0.3, 0, 0, 0, 0.2)).toEqual([-0.2, 0]);

    const wall = makeWorld([[0, -2, 0, 2]], []);
    expect(sidestep(wall, [], 0.3, -0.4, 0, 0, 0.2)?.[0]).toBeCloseTo(-0.6);
  });

  it("moves out of overlap through the wall-aware slide and leaves clear positions alone", () => {
    const world = makeWorld([], []);
    expect(apart(world, [{ x: 0, z: 0, r: 0.3 }], 0.3, 0.5, 0, 0.1)[0]).toBeGreaterThan(0.5);
    expect(apart(world, [{ x: 0, z: 0, r: 0.3 }], 0.3, 0.9, 0, 0.1)).toEqual([0.9, 0]);
    const wall = makeWorld([[0.8, -2, 0.8, 2]], []);
    const moved = apart(wall, [{ x: 0, z: 0, r: 0.3 }], 0.3, 0.5, 0, 0.1);
    expect(moved[0]).toBeLessThan(0.8);
  });
});
