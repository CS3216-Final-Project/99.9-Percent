import type { Campaign } from "./campaignTypes";
import type { Action, ActionResult, GameState } from "./types";
type Rejection = Extract<ActionResult, { ok: false }>;
const fail = (message: string): Rejection => ({ ok: false, reason: "invalid", message });
import { promotionActive } from "./combinedCampaign";
import { researchBalance } from "./reliability";
import { trace } from "./trace";
import { OPENING_DB as Q } from "./scenarios/openingDatabaseIncident";
import { DATA_STRATEGY as D } from "./scenarios/dataStrategy";
import { LAUNCH_WEEK as L } from "./scenarios/launchWeek";

/** Shared opening tuning: version-2 companies read Launch Week's numbers, version 1 reads the original. */
export function openingTuning(c: Pick<Campaign, "scenarioVersion">): typeof Q | typeof L {
    return c.scenarioVersion === 2 ? L : Q;
}
/** Demand for the current step: the scripted promotion multiplies the base rate while it runs. */
export function launchWeekRate(c: Campaign, at = c.step): number {
    return c.launchWeek && promotionActive(c, at) ? c.incomingRate * L.surgeFactor : c.incomingRate;
}
/** Extra application capacity the autoscaling pick provisions while the surge is live. */
export function launchWeekAutoscaleBonus(c: Campaign): number {
    return c.launchWeek?.tech === "autoscaling" && promotionActive(c) ? L.autoscalerCapacity : 0;
}
/** Requests the caching pick answers itself while the surge is live. */
export function launchWeekCacheHits(c: Campaign, admitted: number): number {
    return c.launchWeek?.tech === "caching" && promotionActive(c) ? Math.floor(admitted * L.cacheHitShare / 10000) : 0;
}
/**
 * Advances the scripted launch week: demand grows until the small database saturates.
 * Completing the week records the step.
 */
export function advanceLaunchWeek(c: Campaign): void {
    const lw = c.launchWeek;
    if (!lw) return;
    if (c.step === L.spikeStep && !c.consumedEvents.includes("launch-week-1")) {
        const from = c.incomingRate;
        c.incomingRate = L.spikeTraffic;
        c.consumedEvents.push("launch-week-1");
        trace(c, "traffic-change", { eventId: "launch-week-1", from, to: c.incomingRate });
    }
    if (c.step === L.growthStep && !c.consumedEvents.includes("launch-week-2")) {
        const from = c.incomingRate;
        c.incomingRate = L.grownTraffic;
        c.consumedEvents.push("launch-week-2");
        trace(c, "traffic-change", { eventId: "launch-week-2", from, to: c.incomingRate });
    }
    if (c.step >= L.researchStep && !lw.researchEarned) {
        lw.researchEarned = 1;
        trace(c, "launch-week-research-earned", { balance: researchBalance(c) });
    }
    if (c.step >= L.surgeStep && !lw.surge) {
        lw.surge = { startStep: c.step, endStep: c.step + L.surgeSteps, endedStep: null, incoming: 0, served: 0 };
        c.promotion = { actionId: "launch-surge", requestedStep: c.step, activationStep: c.step, activatedStep: c.step,
            endStep: lw.surge.endStep, endedStep: null, cooldownUntil: lw.surge.endStep, costCents: 0 };
        trace(c, "promotion-started", { actionId: "launch-surge", factor: L.surgeFactor, endStep: lw.surge.endStep });
    }
    if (lw.surge && lw.surge.endedStep === null && c.step >= lw.surge.endStep) {
        lw.surge.endedStep = c.step;
        c.promotion!.endedStep = c.step;
        trace(c, "promotion-ended", { actionId: "launch-surge", baseline: c.incomingRate });
    }
    if (lw.completedStep === null && c.step >= L.endStep) {
        lw.completedStep = c.step;
        // Surviving the launch is itself the recovered-incident milestone for this scenario version.
        if (!c.openingMilestone) c.openingMilestone = { id: "launch-week", incidentId: null, awardedStep: c.step, acknowledged: false };
        trace(c, "launch-week-completed", { completedStep: c.step, incoming: lw.surge?.incoming ?? 0, served: lw.surge?.served ?? 0 });
    }
}
/** Records the free research pick; everything else belongs to the stage dispatchers. */
export function launchWeekAction(s: GameState, action: Action): Rejection | null | undefined {
    if (action.type !== "pick_launch_tech") return undefined;
    const c = s.campaign!, lw = c.launchWeek;
    if (!lw) return fail("This research pick is only part of a new company's first weeks.");
    if (!lw.researchEarned) return fail("No research point has been granted yet.");
    if (lw.tech) return fail("The research pick is already spent.");
    lw.tech = action.tech;
    if (action.tech === "caching" && !c.readCache) c.readCache = { activatedStep: c.step, warmth: 0, target: D.baseTarget, tuned: false };
    trace(c, "launch-week-tech-picked", { tech: action.tech, balance: researchBalance(c) });
    return null;
}
/**
 * Launch Week's first lesson is load balancing: a bigger App 1 would absorb the week-1 spike alone, so scaling up
 * stays locked until a load balancer shares traffic across two app servers, however early the second was bought.
 */
export function launchWeekScalingOpen(c: Pick<Campaign, "launchWeek" | "loadBalancer" | "routing">): boolean {
    return !c.launchWeek || c.launchWeek.completedStep !== null || (c.loadBalancer && c.routing.targets.length > 1);
}
/** Database work for the requests the apps processed: week 2's new users each cost the database more (per 100). */
export function launchWeekDbWork(c: Campaign, processed: number): number {
    const lw = c.launchWeek;
    return lw && lw.completedStep === null && c.step >= L.growthStep && c.step < L.surgeStep ? Math.ceil(processed * L.grownDbWork / 100) : processed;
}
