import { describe, expect, it } from "vitest";
import { readingPlace } from "./coachLayout";

// A 390x844 phone: the top strip ends at 60 and the coach strip starts at 600.
const TOP = 60, STRIP = 600, VH = 844;

describe("readingPlace", () => {
  it("fills the space between the top strip and the coach strip when nothing is lit", () => {
    expect(readingPlace(null, TOP, STRIP, VH)).toEqual({ bottom: VH - 592, maxHeight: 592 - 68 });
  });

  it("sits below a lit control near the top, above the strip", () => {
    const place = readingPlace({ x: 0, y: 100, w: 200, h: 40 }, TOP, STRIP, VH);
    expect(place).toEqual({ bottom: VH - 592, maxHeight: 592 - 148 });
  });

  it("sits above a lit control near the strip, never over it", () => {
    const place = readingPlace({ x: 0, y: 420, w: 200, h: 150 }, TOP, STRIP, VH);
    expect(place).toEqual({ bottom: VH - 412, maxHeight: 412 - 68 });
  });

  it("ignores a lit control outside the space, such as Run in the dock", () => {
    expect(readingPlace({ x: 300, y: 700, w: 80, h: 44 }, TOP, STRIP, VH)).toEqual(readingPlace(null, TOP, STRIP, VH));
  });
});
