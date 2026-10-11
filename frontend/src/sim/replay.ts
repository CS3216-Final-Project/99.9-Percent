import type { GameState } from "./types";
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
export function replayCampaign(seed: number, runId: string, inputs: readonly CampaignInput[], finalStep: number, legacyMilestones = false, foundation?: {step:number;inputs:number}): GameState {
    if (!Number.isSafeInteger(finalStep) || finalStep < 0 || finalStep > MAX_REPLAY_STEPS)
        throw new Error("Replay step is out of range");
    if (inputs.length > MAX_REPLAY_INPUTS)
        throw new Error("Replay has too many inputs");
    // The fresh state is private to this replay, so every step and input can mutate it.
    const s = newGame(seed, runId);
    if(foundation)s.campaign!.foundation={...foundation};
    for (const input of inputs) {
        if (!Number.isSafeInteger(input.step) || input.step > finalStep)
            throw new Error("Input step is out of range");
        advanceTo(s, input.step);
        if (input.action.type !== "acknowledge_prevention_review") acknowledgeUnseenPrevention(s);
        applyCampaignInputInPlace(s, input.action);
        // Phase 1 acknowledgement already returned to management: preserve that state.
        // Record the added acknowledgement so subsequent saves replay exactly.
        if(legacyMilestones && s.campaign!.openingMilestone?.incidentId && !s.campaign!.openingMilestone.acknowledged) {
            if(s.campaign!.foundation)s.campaign!.foundation.inputs++;
            applyCampaignInputInPlace(s, {type:"acknowledge_milestone", enterScaling:false});
        }
    }
    advanceTo(s, finalStep);
    return projectCampaign(s);
}

function advanceTo(s: GameState, target: number): void {
    if (s.campaign!.step > target)
        throw new Error("Inputs are out of order");
    while (s.campaign!.step < target) {
        acknowledgeUnseenPrevention(s);
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
