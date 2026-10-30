import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { holdWorld, worldDelta, worldNow } from "./worldClock";

describe("worldClock", () => {
  beforeEach(() => vi.spyOn(performance, "now").mockReturnValue(10_000));
  afterEach(() => {
    holdWorld(false);
    vi.restoreAllMocks();
  });

  it("stands still while held and carries on from the same moment", () => {
    const start = worldNow();
    holdWorld(true);
    vi.mocked(performance.now).mockReturnValue(15_000);
    expect(worldNow()).toBe(start);
    expect(worldDelta(0.016)).toBe(0);
    holdWorld(false);
    expect(worldNow()).toBe(start);
    vi.mocked(performance.now).mockReturnValue(16_000);
    expect(worldNow()).toBe(start + 1);
    expect(worldDelta(0.016)).toBe(0.016);
  });

  it("ignores a second hold, so one release lets it run", () => {
    const start = worldNow();
    holdWorld(true);
    vi.mocked(performance.now).mockReturnValue(12_000);
    holdWorld(true);
    holdWorld(false);
    expect(worldNow()).toBe(start);
  });
});
