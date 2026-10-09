import type { Action, GameState } from "@/sim";
import { replayCampaign } from "@/sim";
import type { CampaignInput, Campaign } from "@/sim/campaignTypes";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";
export const CAMPAIGN_SAVE_KEY = "nn.campaign.save.v1";
export const SCHEMA_VERSION = 2;
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
/** Parse a stored or imported save, converting older schema versions in memory. */
export function decodeSave(raw: string): Validation {
    let value: unknown;
    try {
        value = upgrade(JSON.parse(raw), MIGRATIONS);
    }
    catch {
        return { status: "corrupt" };
    }
    return value === null ? { status: "unsupported" } : validateEnvelope(value);
}
export function makeEnvelope(game: GameState, remainderMs = 0, savedAt = Date.now()): SaveEnvelope {
    const c = game.campaign!;
    return { schemaVersion: SCHEMA_VERSION, scenarioId: c.scenarioId, scenarioVersion: c.scenarioVersion, runId: c.runId, seed: game.seed, step: c.step, inputs: c.inputs, runtime: { remainderMs }, savedAt };
}
/** True when `raw` is absent or already in the current format, so writing over it loses nothing. */
export function replaceable(raw: string | null): boolean {
    if (raw === null)
        return true;
    try {
        const header = JSON.parse(raw) as Partial<SaveEnvelope>;
        return header.schemaVersion === SCHEMA_VERSION && header.scenarioId === Q.id && header.scenarioVersion === Q.version;
    }
    catch {
        return false;
    }
}
/* ------------------------------------------------------------------ */
/* Schema 1 stored the whole state. Its trace already names every input. */
/* ------------------------------------------------------------------ */
interface V1Envelope {
    schemaVersion: 1;
    scenarioId: string;
    scenarioVersion: number;
    runId: string;
    game: GameState;
    runtime: { remainderMs: number };
    savedAt: number;
}
const INTERVENTIONS: Record<string, Action> = {
    "add-app": { type: "add_server" },
    "upgrade-db": { type: "start_db_upgrade" },
    "limit": { type: "set_traffic_limit", enabled: true },
    "unlimit": { type: "set_traffic_limit", enabled: false },
};
function inputsFromTrace(c: Campaign): CampaignInput[] {
    // Admission changes activate one at a time, so the last one active by a step gives the setting then.
    const limitedAt = (step: number) => c.actions.filter(a => (a.type === "limit" || a.type === "unlimit") && a.activatedStep !== null && a.activatedStep <= step).at(-1)?.type === "limit";
    return c.trace.flatMap((t): CampaignInput[] => {
        const at = (action: Action) => [{ step: t.step, action }];
        if (t.type === "action-requested")
            return at(INTERVENTIONS[String(t.data.type)]);
        if (t.type === "inspection")
            return at({ type: "incident_inspect", equipment: t.data.component } as Action);
        if (t.type === "review-acknowledged")
            return at({ type: "acknowledge_review" });
        // A rejection only records the action's type. Any action of that type is rejected
        // with the same reason, except that a traffic limit change is rejected only when it
        // re-requests the current setting. The replay check below confirms the choice.
        if (t.type === "action-rejected") {
            const type = String(t.data.action);
            return at((type === "set_traffic_limit" ? { type, enabled: limitedAt(t.step) } :
                type === "incident_inspect" ? { type, equipment: "standby" } : { type }) as Action);
        }
        return [];
    });
}
/** Key-order-independent JSON form, for comparing a stored state with a replayed one. */
function canonical(v: unknown): string {
    return JSON.stringify(v, (_, x: unknown) => x && typeof x === "object" && !Array.isArray(x)
        ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1)))
        : x);
}
/** Converts only when the recovered inputs replay to exactly the stored state. */
function v1ToV2(value: unknown): SaveEnvelope {
    const e = value as V1Envelope, game = e.game;
    const next: SaveEnvelope = {
        schemaVersion: 2, scenarioId: e.scenarioId, scenarioVersion: e.scenarioVersion, runId: e.runId,
        seed: game.seed, step: game.campaign!.step, inputs: inputsFromTrace(game.campaign!), runtime: e.runtime, savedAt: e.savedAt,
    };
    const result = validateEnvelope(next);
    if (result.status !== "ok")
        throw new Error("Schema 1 save does not replay");
    const { inputs: _, ...replayed } = result.game.campaign!;
    if (canonical({ ...result.game, campaign: replayed }) !== canonical(game))
        throw new Error("Schema 1 save replays to a different state");
    return next;
}
export const MIGRATIONS: MigrationRegistry = { 1: v1ToV2 };
/** Apply registered migrations up to the current version. Null when a version has no path forward. */
function upgrade(value: unknown, migrations: MigrationRegistry): unknown {
    let v = value as { schemaVersion?: unknown };
    while (v && typeof v === "object" && typeof v.schemaVersion === "number" && v.schemaVersion < SCHEMA_VERSION) {
        const version = v.schemaVersion, migrate = migrations[version];
        if (!migrate)
            return null;
        v = migrate(v) as { schemaVersion?: unknown };
        if (!v || v.schemaVersion !== version + 1)
            return null;
    }
    return v;
}
/** Migrations preserve the source bytes under a backup key before replacing a validated slot. */
export type MigrationRegistry = Readonly<Record<number, (value: unknown) => unknown>>;
export function migrateSave(storage: Pick<Storage, "getItem" | "setItem">, migrations: MigrationRegistry = MIGRATIONS): boolean {
    try {
        const original = storage.getItem(CAMPAIGN_SAVE_KEY);
        if (original === null)
            return false;
        const value = JSON.parse(original) as {
            schemaVersion?: number;
        };
        const sourceVersion = value.schemaVersion;
        if (typeof sourceVersion !== "number" || sourceVersion >= SCHEMA_VERSION || !migrations[sourceVersion])
            return false;
        const backup = `${CAMPAIGN_SAVE_KEY}.backup.v${sourceVersion}`;
        if (storage.getItem(backup) !== null && storage.getItem(backup) !== original)
            return false;
        storage.setItem(backup, original);
        const upgraded = upgrade(value, migrations);
        if (upgraded === null)
            return false;
        const result = validateEnvelope(upgraded);
        if (result.status !== "ok")
            return false;
        storage.setItem(CAMPAIGN_SAVE_KEY, JSON.stringify(result.envelope));
        return true;
    }
    catch {
        return false;
    }
}
