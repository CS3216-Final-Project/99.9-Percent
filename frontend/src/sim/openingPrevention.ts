import type { Campaign, OpeningPrevention } from "./campaignTypes";
import { OPENING_DB as Q } from "./scenarios/openingDatabaseIncident";
import { trace } from "./trace";

/** Opening-only eligibility; an actual incident permanently selects the reactive route. */
export function preventionAvailable(c: Campaign): boolean {
  return !c.scaling && !c.dataStage && !c.spikeStage && !c.openingMilestone && !c.openingRecovered &&
    !c.incident && !c.firstPauseConsumed && c.reports.length === 0 &&
    c.consumedEvents.includes("opening-growth") && !c.trace.some(t => t.type === "incident-opened");
}
export function pendingPreventionReview(c: Campaign | undefined): boolean {
  return !!c?.openingPrevention?.outcome && !c.openingPrevention.outcome.acknowledged;
}
export function ensurePrevention(c: Campaign): OpeningPrevention | undefined {
  if (!preventionAvailable(c)) return undefined;
  if (!c.openingPrevention) {
    c.openingPrevention = { eligibleStep: c.step, appInspectedStep: null, dbInspectedStep: null, stableSteps: 0, outcome: null };
    trace(c, "opening-prevention-eligible");
  }
  return c.openingPrevention;
}
export function preventionRequirements(c: Campaign) {
  const m = c.snapshot, p = c.openingPrevention;
  return {
    growth: c.consumedEvents.includes("opening-growth"),
    noIncident: !c.firstPauseConsumed && !c.incident && !c.openingRecovered && !c.reports.length && !c.trace.some(t => t.type === "incident-opened"),
    positiveCash: c.cashCents > 0,
    fullDemand: c.limit === null && m.incoming === Q.grownTraffic && m.admitted === Q.grownTraffic && m.rejected === 0,
    emptyQueues: c.apps.every(a => a.backlog === 0) && c.dbBacklog === 0,
    healthy: m.latencyMs < Q.latencyThresholdMs && m.serviceErrorRate !== null && m.serviceErrorRate < Q.errorThreshold && m.successful + m.failed > 0,
    applicationInspected: p?.appInspectedStep != null,
    databaseInspected: p?.dbInspectedStep != null,
  };
}
export function recordPreventionInspection(c: Campaign, component: string): void {
  if (!["app", "db"].includes(component)) return;
  const p = ensurePrevention(c);
  if (!p || p.outcome) return;
  const field = component === "app" ? "appInspectedStep" : "dbInspectedStep";
  if (p[field] !== null) return;
  p[field] = c.step;
  trace(c, component === "app" ? "opening-prevention-application-inspected" : "opening-prevention-database-inspected", { snapshotStep: c.step });
}
/** Called once after a NEW physical observation, never from loading or acknowledgement. */
export function observePrevention(c: Campaign): void {
  if (c.openingMilestone || c.scaling || c.dataStage || c.spikeStage) return;
  const p = ensurePrevention(c) ?? c.openingPrevention;
  if (!p || p.outcome) return;
  const qualifies = preventionAvailable(c) && Object.values(preventionRequirements(c)).every(Boolean) &&
    c.step > p.eligibleStep && c.step > p.appInspectedStep! && c.step > p.dbInspectedStep!;
  const before = p.stableSteps;
  p.stableSteps = qualifies ? before + 1 : 0;
  if (before !== p.stableSteps) trace(c, "opening-prevention-streak", { from: before, to: p.stableSteps });
  if (p.stableSteps === Q.stableSteps) {
    p.outcome = { id: "opening-prevention", qualifiedStep: c.step, acknowledged: false,
      snapshots: structuredClone(c.recent.slice(-Q.stableSteps)), rejectedDemand: c.cumulative.rejected, setupCents: c.investedCents };
    trace(c, "opening-prevention-qualified", { outcomeId: p.outcome.id });
  }
}
