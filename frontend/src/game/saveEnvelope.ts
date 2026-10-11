import type { GameState } from "@/sim";
import { replayCampaign } from "@/sim";
import type { CampaignInput } from "@/sim/campaignTypes";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";
import { emptyMeasurement, measurementValid, type Measurement } from "./telemetry";
export const CAMPAIGN_SAVE_KEY = "nn.campaign.save.v1";
export const SCHEMA_VERSION = 5;
/**
 * A save holds the run's identity and the player's inputs, not the state they
 * produced. Loading replays the inputs on the deterministic engine, so a save
 * stays small however long the run, and an edited save can only describe a run
 * the engine could actually have played.
 */
export interface SaveEnvelope {
    schemaVersion: typeof SCHEMA_VERSION;
    scenarioId: "opening-db";
    scenarioVersion: 1;
    runId: string;
    seed: number;
    step: number;
    inputs: CampaignInput[];
    foundation?: { step: number; inputs: number };
    runtime: {
        remainderMs: number;
        measurement: Measurement;
    };
    savedAt: number;
}
export type Validation = {
    status: "ok";
    envelope: SaveEnvelope;
    game: GameState;
} | {
    status: "corrupt" | "unsupported";
};
const integer = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) >= 0;
const isInput = (i: CampaignInput) => !!i && typeof i === "object" && integer(i.step) &&
    !!i.action && typeof i.action === "object" && typeof i.action.type === "string";
export function validateEnvelope(value: unknown): Validation {
    if (!value || typeof value !== "object")
        return { status: "corrupt" };
    const e = value as SaveEnvelope;
    const legacy = (e as {schemaVersion: number}).schemaVersion === 1;
    const phase3 = (e as {schemaVersion: number}).schemaVersion === 3;
    const phase4 = (e as {schemaVersion: number}).schemaVersion === 4;
    const phase2 = (e as {schemaVersion: number}).schemaVersion === 2;
    if ((!legacy && !phase2 && !phase3 && !phase4 && e.schemaVersion !== SCHEMA_VERSION) || e.scenarioId !== Q.id || e.scenarioVersion !== Q.version)
        return { status: "unsupported" };
    if (typeof e.runId !== "string" || !e.runId || !Number.isSafeInteger(e.seed) || (e.seed | 0) !== e.seed || !integer(e.step) ||
        !Array.isArray(e.inputs) || !e.inputs.every(isInput) ||
        !e.runtime || !integer(e.runtime.remainderMs) || e.runtime.remainderMs >= 1000 || !Number.isFinite(e.savedAt))
        return { status: "corrupt" };
    // Earlier replay contracts cannot contain decisions introduced in Phase 4.
    const dataActions = ["enter_data", "contrast_workload", "deploy_cache", "tune_cache"];
    if ((legacy || phase2 || phase3) && e.inputs.some(i => dataActions.includes(i.action.type)))
        return {status:"corrupt"};
    const spikeActions = ["enter_spikes", "unlock_autoscaling", "deploy_autoscaler", "set_autoscaling", "acknowledge_spikes"];
    if ((legacy || phase2 || phase3 || phase4) && e.inputs.some(i => spikeActions.includes(i.action.type))) return {status:"corrupt"};
    try {
        // Old milestone acknowledgements predate scaling. Loading them must not enter the new stage.
        const inputs = legacy || phase2 ? e.inputs.map(input => input.action.type === "acknowledge_milestone"
            ? {...input, action: {...input.action, enterScaling: false}} : input) : e.inputs;
        const foundation = legacy || phase2 ? {step:e.step, inputs:inputs.length} : e.foundation;
        if(foundation && (!integer(foundation.step) || foundation.step>e.step || !integer(foundation.inputs) || foundation.inputs>inputs.length ||
            inputs.slice(0,foundation.inputs).some(input=>input.step>foundation.step || ["enter_scaling","scale_up","deploy_load_balancer","set_routing",...dataActions,...spikeActions].includes(input.action.type) ||
                (input.action.type==="acknowledge_milestone" && input.action.enterScaling!==false)))) return {status:"corrupt"};
        const game = replayCampaign(e.seed, e.runId, inputs, e.step, legacy, foundation);
        if(legacy && game.campaign!.foundation)game.campaign!.foundation.inputs=game.campaign!.inputs.length;
        const measurement: Measurement = legacy
            ? {...emptyMeasurement(), origin:"phase1", runStarted:true, cursor:game.campaign!.trace.length}
            : e.runtime.measurement;
        if(!measurementValid(measurement) || measurement.cursor > game.campaign!.trace.length ||
            measurement.pending.some(event => event.runId !== e.runId)) return {status:"corrupt"};
        return { status: "ok", envelope: makeEnvelope(game, e.runtime.remainderMs, e.savedAt, measurement), game };
    }
    catch {
        return { status: "corrupt" };
    }
}
/** Parse a stored or imported save. */
export function decodeSave(raw: string): Validation {
    let value: unknown;
    try {
        value = JSON.parse(raw);
    }
    catch {
        return { status: "corrupt" };
    }
    return validateEnvelope(value);
}
export function makeEnvelope(game: GameState, remainderMs = 0, savedAt = Date.now(), measurement: Measurement = emptyMeasurement()): SaveEnvelope {
    const c = game.campaign!;
    return { schemaVersion: SCHEMA_VERSION, scenarioId: c.scenarioId, scenarioVersion: c.scenarioVersion, runId: c.runId, seed: game.seed, step: c.step, inputs: c.inputs, ...(c.foundation?{foundation:c.foundation}:{}), runtime: { remainderMs, measurement }, savedAt };
}
/** Never replace an existing save unless its payload can actually be replayed. */
export function replaceable(raw: string | null): boolean {
    return raw === null || decodeSave(raw).status === "ok";
}
