import { expect, it } from "vitest";
import { pendingCombined } from "../combinedCampaign";
import { act, tick, finishRound, finishFinalWeek, completedReliability } from "./combinedFixture";

/** Each order lives in its own file so Vitest can distribute this CPU-bound work. */
export function checkCombinedBounds(order: readonly number[]) {
  it("balance: all peak/duration bounds for pool order " + order.join(","), () => {
    const predecessor = completedReliability();
    for (const read of [3800, 4000]) for (const failure of [3400, 3600]) for (let mask = 0; mask < 8; mask++) {
      const pool = [
        { template: "read-growth-pulse" as const, peak: read, duration: (mask & 1 ? 16 : 12) as 12 | 16 },
        { template: "write-pressure" as const, peak: 3000, duration: (mask & 2 ? 16 : 12) as 12 | 16 },
        { template: "failure-under-load" as const, peak: failure, duration: (mask & 4 ? 16 : 12) as 12 | 16 },
      ];
      let state = act(predecessor, { type: "enter_combined", sequence: order.map(i => pool[i]) });
      for (let round = 0; round < 3; round++) {
        state = tick(state, 5);
        state = finishRound(act(state, { type: "start_growth_wave" }));
        state = act(state, { type: "acknowledge_growth" });
      }
      state = finishFinalWeek(state);
      expect(pendingCombined(state.campaign)).toBe(true);
      expect(act(state, { type: "complete_campaign" }).outcome).toBe("won");
    }
  }, 120_000);
}
