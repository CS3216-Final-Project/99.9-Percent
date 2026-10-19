import { describe, expect, it } from "vitest";
import { clampLookSpeed, controlsOf, DEFAULT_CONTROLS, LOOK_SPEED } from "./controls";

describe("the look controls", () => {
  it("keep the look speed in range and on its step, and anything that is not a number at the usual", () => {
    expect(clampLookSpeed(1)).toBe(1);
    expect(clampLookSpeed(0.62)).toBe(0.6);
    expect(clampLookSpeed(0.01)).toBe(LOOK_SPEED.min);
    expect(clampLookSpeed(9)).toBe(LOOK_SPEED.max);
    for (const v of [Number.NaN, Infinity, "1", null, undefined]) expect(clampLookSpeed(v)).toBe(LOOK_SPEED.initial);
  });

  it("read what was stored, and fall back field by field for anything missing or wrong", () => {
    expect(controlsOf({ lookSpeed: 0.5, invertY: true })).toEqual({ lookSpeed: 0.5, invertY: true });
    expect(controlsOf({ lookSpeed: 0.5 })).toEqual({ lookSpeed: 0.5, invertY: false });
    expect(controlsOf({ invertY: "yes" })).toEqual(DEFAULT_CONTROLS);
    for (const v of [null, 7, "x", undefined]) expect(controlsOf(v)).toEqual(DEFAULT_CONTROLS);
  });
});
