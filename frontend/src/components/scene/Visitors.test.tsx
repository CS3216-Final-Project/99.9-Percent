import { StrictMode } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Visitors } from "./Visitors";
import { populate, stepVisitors, visitors, type Visitor } from "./crowd";
import { now, placeCar } from "./ride";
import { errandNow, resetErrands, settleErrand } from "./trips";
import { LOBBY, placeAvatar } from "./walk";

vi.mock("@react-three/fiber", () => ({ useFrame: vi.fn() }));
vi.mock("./creatures", () => ({ Creature: () => null }));

describe("the visitor crowd's elevator lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    resetErrands();
    placeCar("office");
    // Keep the real errand-end subscription, including StrictMode's cleanup/remount.
    // No people are drawn in jsdom; populate the arithmetic model after mounting.
    populate(0, 9999);
    render(<StrictMode><Visitors count={0} /></StrictMode>);
    populate(1, 9999);
  });

  afterEach(() => {
    cleanup();
    resetErrands();
    populate(0, 9999);
    placeCar("servers");
    placeAvatar("office");
    vi.useRealTimers();
  });

  function waitOnOtherFloor(): Visitor {
    const v = visitors()[0];
    Object.assign(v, { floor: "servers", bound: "office", doing: "wait", x: LOBBY[0], z: LOBBY[1], seat: null, path: [], moving: false });
    return v;
  }

  function step(seconds = 0.1, walking = false) {
    for (let i = 0; i < Math.round(seconds * 10); i++) {
      vi.advanceTimersByTime(100);
      stepVisitors(0.1, now(), walking);
    }
  }

  it("serves a second errand after returning home and resting four seconds", () => {
    const v = waitOnOtherFloor();
    step();
    expect(errandNow()).not.toBeNull();
    let boarded = false;
    for (let i = 0; i < 600 && errandNow(); i++) {
      step();
      boarded ||= v.doing === "aboard";
    }
    expect(boarded).toBe(true);
    expect(errandNow()).toBeNull();
    expect(v.floor).toBe("office");
    expect(v.seat).toBeNull();

    waitOnOtherFloor();
    step(3.9);
    expect(errandNow()).toBeNull();
    step(0.2);
    expect(errandNow()?.away).toBe("servers");
  });

  it("also rests after an interrupted errand before serving another call", () => {
    waitOnOtherFloor();
    step();
    expect(errandNow()).not.toBeNull();
    step(1);
    settleErrand();
    expect(errandNow()).toBeNull();
    waitOnOtherFloor();
    step(3.9);
    expect(errandNow()).toBeNull();
    step(0.2);
    expect(errandNow()?.away).toBe("servers");
  });

  it("keeps the car home while the player stands at its doors", () => {
    waitOnOtherFloor();
    placeAvatar("office", LOBBY);
    step(5, true);
    expect(errandNow()).toBeNull();
    placeAvatar("office", [0, 0]);
    step(0.1, true);
    expect(errandNow()).not.toBeNull();
  });
});
