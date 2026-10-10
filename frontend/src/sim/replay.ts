import type { GameState } from "./types";
import type { CampaignInput } from "./campaignTypes";
import { newGame } from "./state";
import { applyCampaignInputInPlace, projectCampaign, stepInPlace } from "./step";

/** Replays longer than this are refused rather than freezing the page on a hostile file. */
export const MAX_REPLAY_STEPS = 1_000_000;
/** Many inputs can share one step, so their number is limited separately. */
export const MAX_REPLAY_INPUTS = 100_000;

/**
 * Rebuild a campaign from its seed, identity and recorded inputs. The engine is
 * deterministic, so the result equals the state the inputs were recorded from.
 * Throws when the inputs could not have been recorded by a real run.
 */
export function replayCampaign(seed: number, runId: string, inputs: readonly CampaignInput[], finalStep: number, legacyMilestones = false): GameState {
    if (!Number.isSafeInteger(finalStep) || finalStep < 0 || finalStep > MAX_REPLAY_STEPS)
        throw new Error("Replay step is out of range");
    if (inputs.length > MAX_REPLAY_INPUTS)
        throw new Error("Replay has too many inputs");
    // The fresh state is private to this replay, so every step and input can mutate it.
    const s = newGame(seed, runId);
    for (const input of inputs) {
        if (!Number.isSafeInteger(input.step) || input.step > finalStep)
            throw new Error("Input step is out of range");
        advanceTo(s, input.step);
        applyCampaignInputInPlace(s, input.action);
        // Phase 1 acknowledgement already returned to management: preserve that state.
        // Record the added acknowledgement so subsequent schema-2 saves replay exactly.
        if(legacyMilestones && s.campaign!.openingMilestone && !s.campaign!.openingMilestone.acknowledged)
            applyCampaignInputInPlace(s, {type:"acknowledge_milestone"});
    }
    advanceTo(s, finalStep);
    return projectCampaign(s);
}

function advanceTo(s: GameState, target: number): void {
    if (s.campaign!.step > target)
        throw new Error("Inputs are out of order");
    while (s.campaign!.step < target) {
        if (s.phase === "review" || s.phase === "ended")
            throw new Error("The run cannot advance past a review or bankruptcy");
        stepInPlace(s);
    }
}
