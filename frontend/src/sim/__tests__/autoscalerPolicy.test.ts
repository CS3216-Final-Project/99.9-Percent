// @vitest-environment node
import { it, expect, vi } from "vitest";
import { applyAction } from "../index";
import { step } from "../step";
import { pendingSpikeAcknowledgement } from "../autoscaling";
import { pendingRetry } from "../errorBudget";
import { act, replay, spikeCompany } from "./spikeFixtures";
import type { GameState } from "../types";

vi.setConfig({ testTimeout: 30_000 });

/** Run Traffic Spikes to its end: the recognition, or a retry over the error budget. */
function playSpikes(g: GameState): GameState {
  for (let i = 0; i < 200 && !pendingSpikeAcknowledgement(g.campaign) && !pendingRetry(g.campaign); i++) {
    if (g.phase === "review") g = act(g, { type: "acknowledge_review" });
    g = step(g).state;
  }
  return g;
}

const pulseIncidents = (g: GameState) => {
  const d = g.campaign!.spikeStage!;
  return [[d.deadlines[0], d.deadlines[1]], [d.deadlines[2], d.deadlines[3]]].map(([from, to]) => g.campaign!.trace.filter(t => t.type === "incident-opened" && t.step >= from && t.step < to + 5).length);
};

it("the default controller goes over the error budget with an incident in each pulse", () => {
  const g = playSpikes(spikeCompany(true));
  expect(pulseIncidents(g)).toEqual([1, 1]);
  expect(pendingRetry(g.campaign)?.scenario).toBe("spikes");
});

// Only one deployment installs at a time, so no policy has four apps routed before the first pulse: automation needs
// lead time. A tuned policy keeps the apps it added, so the second pulse is handled without an incident.
it.each([[8000, 4], [5000, 2]])("a target of %i basis points with a minimum of %i apps stays within the error budget and handles the second pulse", (targetBasisPoints, minimum) => {
  let g = act(spikeCompany(true), { type: "set_autoscaler_policy", targetBasisPoints, minimum });
  expect(g.campaign!.trace.at(-1)).toMatchObject({ type: "autoscaler-policy-changed", data: { targetBasisPoints, minimum } });
  g = playSpikes(g);
  expect(pendingSpikeAcknowledgement(g.campaign)).toBe(true);
  expect(pulseIncidents(g)).toEqual([1, 0]);
  expect(g.campaign!.routing.targets).toHaveLength(4);
  expect(replay(g)).toEqual(JSON.parse(JSON.stringify(g)));
});

it("a minimum of three still overloads the smaller automatic app during a pulse", () => {
  let g = act(spikeCompany(true), { type: "set_autoscaler_policy", targetBasisPoints: 8000, minimum: 3 });
  g = step(g).state;
  expect(g.campaign!.trace.some(t => t.type === "autoscale-minimum-decided")).toBe(true);
  expect(pulseIncidents(playSpikes(g))).toEqual([1, 1]);
});

it("a lower utilisation target scales out sooner than the default", () => {
  let g = act(spikeCompany(true), { type: "set_autoscaler_policy", targetBasisPoints: 6000, minimum: 2 });
  // Baseline 2,400 req/s on 3,200 req/s of routed capacity is 75% busy: above a 60% target, below the default 80%.
  for (let i = 0; i < 4; i++) g = step(g).state;
  expect(g.campaign!.trace.some(t => t.type === "autoscale-scale-out-decided" && t.data.highThresholdBasisPoints === 6000)).toBe(true);
});

it("rejects unlisted policies, unchanged policies and a missing controller without changing the company", () => {
  const g = spikeCompany(true), before = JSON.stringify(g);
  expect(applyAction(g, { type: "set_autoscaler_policy", targetBasisPoints: 6500, minimum: 2 }).ok).toBe(false);
  expect(applyAction(g, { type: "set_autoscaler_policy", targetBasisPoints: 8000, minimum: 5 }).ok).toBe(false);
  expect(applyAction(g, { type: "set_autoscaler_policy", targetBasisPoints: 8000, minimum: 2 }).ok).toBe(false);
  expect(applyAction(spikeCompany(false), { type: "set_autoscaler_policy", targetBasisPoints: 7000, minimum: 3 }).ok).toBe(false);
  expect(JSON.stringify(g)).toBe(before);
});
