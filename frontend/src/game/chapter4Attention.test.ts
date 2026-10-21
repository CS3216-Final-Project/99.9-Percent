import { expect, it } from "vitest";
import { campaignAttention } from "./campaignAttention";
import { act, tick, spikeCompany, untilOffset } from "@/sim/__tests__/spikeFixtures";

const initial = spikeCompany(false);
const baseline = untilOffset(tick(act(initial, { type: "set_traffic_limit", enabled: true })), 68);

it("only recommends scheduled pulse time while a future pulse event remains", () => {
  expect(campaignAttention(initial)).toMatchObject({ chapter: 4, attention: "hint", target: "app" });
  expect(campaignAttention(act(initial, { type: "incident_inspect", equipment: "app" }))).toMatchObject({ chapter: 4, attention: "run", reason: "spike-pulses" });
  // Conservative handling of contradictory saved scheduling evidence: all four
  // recorded events already happened, even if a stale deadline remains ahead.
  const stale = structuredClone(baseline);
  stale.campaign!.spikeStage!.deadlines[3] += 100;
  expect(stale.campaign!.spikeStage!.consumed).toHaveLength(4);
  expect(campaignAttention(stale)).toMatchObject({ chapter: 4, attention: "hint", target: "requirements" });
});

it("recommends baseline Run only when real engine observations can advance", () => {
  const before = baseline.campaign!.spikeStage!.baselineStableSteps;
  expect(campaignAttention(baseline)).toMatchObject({ attention: "run", reason: "spike-stability" });
  expect(tick(baseline).campaign!.spikeStage!.baselineStableSteps).toBe(before + 1);
});

it("does not mistake baseline traffic for a valid management observation", () => {
  const inconsistent = structuredClone(baseline);
  inconsistent.phase = "incident";
  expect(campaignAttention(inconsistent)).toMatchObject({ attention: "hint", target: "requirements" });
});

it("prioritizes observed overload over the remaining pulse schedule and selects an existing action", () => {
  const pressure = tick(initial, initial.campaign!.spikeStage!.deadlines[0] - initial.campaign!.step);
  expect(campaignAttention(pressure)).toMatchObject({ chapter: 4, attention: "hint", reason: "application", action: { action: { type: "add_server" } } });
  expect(campaignAttention(act(pressure, { type: "set_traffic_limit", enabled: true }))).toMatchObject({ attention: "run", reason: "activation-limit" });
});

it("keeps completed spike recognition ahead of Run and recalculates Next after acknowledgement", () => {
  const complete = tick(baseline, 4);
  expect(campaignAttention(complete)).toMatchObject({ attention: null, reason: "review" });
  expect(campaignAttention(act(complete, { type: "acknowledge_spikes" }))).toMatchObject({ attention: "progression", target: "next" });
});
