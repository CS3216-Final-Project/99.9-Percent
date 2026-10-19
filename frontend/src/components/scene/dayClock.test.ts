import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { START } from "./sky";

const TIME_OF_DAY_KEY = "nn.timeOfDay.v1";

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, "", "/");
  vi.resetModules();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  history.replaceState(null, "", "/");
});

describe("the day clock", () => {
  it("does not save a time fixed by the page address", async () => {
    history.replaceState(null, "", "/?time=0.5");
    const { timeNow } = await import("./dayClock");
    expect(timeNow()).toBe(0.5);
    window.dispatchEvent(new Event("pagehide"));
    expect(localStorage.getItem(TIME_OF_DAY_KEY)).toBeNull();
  });

  it("starts from the time saved on the last visit", async () => {
    localStorage.setItem(TIME_OF_DAY_KEY, JSON.stringify({ time: 0.8 }));
    const { timeNow } = await import("./dayClock");
    expect(timeNow()).toBe(0.8);
  });

  it("starts at the default time when nothing is saved", async () => {
    const { timeNow } = await import("./dayClock");
    expect(timeNow()).toBeCloseTo(START, 9);
  });

  it("saves the current time when the page is hidden or closed", async () => {
    const { timeNow } = await import("./dayClock");
    window.dispatchEvent(new Event("pagehide"));
    const stored = JSON.parse(localStorage.getItem(TIME_OF_DAY_KEY)!) as { time: number };
    expect(stored.time).toBeCloseTo(timeNow(), 9);
  });
});
