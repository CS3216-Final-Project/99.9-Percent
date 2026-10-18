import { expect, it } from "vitest";
import { newGame } from "@/sim";
import { advanceSteps } from "@/sim/step";
import { incidentGuidance, growthGuidance, postmortemSummary } from "./campaignFeedback";
import { act, tick, combinedCompany, finishedCompany, finishRound } from "@/sim/__tests__/combinedFixture";
import { makeEnvelope, validateEnvelope } from "./saveEnvelope";

it("uses the real recovery streak, suppresses investigation at 1–4, preserves review at five and explains a recorded reset", () => {
  let g = advanceSteps(newGame(), 7).state;
  expect(incidentGuidance(g)?.investigate).toBe(true);
  g = act(g, { type: "set_traffic_limit", enabled: true });
  expect(incidentGuidance(g)?.investigate).toBe(false);
  for (let i = 0; i < 30 && g.phase !== "review"; i++) {
    g = tick(g);
    if (g.campaign!.incident?.stableSteps) {
      expect(incidentGuidance(g)?.checking).toBe(true);
      expect(incidentGuidance(g)?.investigate).toBe(false);
      expect(incidentGuidance(g)?.steps).toBe(g.campaign!.incident!.stableSteps);
    }
  }
  expect(g.phase).toBe("review"); expect(incidentGuidance(g)).toBeNull();
  expect(g.campaign!.reports.at(-1)?.limited).toBe(true);
  expect(validateEnvelope(makeEnvelope(g)).status).toBe("ok");
  const reset = advanceSteps(newGame(), 7).state;
  reset.campaign!.trace.push({ id: 9999, step: reset.campaign!.step, type: "recovery-streak", data: { from: 2, to: 0 } });
  expect(incidentGuidance(reset)).toMatchObject({ reset: true, checking: false, investigate: false });
});

it("describes limit removal as permission, not full-demand success; promotions do not award registrations", () => {
  let g = tick(act(combinedCompany(), { type: "set_traffic_limit", enabled: true }));
  expect(growthGuidance(g)?.hint.topic).toBe("traffic");
  expect(growthGuidance(g)?.objective).toContain("restricting customers");
  g = tick(act(g, { type: "set_traffic_limit", enabled: false }));
  expect(growthGuidance(g)?.hint.topic).not.toBe("traffic");
  expect(growthGuidance(g)?.objective).toContain("Run your company");
  g = tick(g, 5);
  expect(growthGuidance(g)?.hint.topic).toBe("wave");
  const promoted = tick(act(g, { type: "run_promotion" }));
  expect(promoted.campaign!.combinedStage!.users).toBe(2000);
  const wave = act(g, { type: "start_growth_wave" });
  expect(wave.campaign!.combinedStage!.users).toBe(2000);
  const started = tick(wave, 8);
  expect(started.campaign!.combinedStage!.users).toBe(20000);
  const review = finishRound(started);
  expect(growthGuidance(review)?.objective).toBe("Review your latest growth milestone.");
  expect(growthGuidance(review)?.eligible).toBe(false);
});

it("leaves the existing final review and completion gates authoritative", () => {
  const g = finishedCompany();
  expect(g.campaign!.combinedStage!.completedRounds).toHaveLength(3);
  expect(g.campaign!.combinedStage!.finalReview).toBeTruthy();
  expect(growthGuidance(g)?.objective).toBe("Review your final campaign scorecard.");
  expect(growthGuidance(g)?.eligible).toBe(false);
  const ended = act(g, { type: "complete_campaign" });
  expect(ended.outcome).toBe("won"); expect(growthGuidance(ended)).toBeNull();
});

it.each([false, true])("summarises recorded outcomes without discarding history or claiming causation (limited=%s)", limited => {
  let g = advanceSteps(newGame(), 7).state;
  g = act(g, limited ? { type: "set_traffic_limit", enabled: true } : { type: "start_db_upgrade" });
  g = advanceSteps(g, 50).state;
  const report = g.campaign!.reports.at(-1)!, before = JSON.stringify(report);
  const summary = postmortemSummary(report);
  expect(summary.result).toContain(limited ? "Full demand was not restored" : "at full demand");
  expect(summary.actions.length).toBeGreaterThan(0);
  expect(JSON.stringify(report)).toBe(before);
});

it("groups repeated player requests without attributing automated requests to the player or losing evidence", () => {
  let g = act(advanceSteps(newGame(), 7).state, { type: "start_db_upgrade" });
  g = advanceSteps(g, 50).state;
  const report = structuredClone(g.campaign!.reports.at(-1)!);
  const request = report.events.find(e => e.type === "action-requested")!;
  report.events.push({ ...request, id: 9998 }, { ...request, id: 9999, data: { ...request.data, source: "autoscaler" } });
  const before = JSON.stringify(report);
  expect(postmortemSummary(report).actions).toContainEqual([String(request.data.type), 2]);
  expect(JSON.stringify(report)).toBe(before);
});
