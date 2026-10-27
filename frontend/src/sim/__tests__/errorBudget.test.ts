// @vitest-environment node
import { it, expect, vi } from "vitest";
import { applyAction } from "../index";
import { step } from "../step";
import { budgetUsed, pendingRetry, requestUptime } from "../errorBudget";
import { pendingSpikeAcknowledgement } from "../autoscaling";
import { act, dataCompany, replay } from "./spikeFixtures";
import { checkedCombined, finishedCompany, sequence } from "./combinedFixture";
import type { GameState } from "../types";

// Several cases play whole chapters (1-2s each alone).
vi.setConfig({ testTimeout: 30_000 });

/** Run, acknowledging reports, until the scenario completes or goes over its error budget. */
function until(g: GameState, done: (g: GameState) => boolean): GameState {
  for (let i = 0; i < 300 && !done(g) && !pendingRetry(g.campaign); i++) {
    if (g.phase === "review") g = act(g, { type: "acknowledge_review" });
    g = step(g).state;
    if (g.phase === "ended") throw Error("Company bankrupt");
  }
  return g;
}

it("Traffic Spikes budgets 2% of its scheduled demand, and an idle company goes over it", () => {
  let g = act(dataCompany(), { type: "enter_spikes" });
  expect(g.campaign!.spikeStage!.budget).toMatchObject({ scenario: "spikes", scheduledDemand: 239_200, allowance: 4_784, attempt: 1 });
  g = until(g, x => pendingSpikeAcknowledgement(x.campaign));
  const b = pendingRetry(g.campaign)!;
  expect(b.scenario).toBe("spikes");
  expect(budgetUsed(g.campaign!, b)).toBeGreaterThan(b.allowance);
  expect(g.campaign!.spikeStage!.completedStep).toBeNull();
  // Time and every other decision wait for the retry.
  expect(step(g).state).toBe(g);
  expect(applyAction(g, { type: "add_server" }).ok).toBe(false);
});

it("a retry reschedules both pulses for the same company, and the save replays it", () => {
  let g = until(act(dataCompany(), { type: "enter_spikes" }), x => pendingSpikeAcknowledgement(x.campaign));
  const at = g.campaign!.step, cash = g.campaign!.cashCents;
  g = act(g, { type: "retry_scenario" });
  const d = g.campaign!.spikeStage!;
  expect(d.deadlines).toEqual([at + 8, at + 28, at + 48, at + 68]);
  expect(d.budget).toMatchObject({ attempt: 2, fromStep: at, judged: null });
  expect(g.campaign!.cashCents).toBe(cash);
  expect(applyAction(g, { type: "retry_scenario" }).ok).toBe(false);
  // Three routed large apps serve the pulses this time.
  g = act(g, { type: "add_server" }); for (let i = 0; i < 2; i++) g = step(g).state;
  g = act(g, { type: "scale_up", appId: "app-3" }); for (let i = 0; i < 3; i++) g = step(g).state;
  g = act(g, { type: "set_routing", mode: "balanced", targets: ["app-1", "app-2", "app-3"] });
  g = until(g, x => pendingSpikeAcknowledgement(x.campaign));
  expect(pendingSpikeAcknowledgement(g.campaign)).toBe(true);
  expect(budgetUsed(g.campaign!, g.campaign!.spikeStage!.budget!)).toBe(0);
  expect(replay(g)).toEqual(JSON.parse(JSON.stringify(g)));
});

it("a growth wave that loses more than its budget is retried at the previous user count", () => {
  // Health Checks alone leave three apps: losing one under 3,600 req/s overloads the other two.
  let g = checkedCombined([sequence[2], sequence[0], sequence[1]]);
  for (let i = 0; i < 5; i++) g = step(g).state;
  g = act(g, { type: "start_growth_wave" });
  expect(g.campaign!.combinedStage!.currentRound!.budget!.allowance).toBe(Math.floor((8 * 2400 + 16 * 3600 + 5 * 2625) * 0.02));
  g = until(g, () => false);
  const b = pendingRetry(g.campaign)!;
  expect(b.scenario).toBe("growth");
  expect(g.campaign!.combinedStage!.users).toBe(20_000);
  g = act(g, { type: "retry_scenario" });
  const d = g.campaign!.combinedStage!;
  expect(d.users).toBe(2_000);
  expect(d.currentRound).toBeNull();
  expect(d.nextRoundIndex).toBe(0);
  expect(d.retriedRounds).toHaveLength(1);
  for (let i = 0; i < 5; i++) g = step(g).state;
  g = act(g, { type: "start_growth_wave" });
  expect(g.campaign!.combinedStage!.currentRound!.scenario).toEqual(sequence[2]);
  expect(g.campaign!.combinedStage!.currentRound!.budget!.attempt).toBe(2);
});

it("the final review follows a full operating week and scores its request uptime against 99.99%", () => {
  const g = finishedCompany(), c = g.campaign!, d = c.combinedStage!;
  expect(c.step - d.finalWeekFromStep!).toBeGreaterThanOrEqual(60);
  const card = d.finalReview!;
  const week = c.recent.slice(-60);
  expect(card.finalWeekUptime).toBe(requestUptime(week.reduce((n, x) => n + x.successful, 0), week.reduce((n, x) => n + x.failed, 0), week.reduce((n, x) => n + x.rejected, 0)));
  expect(card.finalWeekUptime).toBeGreaterThanOrEqual(0.9999);
  expect(card.wholeRunUptime).toBe(requestUptime(c.cumulative.successful, c.cumulative.failed, c.cumulative.rejected));
  expect(card.budgets.map(b => b.scenario)).toEqual(["spikes", "reliability", "growth", "growth", "growth"]);
  expect(card.budgets.every(b => b.lost <= b.allowance)).toBe(true);
});
