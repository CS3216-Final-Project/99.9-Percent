import type { GameState } from "@/sim";
import { newGame } from "@/sim";
export const CAMPAIGN_SAVE_KEY = "nn.campaign.save.v1";
export interface SaveEnvelope {
    schemaVersion: 1;
    scenarioId: "opening-db";
    scenarioVersion: 1;
    runId: string;
    game: GameState;
    runtime: {
        remainderMs: number;
    };
    savedAt: number;
}
export type Validation = {
    status: "ok";
    envelope: SaveEnvelope;
} | {
    status: "corrupt" | "unsupported";
};
function finiteTree(v: unknown): boolean {
    if (typeof v === "number")
        return Number.isFinite(v);
    if (Array.isArray(v))
        return v.every(finiteTree);
    if (v && typeof v === "object")
        return Object.values(v).every(finiteTree);
    return true;
}
function shape(v: unknown, t: unknown): boolean {
    if (t === null)
        return true;
    if (Array.isArray(t))
        return Array.isArray(v);
    if (typeof t === "object")
        return !!v && typeof v === "object" && Object.entries(t).every(([k, x]) => shape((v as Record<string, unknown>)[k], x));
    return typeof v === typeof t;
}
function snapshotValid(m: import("@/sim/campaignTypes").Snapshot): boolean {
    if (!m || !m.app || !m.db)
        return false;
    const components = [m.app, m.db];
    return integer(m.step) && [m.incoming, m.admitted, m.rejected, m.successful, m.failed, m.installedAppCapacity].every(integer) &&
        m.incoming === m.admitted + m.rejected && m.successful === m.db.processed && m.failed === m.app.failed + m.db.failed &&
        components.every(x => [x.demand, x.capacity, x.processed, x.backlog, x.failed].every(integer) && x.capacity > 0 && x.processed <= x.capacity && x.busyUtilisation === x.processed / x.capacity && x.demandRatio === x.demand / x.capacity) &&
        m.db.demand === m.app.processed && m.app.backlog <= 1000 && m.db.backlog <= 600 &&
        m.latencyMs === 100 + 1000 * (m.app.backlog / m.app.capacity + m.db.backlog / m.db.capacity) &&
        m.serviceErrorRate === (m.successful + m.failed ? m.failed / (m.successful + m.failed) : null);
}
const integer = (n: number) => Number.isSafeInteger(n) && n >= 0;
export function validateEnvelope(value: unknown): Validation {
    try {
        if (!value || typeof value !== "object")
            return { status: "corrupt" };
        const e = value as SaveEnvelope;
        if (e.schemaVersion !== 1 || e.scenarioId !== "opening-db" || e.scenarioVersion !== 1)
            return { status: "unsupported" };
        const s = e.game, c = s.campaign!;
        if (!finiteTree(e) || !shape(s, newGame()) || !c || !shape(c, newGame().campaign) ||
            !e.runtime || !integer(e.runtime.remainderMs) || e.runtime.remainderMs >= 1000 ||
            !Number.isFinite(e.savedAt) || typeof e.runId !== "string" || !e.runId || e.runId !== c.runId ||
            c.scenarioId !== e.scenarioId || c.scenarioVersion !== e.scenarioVersion ||
            !["management", "incident", "review", "ended"].includes(s.phase) ||
            (s.phase === "ended" ? s.outcome !== "bankrupt" : s.outcome !== null) ||
            (s.phase === "review" && (!c.reports.length || c.reports.at(-1)!.recoveredStep !== c.step)) ||
            s.cash !== c.cashCents / 100 || s.users !== 2000 || s.engineers !== 4 || s.infra.appHosts.length !== c.apps.length ||
            !integer(c.step) || !Number.isSafeInteger(c.cashCents) || !integer(c.nextEventId) ||
            !integer(c.overloadSteps) || c.lastSettledPeriod !== Math.floor(c.step / 60) ||
            !snapshotValid(c.snapshot) || c.snapshot.step !== c.step || ![600, 1000].includes(c.dbCapacity) ||
            !integer(c.dbBacklog) || c.dbBacklog > 600 || ![null, 500].includes(c.limit) ||
            c.apps.length < 1 || c.apps.length > 2 ||
            c.apps.some((a, i) => a.id !== `app-${i + 1}` || a.capacity !== 1000 || a.routed !== (i === 0) || !integer(a.backlog) || a.backlog > 1000) ||
            (s.phase !== "ended" && (s.phase === "incident") !== !!c.incident) ||
            (c.incident && (!integer(c.incident.stableSteps) || c.incident.stableSteps >= 5 || (!Array.isArray(c.incident.snapshots) || !c.incident.snapshots.every(snapshotValid)))) ||
            !Object.values(c.remainders).every(v => integer(v) && v < 60) ||
            !Object.values(c.ledger).every(integer) ||
            !Object.values(c.cumulative).every(integer) ||
            c.cumulative.admitted !== c.cumulative.successful + c.cumulative.failed + c.apps.reduce((n, a) => n + a.backlog, 0) + c.dbBacklog ||
            ![300, 800].includes(c.incomingRate) || c.upgraded !== (c.dbCapacity === 1000) ||
            c.snapshot.db.backlog !== c.dbBacklog || c.snapshot.app.backlog !== c.apps[0].backlog ||
            c.snapshot.db.capacity !== c.dbCapacity || c.snapshot.installedAppCapacity !== c.apps.length * 1000 ||
            (c.step >= 4) !== c.consumedEvents.includes("opening-growth") ||
            c.actions.some(a => typeof a.id !== "string" || !["add-app", "upgrade-db", "limit", "unlimit"].includes(a.type) || !integer(a.requestedStep) || a.requestedStep > c.step || !integer(a.activationStep) || a.activationStep <= a.requestedStep || !integer(a.costCents) || (a.activatedStep !== null && (!integer(a.activatedStep) || a.activatedStep !== a.activationStep || a.activatedStep > c.step))) ||
            c.settlements.length !== c.lastSettledPeriod ||
            !c.settlements.every((p, i) => p.period === i + 1 && p.step === (i + 1) * 60 && [p.revenueCents, p.appCents, p.dbCents, p.salaryCents].every(integer) && p.netCents === p.revenueCents - p.appCents - p.dbCents - p.salaryCents) ||
            c.pending.some(a => !["add-app", "upgrade-db", "limit", "unlimit"].includes(a.type) || !integer(a.activationStep) || a.activationStep <= c.step || !integer(a.requestedStep) || a.requestedStep > c.step || !integer(a.costCents) || a.activatedStep !== null) ||
            new Set(c.pending.map(a => a.id)).size !== c.pending.length ||
            c.pending.some(a => !c.actions.some(b => b.id === a.id && b.activationStep === a.activationStep)) ||
            !c.trace.every((t, i) => t.id === i + 1 && integer(t.step) && t.step <= c.step && typeof t.type === "string" && !!t.data) || c.nextEventId !== c.trace.length + 1 ||
            !c.recent.every(snapshotValid) ||
            !c.reports.every(p => integer(p.openedStep) && integer(p.recoveredStep) && p.openedStep <= p.recoveredStep && p.recoveredStep <= c.step &&
            integer(p.setupCents) && typeof p.limited === "boolean" && typeof p.id === "string" && Array.isArray(p.snapshots) && p.snapshots.length > 0 && Array.isArray(p.events) && Array.isArray(p.explanations) && p.snapshots.every(snapshotValid) && p.explanations.every(t => typeof t === "string")))
            return { status: "corrupt" };
        return { status: "ok", envelope: e };
    }
    catch {
        return { status: "corrupt" };
    }
}
export function decodeSave(raw: string): Validation {
    try {
        return validateEnvelope(JSON.parse(raw));
    }
    catch {
        return { status: "corrupt" };
    }
}
export function makeEnvelope(game: GameState, remainderMs = 0, savedAt = Date.now()): SaveEnvelope {
    return { schemaVersion: 1, scenarioId: "opening-db", scenarioVersion: 1, runId: game.campaign!.runId, game, runtime: { remainderMs }, savedAt };
}
/** Future migrations must preserve source bytes before replacing a validated slot. No v0 conversion is registered. */
export type MigrationRegistry = Readonly<Record<number, (value: unknown) => unknown>>;
export function migrateSave(storage: Pick<Storage, "getItem" | "setItem">, migrations: MigrationRegistry = {}): boolean {
    try {
        const original = storage.getItem(CAMPAIGN_SAVE_KEY);
        if (original === null)
            return false;
        let value = JSON.parse(original) as {
            schemaVersion?: number;
        };
        const sourceVersion = value.schemaVersion;
        if (typeof sourceVersion !== "number" || sourceVersion >= 1 || !migrations[sourceVersion])
            return false;
        const backup = `${CAMPAIGN_SAVE_KEY}.backup.v${sourceVersion}`;
        if (storage.getItem(backup) !== null && storage.getItem(backup) !== original)
            return false;
        storage.setItem(backup, original);
        while (typeof value.schemaVersion === "number" && value.schemaVersion < 1) {
            const version = value.schemaVersion, migrate = migrations[version];
            if (!migrate)
                return false;
            value = migrate(value) as {
                schemaVersion?: number;
            };
            if (!value || value.schemaVersion !== version + 1)
                return false;
        }
        const result = validateEnvelope(value);
        if (result.status !== "ok")
            return false;
        storage.setItem(CAMPAIGN_SAVE_KEY, JSON.stringify(result.envelope));
        return true;
    }
    catch {
        return false;
    }
}
