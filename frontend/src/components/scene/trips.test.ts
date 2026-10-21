import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DOORS, FLOOR_Y, RIDE_SECONDS } from "./levels";
import { depart, now, placeCar } from "./ride";
import { carDoors, carIndicator, carStandsAt, carY, errandNow, holdDoors, onErrandEnd, sendCar, settleErrand, STOP, stepErrand, resetErrands, type Errand } from "./trips";

describe("the car's errands", () => {
  let ended: Errand[];
  let stop: () => void;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    placeCar("office");
    resetErrands();
    ended = [];
    stop = onErrandEnd((e) => ended.push({ ...e }));
  });
  afterEach(() => {
    stop();
    resetErrands();
    placeCar("servers");
    vi.useRealTimers();
  });

  /** Step the errand along for `seconds`, a tenth of a second at a time. */
  const run = (seconds: number, settled = () => true) => {
    for (let i = 0; i < seconds * 10; i++) {
      vi.advanceTimersByTime(100);
      stepErrand(settled);
    }
  };

  it("opens the doors where the car rests for whoever calls it, and keeps them open while someone gets on", () => {
    expect(carDoors("office")).toBe(0);
    holdDoors("office");
    run(DOORS.move + 0.1);
    expect(carDoors("office")).toBe(1);
    // Kept open past the usual hold while called again.
    for (let i = 0; i < 50; i++) {
      vi.advanceTimersByTime(100);
      holdDoors("office");
    }
    expect(carDoors("office")).toBe(1);
    run(DOORS.hold + 2 * DOORS.move + 0.2);
    expect(carDoors("office")).toBe(0);
    // A call for a floor the car is not at does nothing.
    holdDoors("servers");
    expect(carDoors("servers")).toBe(0);
  });

  it("goes to the other floor and back: doors shut, out, a stop with its doors open, back, and the doors open at home", () => {
    expect(sendCar()).toBe(true);
    expect(sendCar()).toBe(false);
    run(DOORS.move + 0.05);
    expect(errandNow()?.phase).toBe("out");
    expect(carStandsAt()).toBeNull();
    expect(carIndicator().arrow).toBe("down");
    run(RIDE_SECONDS);
    expect(errandNow()?.phase).toBe("stop");
    expect(carY()).toBe(FLOOR_Y.servers);
    expect(carStandsAt()).toBe("servers");
    run(DOORS.move + 0.1);
    expect(carDoors("servers")).toBe(1);
    expect(carDoors("office")).toBe(0);
    run(STOP.least + DOORS.move + 0.3);
    expect(errandNow()?.phase).toBe("back");
    expect(carIndicator().arrow).toBe("up");
    run(RIDE_SECONDS);
    expect(errandNow()?.phase).toBe("home");
    expect(carY()).toBe(FLOOR_Y.office);
    run(DOORS.move + 0.1);
    expect(carDoors("office")).toBe(1);
    run(DOORS.hold + DOORS.move + 0.2);
    expect(errandNow()).toBeNull();
    expect(ended.map((e) => e.away)).toEqual(["servers"]);
  });

  it("waits at the far floor while someone is still getting on or off, but not for ever", () => {
    sendCar();
    run(DOORS.move + RIDE_SECONDS + 0.2);
    expect(errandNow()?.phase).toBe("stop");
    run(STOP.most - 1, () => false);
    expect(errandNow()?.phase).toBe("stop");
    expect(carDoors("servers")).toBe(1);
    run(1 + DOORS.move + 0.2, () => false);
    expect(errandNow()?.phase).toBe("back");
  });

  it("reports the supplied completion time even when the page clock has not advanced", () => {
    const listener = vi.fn();
    const unsubscribe = onErrandEnd(listener);
    try {
      sendCar(100);
      stepErrand(() => true, 101);
      stepErrand(() => true, 101 + RIDE_SECONDS);
      stepErrand(() => true, 110);
      stepErrand(() => true, 111);
      stepErrand(() => true, 111 + RIDE_SECONDS);
      stepErrand(() => true, 120);
      expect(errandNow()).toBeNull();
      expect(listener).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ phase: "home" }), 120);
      expect(now()).toBe(0);
    } finally {
      unsubscribe();
    }
  });
  it("ends at once, the car home, when the player's ride sets off", () => {
    sendCar();
    run(DOORS.move + RIDE_SECONDS / 2);
    expect(carY()).toBeLessThan(FLOOR_Y.office);
    settleErrand();
    depart("servers", false);
    expect(errandNow()).toBeNull();
    expect(ended).toHaveLength(1);
    // The player's ride now has the car: it leaves from home, as the view does.
    expect(carY()).toBe(FLOOR_Y.office);
    expect(carStandsAt()).toBeNull();
    expect(sendCar()).toBe(false);
    void now;
  });
});
