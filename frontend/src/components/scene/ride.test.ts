import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DOORS, FLOOR_Y, RIDE_SECONDS } from "./levels";
import { arrive, depart, doorsNow, onRide, placeCar, ride, riding, shownFloor, viewHeight, type RideEvent } from "./ride";

describe("the elevator's ride", () => {
  let heard: RideEvent[];
  let stop: () => void;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    placeCar("servers");
    heard = [];
    stop = onRide((e) => heard.push(e));
  });
  afterEach(() => {
    stop();
    placeCar("servers");
    vi.useRealTimers();
  });

  it("stands at its floor with the doors shut before anyone rides", () => {
    expect(riding()).toBe(false);
    expect(shownFloor()).toBe("servers");
    expect(viewHeight()).toBe(FLOOR_Y.servers);
    expect(doorsNow("servers")).toBe(0);
  });

  it("arrives on the clock, however few frames are drawn, gliding the view between the floors", () => {
    depart("office", false);
    expect(heard).toEqual(["depart"]);
    expect(riding()).toBe(true);
    // The floor being left is shown until halfway, and the view is between the two.
    expect(shownFloor()).toBe("servers");
    vi.advanceTimersByTime((RIDE_SECONDS * 1000) / 2 + 10);
    expect(shownFloor()).toBe("office");
    expect(viewHeight()).toBeGreaterThan(FLOOR_Y.servers);
    expect(viewHeight()).toBeLessThan(FLOOR_Y.office);
    vi.advanceTimersByTime((RIDE_SECONDS * 1000) / 2);
    expect(heard).toEqual(["depart", "arrive"]);
    expect(riding()).toBe(false);
    expect(viewHeight()).toBe(FLOOR_Y.office);
    // The doors open where the car stands, and only there, then close.
    vi.advanceTimersByTime(DOORS.move * 1000 + 50);
    expect(doorsNow("office")).toBe(1);
    expect(doorsNow("servers")).toBe(0);
    vi.advanceTimersByTime((DOORS.hold + DOORS.move) * 1000);
    expect(doorsNow("office")).toBe(0);
  });

  it("is skipped by a later click or key, but not by the press that set it off", () => {
    depart("office", false);
    window.dispatchEvent(new Event("pointerdown"));
    expect(riding()).toBe(true);
    vi.advanceTimersByTime(1);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageUp", repeat: true }));
    expect(riding()).toBe(true);
    window.dispatchEvent(new Event("pointerdown"));
    expect(riding()).toBe(false);
    expect(heard).toEqual(["depart", "arrive"]);
    // Arriving twice is still arriving once.
    arrive();
    vi.advanceTimersByTime(RIDE_SECONDS * 1000);
    expect(heard).toEqual(["depart", "arrive"]);
  });

  it("cuts straight to the floor with reduced motion", () => {
    depart("office", true);
    expect(heard).toEqual(["depart", "arrive"]);
    expect(riding()).toBe(false);
    expect(viewHeight()).toBe(FLOOR_Y.office);
  });

  it("closes the doors it leaves, and turns round from where it is", () => {
    depart("office", true);
    vi.advanceTimersByTime(DOORS.move * 1000 + 50);
    expect(doorsNow("office")).toBe(1);
    depart("servers", false);
    expect(doorsNow("office")).toBeGreaterThan(0.9);
    vi.advanceTimersByTime(DOORS.move * 1000 + 50);
    expect(doorsNow("office")).toBe(0);
    // Halfway down, the player asks for the office again: the view carries on from its height, with no jump.
    vi.advanceTimersByTime((RIDE_SECONDS / 2) * 1000 - DOORS.move * 1000);
    const midway = viewHeight();
    ride.y = midway;
    depart("office", false);
    expect(ride.from).toBe("servers");
    expect(viewHeight()).toBeCloseTo(midway, 5);
  });
});
