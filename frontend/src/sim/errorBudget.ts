import type { Campaign, ErrorBudget, Snapshot } from "./campaignTypes";
import type { Action, ActionResult, GameState } from "./types";
import { ERROR_BUDGET as B } from "./scenarios/errorBudget";
import { TRAFFIC_SPIKES as T } from "./scenarios/trafficSpikes";
import { APPLICATION_RELIABILITY as R } from "./scenarios/applicationReliability";
import { COMBINED_CAMPAIGN as C, growthUsers } from "./scenarios/combinedCampaign";
import { clone } from "./state";
import { trace } from "./trace";

export type BudgetScenario = "spikes" | "reliability" | "growth";
export const BUDGET_NAMES: Record<BudgetScenario, string> = { spikes: "Traffic Spikes", reliability: "Stay Online test", growth: "Growth wave" };

/** Requests the company failed or turned away. Both count against uptime and against an error budget. */
export const lostRequests = (c: Campaign) => c.cumulative.failed + c.cumulative.rejected;
/** Request uptime: the share of decided requests that were served. Requests still queued are not yet decided. */
export function requestUptime(successful: number, failed: number, rejected: number): number | null {
 const decided = successful + failed + rejected;
 return decided > 0 ? successful / decided : null;
}
/** Uptime over the last `steps` recorded game seconds, or null without that much history. */
export function windowUptime(recent: readonly Snapshot[], steps: number): number | null {
 const xs = recent.slice(-steps);
 if (xs.length < steps) return null;
 return requestUptime(xs.reduce((n, x) => n + x.successful, 0), xs.reduce((n, x) => n + x.failed, 0), xs.reduce((n, x) => n + x.rejected, 0));
}
export function startBudget(c: Campaign, scenario: BudgetScenario, scheduledDemand: number, attempt: number): ErrorBudget {
 const b: ErrorBudget = { scenario, fromStep: c.step, scheduledDemand, allowance: Math.floor(scheduledDemand * B.scenarioShareBasisPoints / 10000), lostBefore: lostRequests(c), attempt, judged: null, retriedStep: null };
 trace(c, "error-budget-started", { scenario, allowance: b.allowance, scheduledDemand, attempt });
 return b;
}
/** Requests lost since the budget started; frozen once its scenario has been judged. */
export const budgetUsed = (c: Campaign, b: ErrorBudget) => b.judged ? b.judged.lost : lostRequests(c) - b.lostBefore;
/** Judge a scenario that has otherwise completed. Returns whether it stayed within its budget. */
export function judgeBudget(c: Campaign, b: ErrorBudget | null | undefined): boolean {
 if (!b) return true;
 const lost = budgetUsed(c, b), within = lost <= b.allowance;
 b.judged = { step: c.step, lost, within };
 trace(c, within ? "error-budget-met" : "error-budget-exceeded", { scenario: b.scenario, lost, allowance: b.allowance, attempt: b.attempt });
 return within;
}

/** Demand Traffic Spikes schedules from entry until its five stable baseline seconds can finish. */
export function spikeScheduledDemand(): number {
 let n = 0;
 for (let k = 1; k <= T.offsets[3] + B.stableSteps; k++) n += (k >= T.offsets[0] && k < T.offsets[1]) || (k >= T.offsets[2] && k < T.offsets[3]) ? T.peak : T.baseline;
 return n;
}
/** Demand the Stay Online test schedules: the lead time, a failure lasting until natural restoration, then five stable seconds. */
export const reliabilityScheduledDemand = (incoming: number) => (R.faultDelay + R.faultDuration + B.stableSteps) * incoming;
/** Demand a growth wave schedules: its announcement, its pressure, then five stable seconds at the new baseline. */
export const waveScheduledDemand = (current: number, peak: number, duration: number, baseline: number) =>
 C.warningSteps * current + duration * peak + B.stableSteps * baseline;

/** The over-budget scenario awaiting the player's retry, if any. */
export function pendingRetry(c: Campaign | undefined): ErrorBudget | null {
 for (const b of [c?.combinedStage?.currentRound?.budget, c?.reliabilityStage?.budget, c?.spikeStage?.budget]) if (b?.judged && !b.judged.within && b.retriedStep === null) return b;
 return null;
}

type Rejection = Extract<ActionResult, { ok: false }>;
/** Restart the over-budget scenario with the same company. `undefined` means the action belongs elsewhere. */
export function retryAction(s: GameState, action: Action): Rejection | null | undefined {
 if (action.type !== "retry_scenario") return undefined;
 const c = s.campaign!, b = pendingRetry(c);
 if (!b || s.phase !== "management") return { ok: false, reason: "invalid", message: "No scenario is over its error budget." };
 b.retriedStep = c.step;
 if (b.scenario === "spikes") {
  const d = c.spikeStage!;
  d.deadlines = T.offsets.map(x => c.step + x); d.consumed = []; d.baselineStableSteps = 0;
  d.budget = startBudget(c, "spikes", spikeScheduledDemand(), b.attempt + 1);
  trace(c, "traffic-spikes-announced", { deadlines: JSON.stringify(d.deadlines), baseline: T.baseline, peak: T.peak });
 } else if (b.scenario === "reliability") {
  const d = c.reliabilityStage!;
  d.fault = null; d.stableSteps = 0; d.failureSteps = 0;
 } else {
  const d = c.combinedStage!, r = d.currentRound!;
  (d.retriedRounds ??= []).push(clone(r));
  d.currentRound = null; d.readinessSteps = 0;
  d.users = r.index === 0 ? C.initialUsers : growthUsers(d.finalUserTarget, r.index - 1);
  if (d.users < d.finalUserTarget) d.targetReachedStep = null;
 }
 trace(c, "scenario-retried", { scenario: b.scenario, attempt: b.attempt });
 return null;
}
