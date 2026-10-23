// @vitest-environment node
import { describe, expect, it } from "vitest";
import { applyAction, newGame } from "@/sim";
import { advanceSteps } from "@/sim/step";
import { campaignUptime } from "./campaignUptime";

describe("campaignUptime", () => {
  it("has no figure before the first request", () => {
    expect(campaignUptime(newGame(1).campaign!)).toBeNull();
  });
  it("is every request served while the company keeps up", () => {
    expect(campaignUptime(advanceSteps(newGame(1), 3).state.campaign!)).toBe(1);
  });
  it("ignores requests still waiting, falls only on settled losses and requests a limit turns away", () => {
    // Requests queued behind the database are undecided, not lost: uptime does not fall until the queue sheds them.
    const busy = advanceSteps(newGame(1), 8).state.campaign!;
    const up = campaignUptime(busy)!;
    expect(up).toBeCloseTo(busy.cumulative.successful / (busy.cumulative.successful + busy.cumulative.failed + busy.cumulative.rejected), 10);
    const r = applyAction(advanceSteps(newGame(1), 3).state, { type: "set_traffic_limit", enabled: true });
    if (!r.ok) throw Error(r.message);
    const limited = advanceSteps(r.state, 4).state.campaign!;
    expect(limited.cumulative.rejected).toBeGreaterThan(0);
    expect(campaignUptime(limited)!).toBeLessThan(1);
  });
});
