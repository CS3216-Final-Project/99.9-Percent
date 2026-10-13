import { describe, expect, it } from "vitest";
import { STOREY } from "./city";
import { DIP, DOORS, doorsAt, FLOOR_NUMBER, FLOOR_Y, RIDE_SECONDS, rideAt } from "./levels";

describe("the floors' heights", () => {
  it("stand the server floor one storey below the office, a floor lower on the indicator", () => {
    expect(FLOOR_Y.office).toBe(0);
    expect(FLOOR_Y.servers).toBe(-STOREY);
    expect(FLOOR_NUMBER.office - FLOOR_NUMBER.servers).toBe(1);
  });
});

describe("an elevator ride", () => {
  const samples = Array.from({ length: 61 }, (_, i) => rideAt((i / 60) * RIDE_SECONDS));

  it("eases the car from one floor to the other, never backwards", () => {
    expect(rideAt(0).car).toBe(0);
    expect(rideAt(RIDE_SECONDS).car).toBe(1);
    for (let i = 1; i < samples.length; i++) expect(samples[i].car).toBeGreaterThanOrEqual(samples[i - 1].car);
    // Easing in and out: slow at the ends, fast in the middle.
    expect(rideAt(RIDE_SECONDS * 0.1).car).toBeLessThan(0.1);
    expect(rideAt(RIDE_SECONDS * 0.6).car - rideAt(RIDE_SECONDS * 0.4).car).toBeGreaterThan(0.2);
  });

  it("dips the view deepest halfway, where the floors change places, and not at all at either end", () => {
    expect(rideAt(RIDE_SECONDS / 2).dip).toBeCloseTo(DIP.most);
    expect(rideAt(0).dip).toBe(0);
    expect(rideAt(RIDE_SECONDS).dip).toBe(0);
    expect(Math.max(...samples.map((s) => s.dip))).toBeCloseTo(DIP.most);
    expect(rideAt(RIDE_SECONDS * 0.49).arrived).toBe(false);
    expect(rideAt(RIDE_SECONDS * 0.5).arrived).toBe(true);
  });

  it("stays put before it starts and after it ends", () => {
    expect(rideAt(-1)).toEqual(rideAt(0));
    expect(rideAt(RIDE_SECONDS * 5)).toEqual(rideAt(RIDE_SECONDS));
  });
});

describe("the elevator's doors", () => {
  it("stay shut until the car arrives, or when it never has", () => {
    expect(doorsAt(-0.5)).toBe(0);
    expect(doorsAt(-Infinity)).toBe(0);
    expect(doorsAt(Infinity)).toBe(0);
    expect(doorsAt(Number.NaN)).toBe(0);
  });

  it("slide open, stand open a while, then close again", () => {
    expect(doorsAt(0)).toBe(0);
    expect(doorsAt(DOORS.move / 2)).toBeGreaterThan(0);
    expect(doorsAt(DOORS.move / 2)).toBeLessThan(1);
    expect(doorsAt(DOORS.move)).toBe(1);
    expect(doorsAt(DOORS.move + DOORS.hold - 0.01)).toBe(1);
    expect(doorsAt(DOORS.move + DOORS.hold + DOORS.move / 2)).toBeLessThan(1);
    expect(doorsAt(2 * DOORS.move + DOORS.hold)).toBe(0);
  });
});
