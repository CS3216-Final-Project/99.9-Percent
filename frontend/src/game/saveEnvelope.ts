import type { GameState } from "@/sim";
import { replayCampaign } from "@/sim";
import type { CampaignInput } from "@/sim/campaignTypes";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";
export const CAMPAIGN_SAVE_KEY = "nn.campaign.save.v1";
export const SCHEMA_VERSION = 1;
/**
 * A save holds the run's identity and the player's inputs, not the state they
 * produced. Loading replays the inputs on the deterministic engine, so a save
 * stays small however long the run, and an edited save can only describe a run
 * the engine could actually have played.
 */
export interface SaveEnvelope {
    schemaVersion: typeof SCHEMA_VERSION;
    scenarioId: string;
    scenarioVersion: number;
    runId: string;
    seed: number;
    step: number;
    inputs: CampaignInput[];
    runtime: {
        remainderMs: number;
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
    if (e.schemaVersion !== SCHEMA_VERSION || e.scenarioId !== Q.id || e.scenarioVersion !== Q.version)
        return { status: "unsupported" };
    if (typeof e.runId !== "string" || !e.runId || !Number.isSafeInteger(e.seed) || (e.seed | 0) !== e.seed || !integer(e.step) ||
        !Array.isArray(e.inputs) || !e.inputs.every(isInput) ||
        !e.runtime || !integer(e.runtime.remainderMs) || e.runtime.remainderMs >= 1000 || !Number.isFinite(e.savedAt))
        return { status: "corrupt" };
    try {
        return { status: "ok", envelope: e, game: replayCampaign(e.seed, e.runId, e.inputs, e.step) };
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
export function makeEnvelope(game: GameState, remainderMs = 0, savedAt = Date.now()): SaveEnvelope {
    const c = game.campaign!;
    return { schemaVersion: SCHEMA_VERSION, scenarioId: c.scenarioId, scenarioVersion: c.scenarioVersion, runId: c.runId, seed: game.seed, step: c.step, inputs: c.inputs, runtime: { remainderMs }, savedAt };
}
/** Never replace an existing save unless its payload can actually be replayed. */
export function replaceable(raw: string | null): boolean {
    return raw === null || decodeSave(raw).status === "ok";
}
