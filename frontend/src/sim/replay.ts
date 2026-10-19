import type { GameState } from "./types";
import { emptyServiceMeasurement } from "./campaignScorecard";
import type { ServiceMeasurement } from "./campaignTypes";
import type { CampaignInput } from "./campaignTypes";
import { newGame } from "./state";
import { applyCampaignInputInPlace, pendingStop, projectCampaign, stepInPlace } from "./step";
import { pendingPreventionReview } from "./openingPrevention";

/** Replays longer than this are refused rather than freezing the page on a hostile file. */
export const MAX_REPLAY_STEPS = 1_000_000;
/** Many inputs can share one step, so their number is limited separately. */
export const MAX_REPLAY_INPUTS = 100_000;

/**
 * Rebuild a campaign from its seed, identity and recorded inputs. The engine is
 * deterministic, so the result equals the state the inputs were recorded from.
 * Throws when the inputs could not have been recorded by a real run.
 */
export function replayCampaign(seed: number, runId: string, inputs: readonly CampaignInput[], finalStep: number, legacyMilestones = false, foundation?: {step:number;inputs:number}, legacyPrevention = false, legacyPreventionInputs = 0, serviceMeasurementStart?: Pick<ServiceMeasurement,"fromStep"|"scope">): GameState {
    if (!Number.isSafeInteger(finalStep) || finalStep < 0 || finalStep > MAX_REPLAY_STEPS)
        throw new Error("Replay step is out of range");
    if (inputs.length > MAX_REPLAY_INPUTS)
        throw new Error("Replay has too many inputs");
    // The fresh state is private to this replay, so every step and input can mutate it.
    const s = newGame(seed, runId);
    if (serviceMeasurementStart) s.campaign!.serviceMeasurement = emptyServiceMeasurement(serviceMeasurementStart.fromStep, serviceMeasurementStart.scope);
    if (!Number.isSafeInteger(legacyPreventionInputs) || legacyPreventionInputs<0 || legacyPreventionInputs>inputs.length)
        throw new Error("Legacy prevention input prefix is out of range");
    if(legacyPreventionInputs)s.campaign!.legacyPreventionInputs=legacyPreventionInputs;
    if(foundation)s.campaign!.foundation={...foundation};
    let inputIndex=0;
    for (const input of inputs) {
        if(inputIndex===legacyPreventionInputs)clearUnenteredPreventionMilestone(s);
        if (!Number.isSafeInteger(input.step) || input.step > finalStep)
            throw new Error("Input step is out of range");
        advanceTo(s, input.step, legacyPrevention);
        if (legacyPrevention && input.action.type !== "acknowledge_prevention_review") acknowledgeUnseenPrevention(s);
        applyCampaignInputInPlace(s, input.action, inputIndex++<legacyPreventionInputs);
        // Phase 1 acknowledgement already returned to management: preserve that state.
        // Record the added acknowledgement so subsequent saves replay exactly.
        if(legacyMilestones && s.campaign!.openingMilestone?.incidentId && !s.campaign!.openingMilestone.acknowledged) {
            if(s.campaign!.foundation)s.campaign!.foundation.inputs++;
            applyCampaignInputInPlace(s, {type:"acknowledge_milestone", enterScaling:false});
        }
    }
    clearUnenteredPreventionMilestone(s);
    advanceTo(s, finalStep, legacyPrevention);
    return projectCampaign(s);
}

/** Keep already-entered companies intact; only an explicit schema-8 claim grants a new continuation from prevention. */
function clearUnenteredPreventionMilestone(s: GameState): void {
    const c=s.campaign!;
    if(!c.scaling && c.openingMilestone?.outcomeId==="opening-prevention" && c.openingMilestone.claimedStep===undefined)c.openingMilestone=null;
}

function advanceTo(s: GameState, target: number, legacyPrevention: boolean): void {
    if (s.campaign!.step > target)
        throw new Error("Inputs are out of order");
    while (s.campaign!.step < target) {
        if (legacyPrevention) acknowledgeUnseenPrevention(s);
        if (s.phase === "review" || s.phase === "ended" || pendingStop(s.campaign))
            throw new Error("The run cannot advance past a review, recognition or bankruptcy");
        stepInPlace(s);
    }
}

/**
 * A run recorded before Opening prevention existed may qualify for it on replay, but never paused for
 * its review. A run recorded since cannot step or decide anything else until it acknowledges, so
 * acknowledging on its behalf here only ever applies to those older runs.
 */
function acknowledgeUnseenPrevention(s: GameState): void {
    if (!pendingPreventionReview(s.campaign)) return;
    const foundation = s.campaign!.foundation;
    if (foundation && s.campaign!.inputs.length < foundation.inputs) foundation.inputs++;
    applyCampaignInputInPlace(s, { type: "acknowledge_prevention_review" });
}
