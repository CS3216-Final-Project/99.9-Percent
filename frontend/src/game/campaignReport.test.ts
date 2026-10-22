import { expect, it } from "vitest";
import { newGame } from "@/sim";
import { captureScorecard } from "@/sim/campaignScorecard";
import { act, tick, dataCompany, spikeCompany } from "@/sim/__tests__/spikeFixtures";
import { combinedCompany, finishRound, finishedCompany } from "@/sim/__tests__/combinedFixture";
import { reliabilityOutcome } from "./__fixtures__/reliabilityOutcome";
import { incidentSummary, outcomeSummary, scorecardSummary } from "./campaignReport";

it("reports an activated manual database response, not a mere request or later action", () => {
  let g = act(tick(newGame(), 6), { type: "start_db_upgrade" });
  while (g.phase !== "review") g = tick(g);
  const report = g.campaign!.reports[0], before = JSON.stringify(report);
  expect(incidentSummary(report).response).toContain("a database upgrade");
  const pendingOnly = { ...report, events: report.events.filter(e => e.type !== "action-activated") };
  expect(incidentSummary(pendingOnly).response).not.toContain("a database upgrade");
  const later = { ...report, events: report.events.map(e => e.type === "action-activated" ? { ...e, step: report.recoveredStep + 1 } : e) };
  expect(incidentSummary(later).response).not.toContain("a database upgrade");
  expect(JSON.stringify(report)).toBe(before);
});

it("explains actual prevention separately from recovered-incident progression", () => {
  let g = act(act(newGame(), { type: "set_traffic_limit", enabled: true }), { type: "start_db_upgrade" });
  g = tick(g, 4);
  g = act(act(g, { type: "incident_inspect", equipment: "app" }), { type: "incident_inspect", equipment: "db" });
  g = tick(act(g, { type: "set_traffic_limit", enabled: false }), 5);
  expect(g.campaign!.openingPrevention!.outcome).toBeTruthy();
  const lesson = outcomeSummary(g.campaign!, "prevention");
  expect(lesson.happened).toContain("without an incident");
  expect(lesson.response).toContain("a database upgrade");
  expect(lesson.takeaway).toContain("both valid ways to complete Opening");
});

it("distinguishes activated scaling and routing from the separate data learning objective", () => {
  const c = dataCompany().campaign!;
  expect(outcomeSummary(c, "scaling").response).toContain("server scaling");
  expect(outcomeSummary(c, "scaling").takeaway).toContain("traffic reaches it");
  expect(outcomeSummary(c, "data").takeaway).toContain("writes still need database capacity");
});

it("uses observed failover and rejected traffic without inventing a manual restore", () => {
  const c = reliabilityOutcome(false, true).campaign!;
  // This protected run need not produce a formal incident: summary evidence stays factual.
  const fault = c.reliabilityStage!.fault!;
  const report = { ...c.reports[0], openedStep: fault.startedStep!, recoveredStep: fault.restoredStep!,
    events: c.trace, snapshots: c.recent };
  const lesson = incidentSummary(report);
  expect(lesson.response).toContain("automatic spare failover");
  expect(lesson.response).not.toContain("a requested server restore");
  expect(lesson.response).toContain("rejected");
});

it("keeps a completed growth wave bounded and explains full-demand verification", () => {
  const g = finishRound(act(tick(combinedCompany(), 5), { type: "start_growth_wave" }));
  const c = g.campaign!, round = c.combinedStage!.currentRound!;
  const lesson = outcomeSummary(c, "growth", round);
  expect(lesson.happened).toContain("full-demand service");
  c.trace.push({ id: c.nextEventId++, step: c.step + 1, type: "failover-activated", data: {} });
  expect(outcomeSummary(c, "growth", round)).toEqual(lesson);
});

it("does not invent incidents or recovery actions for a no-incident scorecard record", () => {
  // A presentation boundary, not a claim that an incident-free Campaign route exists.
  const card = captureScorecard(newGame(), "won");
  const summary = scorecardSummary(card, false);
  expect(summary.happened).toBe("The Campaign objectives were completed.");
  expect(summary.response).toBe("No incidents appear in the retained record.");
  expect(scorecardSummary(card, true).happened).toContain("final review");
  expect(scorecardSummary({ ...card, outcome: "bankrupt" }, false).happened).toContain("ran out of cash");
});

it("does not attribute a same-second pre-entry action to the spike stage", () => {
  let g = act(spikeCompany(false), { type: "set_traffic_limit", enabled: true });
  for (let i = 0; i < 100 && g.campaign!.spikeStage!.completedStep == null; i++) g = tick(g);
  expect(g.campaign!.spikeStage!.completedStep).not.toBeNull();
  const summary = outcomeSummary(g.campaign!, "spikes");
  expect(summary.response).toContain("a traffic limit");
  expect(summary.response).toContain("Many incoming requests were rejected");
  expect(summary.response).not.toContain("traffic limit removal");
});

it("directs the last wave's takeaway to final goals rather than an invented fourth wave", () => {
  const c = finishedCompany().campaign!, round = c.combinedStage!.completedRounds[2];
  expect(outcomeSummary(c, "growth", round).improve).toBe("Compare service at full demand with your final Campaign goals.");
});
