import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMusic } from "./music";
import { createSfx, CUE_NAMES } from "./sfx";
import { loudness } from "./synth";
import { FakeAudioContext, FakeOfflineAudioContext } from "./testing/fakeAudio";

const click = () => window.dispatchEvent(new Event("pointerdown"));

describe("sound effects without Web Audio", () => {
  it("stay silent and harmless, as in a browser with audio disabled", () => {
    // jsdom has no AudioContext.
    const sfx = createSfx(() => true);
    expect(() => {
      sfx.setVolume(80);
      for (const cue of CUE_NAMES) sfx.play(cue);
      click();
      sfx.setVolume(0);
      sfx.dispose();
      sfx.play("alarm");
    }).not.toThrow();
  });
});

describe("sound effects", () => {
  beforeEach(() => {
    FakeAudioContext.reset();
    vi.stubGlobal("AudioContext", FakeAudioContext);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("start their audio on a click only while the player wants them", () => {
    let wanted = false;
    const sfx = createSfx(() => wanted);
    click();
    expect(FakeAudioContext.made).toHaveLength(0);
    wanted = true;
    click();
    expect(FakeAudioContext.made).toHaveLength(1);
    sfx.dispose();
    expect(FakeAudioContext.made[0].state).toBe("closed");
    click();
    expect(FakeAudioContext.made).toHaveLength(1);
  });

  it("synthesise every cue, and none while muted", () => {
    let t = 0;
    const sfx = createSfx(() => true, () => t);
    sfx.play("alarm");
    expect(FakeAudioContext.made).toHaveLength(0);
    sfx.setVolume(80);
    for (const cue of CUE_NAMES) {
      const ctx = FakeAudioContext.made[0];
      const before = ctx?.voices ?? 0;
      sfx.play(cue);
      t += 5000;
      expect(FakeAudioContext.made[0].voices, cue).toBeGreaterThan(before);
    }
    const ctx = FakeAudioContext.made[0];
    // The bus follows the slider on the same curve as the music.
    expect(ctx.gains[0].gain.value).toBeCloseTo(loudness(80, 0.9));
    sfx.setVolume(0);
    const silent = ctx.voices;
    sfx.play("buzz");
    expect(ctx.voices).toBe(silent);
    expect(ctx.gains[0].gain.ramps.at(-1)).toBe(0);
    sfx.dispose();
  });

  it("do not repeat a cue inside its gap, but play different cues together", () => {
    let t = 1000;
    const sfx = createSfx(() => true, () => t);
    sfx.setVolume(100);
    sfx.play("clunk");
    const ctx = FakeAudioContext.made[0];
    const once = ctx.voices;
    t += 50;
    sfx.play("clunk");
    expect(ctx.voices).toBe(once);
    sfx.play("hire");
    expect(ctx.voices).toBeGreaterThan(once);
    const both = ctx.voices;
    t += 200;
    sfx.play("clunk");
    expect(ctx.voices).toBeGreaterThan(both);
    sfx.dispose();
  });

  it("never pile sounds onto a sleeping context for when it wakes", async () => {
    let t = 0;
    let wake: () => void = () => {};
    const sfx = createSfx(() => true, () => t);
    sfx.setVolume(80);
    click();
    const ctx = FakeAudioContext.made[0];
    ctx.state = "suspended";
    FakeAudioContext.resume = (c) => new Promise((resolve) => (wake = () => ((c.state = "running"), resolve())));
    sfx.play("alarm");
    expect(ctx.voices).toBe(0);
    // Woken too late: the alarm is stale and is dropped.
    t = 2000;
    wake();
    await Promise.resolve();
    await Promise.resolve();
    expect(ctx.voices).toBe(0);
    // Woken promptly: it plays, once.
    ctx.state = "suspended";
    sfx.play("blip");
    t += 100;
    wake();
    await Promise.resolve();
    await Promise.resolve();
    expect(ctx.voices).toBeGreaterThan(0);
    sfx.dispose();
  });

  it("suspend their audio after a while at zero volume, and wake when turned up", () => {
    vi.useFakeTimers();
    const sfx = createSfx(() => true);
    sfx.setVolume(60);
    click();
    const ctx = FakeAudioContext.made[0];
    // A quick mute and unmute keeps the audio awake, so the sample plays at once.
    sfx.setVolume(0);
    vi.advanceTimersByTime(2000);
    expect(ctx.state).toBe("running");
    sfx.setVolume(40);
    sfx.play("preview");
    expect(ctx.voices).toBeGreaterThan(0);
    sfx.setVolume(0);
    vi.advanceTimersByTime(10_500);
    expect(ctx.state).toBe("suspended");
    sfx.setVolume(40);
    expect(ctx.state).toBe("running");
    sfx.dispose();
  });

  it("keep a failing voice from breaking the game", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const sfx = createSfx(() => true);
    sfx.setVolume(80);
    click();
    const ctx = FakeAudioContext.made[0];
    ctx.createOscillator = () => {
      throw new Error("no oscillators");
    };
    expect(() => {
      sfx.play("blip");
      sfx.play("confirm");
    }).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
    sfx.dispose();
    warn.mockRestore();
  });
});

describe("music volume", () => {
  beforeEach(() => {
    FakeAudioContext.reset();
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("OfflineAudioContext", FakeOfflineAudioContext);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("plays at the level it had before the slider at the default 80%, and follows the slider", () => {
    vi.useFakeTimers();
    const music = createMusic(() => true);
    music.setVolume(80);
    expect(FakeAudioContext.made).toHaveLength(0);
    music.setEnabled(true);
    const ctx = FakeAudioContext.made[0];
    const master = ctx.gains[0].gain;
    expect(master.ramps.at(-1)).toBeCloseTo(0.32);
    music.setVolume(40);
    expect(master.ramps.at(-1)).toBeCloseTo(0.08);
    // At zero the music fades out and its audio sleeps, as when it was switched off.
    music.setVolume(0);
    expect(master.ramps.at(-1)).toBe(0);
    vi.advanceTimersByTime(500);
    expect(ctx.state).toBe("suspended");
    music.setVolume(100);
    expect(ctx.state).toBe("running");
    expect(master.ramps.at(-1)).toBeCloseTo(0.5);
    music.setEnabled(false);
    expect(master.ramps.at(-1)).toBe(0);
    music.dispose();
    expect(ctx.state).toBe("closed");
  });

  it("does not start on a click while muted", () => {
    const music = createMusic(() => false);
    music.setVolume(0);
    music.setEnabled(true);
    click();
    expect(FakeAudioContext.made).toHaveLength(0);
    music.dispose();
  });
});
