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

/** Historical engine evidence, not today's readings or a purchased upgrade. */
export function verifiedPrevention(c: Campaign): boolean {
  const p = c.openingPrevention, o = p?.outcome;
  if (!p || !o?.acknowledged || p.stableSteps !== Q.stableSteps ||
    p.appInspectedStep === null || p.dbInspectedStep === null || o.snapshots.length !== Q.stableSteps) return false;
  const first = o.qualifiedStep - Q.stableSteps + 1;
  return c.consumedEvents.includes("opening-growth") && p.eligibleStep >= Q.growthStep &&
    p.appInspectedStep >= p.eligibleStep && p.dbInspectedStep >= p.eligibleStep &&
    p.appInspectedStep < first && p.dbInspectedStep < first &&
    c.trace.some(e => e.type === "opening-prevention-qualified" && e.step === o.qualifiedStep && e.data.outcomeId === o.id) &&
    c.trace.some(e => e.type === "opening-prevention-review-acknowledged" && e.step >= o.qualifiedStep && e.data.outcomeId === o.id) &&
    c.trace.some(e => e.type === "opening-prevention-application-inspected" && e.step === p.appInspectedStep) &&
    c.trace.some(e => e.type === "opening-prevention-database-inspected" && e.step === p.dbInspectedStep) &&
    !c.trace.some(e => e.type === "incident-opened" && e.step <= o.qualifiedStep) &&
    o.snapshots.every((m, i) => m.step === first + i && m.incoming === Q.grownTraffic && m.admitted === Q.grownTraffic && m.rejected === 0 &&
      m.app.backlog === 0 && m.db.backlog === 0 && (!m.instances || m.instances.every(a => a.backlog === 0)) &&
      m.latencyMs < Q.latencyThresholdMs && m.serviceErrorRate !== null && m.serviceErrorRate < Q.errorThreshold && m.successful + m.failed > 0);
}

/** Idempotent award, shared by live acknowledgement and old input-log recovery. */
export function awardPreventionMilestone(c: Campaign): void {
  if (c.openingMilestone || c.scaling || !verifiedPrevention(c)) return;
  c.openingMilestone = { id: "opening-stability", incidentId: null, outcomeId: "opening-prevention", awardedStep: c.step, acknowledged: false };
  trace(c, "milestone-awarded", { outcomeId: "opening-prevention", outcome: "prevention" });
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
