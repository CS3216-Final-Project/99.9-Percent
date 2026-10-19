import { describe, expect, it } from "vitest";
import { clampFov, FOV, fromAvatar, isViewpoint, nextViewpoint, VIEWPOINTS } from "./viewpoints";

describe("the views", () => {
  it("go round in order with the V key", () => {
    expect(nextViewpoint("overview")).toBe("follow");
    expect(nextViewpoint("follow")).toBe("first");
    expect(nextViewpoint("first")).toBe("overview");
  });

  it("need walk mode only when they look from the avatar", () => {
    expect(VIEWPOINTS.filter(fromAvatar)).toEqual(["follow", "first"]);
  });

  it("recognise only their own names", () => {
    for (const v of VIEWPOINTS) expect(isViewpoint(v)).toBe(true);
    for (const v of ["", "First", "top", null, 3, undefined]) expect(isViewpoint(v)).toBe(false);
  });
});

describe("the first-person field of view", () => {
  it("is kept in range and whole, and anything that is not a number is the default", () => {
    expect(clampFov(80)).toBe(80);
    expect(clampFov(10)).toBe(FOV.min);
    expect(clampFov(200)).toBe(FOV.max);
    expect(clampFov(77.6)).toBe(78);
    for (const v of [Number.NaN, Infinity, "80", null, undefined]) expect(clampFov(v)).toBe(FOV.initial);
  });
});
