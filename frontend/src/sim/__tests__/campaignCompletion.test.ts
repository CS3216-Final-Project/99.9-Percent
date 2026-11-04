// @vitest-environment node
import { expect, it, vi } from "vitest";
import { applyAction, newGame } from "../index";
import { captureScorecard, emptyServiceMeasurement, observeService } from "../campaignScorecard";
import { makeEnvelope, validateEnvelope } from "@/game/saveEnvelope";
import { canCompleteCampaign } from "../campaignCompletion";
import { pendingReliability } from "../reliability";
import { act, tick, completedReliability, reliabilityReview } from "./completionFixture";
import { replay } from "./spikeFixtures";

// Each case plays a company through all five chapters.
vi.setConfig({ testTimeout: 30_000 });

it("completes Guided Mode after Stay Online, freezing the company with a won scorecard", () => {
  const s = completedReliability(), before = JSON.stringify(s);
  const won = act(s, { type: "complete_campaign" });
  expect(JSON.stringify(s)).toBe(before);
  expect(won).toMatchObject({ phase: "ended", outcome: "won" });
  expect(won.campaign!.scorecard).toMatchObject({ outcome: "won", runId: s.campaign!.runId, capturedStep: s.campaign!.step, cashCents: s.campaign!.cashCents });
  expect(won.campaign!.trace.at(-1)).toMatchObject({ type: "campaign-completed", data: { cashCents: s.campaign!.cashCents } });
  expect(tick(won, 5).campaign!.step).toBe(won.campaign!.step);
  expect(applyAction(won, { type: "complete_campaign" }).ok).toBe(false);
  expect(replay(won)).toEqual(JSON.parse(JSON.stringify(won)));
});

it("refuses completion before Stay Online is acknowledged or while the company is unsettled", () => {
  const review = reliabilityReview();
  expect(pendingReliability(review.campaign)).toBe(true);
  expect(canCompleteCampaign(review)).toBe(false);
  expect(applyAction(review, { type: "complete_campaign" }).ok).toBe(false);
  const queued = act(completedReliability(), { type: "add_server" });
  expect(canCompleteCampaign(queued)).toBe(false);
  const refused = applyAction(queued, { type: "complete_campaign" });
  expect(refused.ok).toBe(false);
  expect(queued.phase).toBe("management");
  expect(queued.campaign!.scorecard).toBeNull();
});

it("counts only fresh eligible observations and reports incomplete historical coverage honestly", () => {
  const s = tick(newGame(3), 3), m = emptyServiceMeasurement(3, "since-upgrade");
  observeService(m, s.campaign!.snapshot); observeService(m, s.campaign!.snapshot);
  expect(m.eligibleSteps).toBe(1);
  s.campaign!.serviceMeasurement = m;
  const card = captureScorecard(s, "bankrupt");
  expect(card.wholeRunUptime).toBeNull(); expect(card.wholeRunLargestOutage).toBeNull(); expect(card.measurement.healthySteps).toBe(1);
});

it("captures exact settled finances separately from pending revenue", () => {
  const s = tick(completedReliability(), 13), card = captureScorecard(s, "bankrupt"), c = s.campaign!;
  expect(card.infrastructureSetupCents).toBe(c.investedCents);
  expect(card.revenueCents).toBe(c.revenueCents);
  expect(card.pendingRevenueCents).toBe(c.ledger.successes * 20);
  expect(card.salaryCents + card.infrastructureOperatingCents).toBe(c.costsCents);
});

it("keeps authoritative full-run service history beyond the 600-snapshot display window", () => {
  const s = tick(completedReliability(), 700), c = s.campaign!, card = captureScorecard(s, "bankrupt");
  expect(c.recent).toHaveLength(600);
  expect(card.measurement.eligibleSteps).toBe(c.step);
  expect(card.wholeRunUptime).not.toBeNull();
  expect(validateEnvelope(makeEnvelope(s)).status).toBe("ok");
}, 60_000);
