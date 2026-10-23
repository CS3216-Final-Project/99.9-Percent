import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DOORS, FLOOR_Y, HURRY_SECONDS, RIDE_SECONDS } from "./levels";
import { arrive, depart, doorsNow, hurry, onRide, placeCar, ride, riding, shownFloor, viewHeight, type RideEvent } from "./ride";

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

  it("is hurried along by a later click or key, but not by the press that set it off", () => {
    depart("office", false);
    window.dispatchEvent(new Event("pointerdown"));
    expect(ride.rate).toBe(1);
    vi.advanceTimersByTime(1);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageUp", repeat: true }));
    expect(ride.rate).toBe(1);
    // A second in, the player clicks: the car carries on from where it is, faster, and arrives within HURRY_SECONDS.
    vi.advanceTimersByTime(1000);
    const before = viewHeight();
    window.dispatchEvent(new Event("pointerdown"));
    expect(riding()).toBe(true);
    expect(viewHeight()).toBeCloseTo(before, 5);
    expect(ride.rate).toBeGreaterThan(1);
    vi.advanceTimersByTime(HURRY_SECONDS * 1000 + 10);
    expect(riding()).toBe(false);
    expect(heard).toEqual(["depart", "arrive"]);
    // Arriving twice is still arriving once.
    arrive();
    vi.advanceTimersByTime(RIDE_SECONDS * 1000);
    expect(heard).toEqual(["depart", "arrive"]);
  });

  it("never slows the car by hurrying it: hurried twice it keeps its pace, and with little left it needs none", () => {
    depart("office", false);
    vi.advanceTimersByTime(1000);
    hurry();
    const rate = ride.rate;
    expect(rate).toBeCloseTo((RIDE_SECONDS - 1) / HURRY_SECONDS, 5);
    vi.advanceTimersByTime(HURRY_SECONDS * 500);
    hurry();
    expect(ride.rate).toBe(rate);
    vi.advanceTimersByTime(HURRY_SECONDS * 500 + 10);
    expect(riding()).toBe(false);
    // Only 0.2 s left: already quicker than a hurry, so nothing changes.
    placeCar("servers");
    depart("office", false);
    vi.advanceTimersByTime(RIDE_SECONDS * 1000 - 200);
    hurry();
    expect(ride.rate).toBe(1);
    vi.advanceTimersByTime(210);
    expect(riding()).toBe(false);
  });

  it("runs its whole course with the avatar aboard, whatever is pressed on the way", () => {
    depart("office", false, false);
    vi.advanceTimersByTime(1000);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space" }));
    window.dispatchEvent(new Event("pointerdown"));
    vi.advanceTimersByTime(1000);
    expect(riding()).toBe(true);
    vi.advanceTimersByTime(RIDE_SECONDS * 1000 - 2000);
    expect(riding()).toBe(false);
    expect(heard).toEqual(["depart", "arrive"]);
  });

  it("cuts straight to the floor when asked to, and says so until the next ride", () => {
    const cut: boolean[] = [];
    const stopCut = onRide(() => cut.push(ride.cut));
    depart("office", true);
    expect(heard).toEqual(["depart", "arrive"]);
    expect(cut).toEqual([true, true]);
    expect(riding()).toBe(false);
    expect(viewHeight()).toBe(FLOOR_Y.office);
    depart("servers", false);
    expect(ride.cut).toBe(false);
    vi.advanceTimersByTime(RIDE_SECONDS * 1000 + 10);
    expect(cut).toEqual([true, true, false, false]);
    depart("office", true);
    placeCar("servers");
    expect(ride.cut).toBe(false);
    stopCut();
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
