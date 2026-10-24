import { describe, expect, it } from "vitest";
import { coffee, lookLocked, nap, scriptedPose, snack, water } from "./funScript";

/** How many times a value rises through 0.5 and falls back below it, scanning the whole timeline. */
function crossings(sample: (f: number) => number): number {
  let count = 0;
  let up = sample(0) > 0.5;
  for (let i = 1; i <= 200; i++) {
    const v = sample(i / 200) > 0.5;
    if (v !== up) count += 1;
    up = v;
  }
  return count;
}

describe("the coffee's timeline", () => {
  it("brews first, shows the mug only after, and sips exactly twice", () => {
    expect(coffee(0.3).mug).toBe(0);
    expect(coffee(0.5).mug).toBe(1);
    // Two sips: the tilt rises and falls twice, never elsewhere.
    expect(crossings((f) => coffee(f).tilt)).toBe(4);
    expect(coffee(0.58).tilt).toBeGreaterThan(0.9);
    expect(coffee(0.8).tilt).toBeGreaterThan(0.9);
    expect(coffee(0.44).tilt).toBe(0);
    expect(coffee(0.7).tilt).toBe(0);
    expect(coffee(1).mug).toBe(0);
  });
});

describe("the snack's timeline", () => {
  it("nods on each of its three bites and crumples away at the end", () => {
    expect(crossings((f) => snack(f).nod)).toBe(6);
    expect(snack(0.55).nod).toBeGreaterThan(0.9);
    expect(snack(0.98).crumple).toBeGreaterThan(0.9);
    expect(snack(1).bag).toBe(0);
  });
});

describe("the cooler's timeline", () => {
  it("fills to the brim, gulps three times deeper each, and ends empty and crushed", () => {
    expect(water(0.45).level).toBeCloseTo(1, 5);
    expect(water(0.45).tilt).toBe(0);
    expect(water(0.57).tilt).toBeGreaterThan(0.3);
    expect(water(0.81).tilt).toBeGreaterThan(0.8);
    expect(water(0.9).level).toBeCloseTo(0, 5);
    expect(water(0.95).crushed).toBeGreaterThan(0.5);
  });
});

describe("the nap's timeline", () => {
  it("opens and ends with open eyes, shut through the sleep, and double-blinks awake", () => {
    expect(nap(0).eyes).toBe(0);
    expect(nap(1).eyes).toBe(0);
    expect(nap(0.4).eyes).toBe(1);
    expect(nap(0.4).asleep).toBe(true);
    expect(nap(0.1).asleep).toBe(false);
    // The double blink: open mid-way, shut again, then opening for the sit-up.
    expect(nap(0.79).eyes).toBeLessThan(0.1);
    expect(nap(0.82).eyes).toBeGreaterThan(0.9);
    expect(nap(0.85).eyes).toBeLessThan(0.5);
    expect(nap(0.87).eyes).toBe(0);
    expect(nap(0.2).asleep).toBe(false);
    expect(nap(0.8).asleep).toBe(false);
  });
});

describe("scripted views", () => {
  it("locks the look for the nap and the arcade anywhere, and for a held thing in follow only", () => {
    for (const view of ["first", "follow"] as const) {
      expect(lookLocked("nap", view)).toBe(true);
      expect(lookLocked("arcade", view)).toBe(true);
    }
    for (const prop of ["espresso", "vending", "cooler"]) {
      expect(lookLocked(prop, "follow")).toBe(true);
      expect(lookLocked(prop, "first")).toBe(false);
    }
  });

  it("gives poses only where the activity frames the view", () => {
    expect(scriptedPose("espresso", 0.5, "first", 0)).toBeNull();
    for (const prop of ["espresso", "vending", "cooler"]) expect(scriptedPose(prop, 0.5, "follow", 0)).not.toBeNull();
    expect(scriptedPose("nap", 0.5, "first", 0)).not.toBeNull();
    expect(scriptedPose("nap", 0.5, "follow", 0)).not.toBeNull();
    expect(scriptedPose("arcade", 0.5, "first", 0)).not.toBeNull();
    expect(scriptedPose("arcade", 0.5, "follow", 0)).not.toBeNull();
  });
});
