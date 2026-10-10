import type { GameState, Action, ActionResult } from "./types";
import type { Campaign, Snapshot, ComponentSnapshot, Intervention } from "./campaignTypes";
import { clone } from "./state";
import { OPENING_DB as Q } from "./scenarios/openingDatabaseIncident";
import { emptyLedger, accruePeriod, settlePeriod } from "./settlement";
import { trace, causalPostmortem } from "./trace";
export function processWork(backlog: number, demand: number, capacity: number, limit: number): ComponentSnapshot {
    const processed = Math.min(backlog + demand, capacity);
    const unfinished = backlog + demand - processed;
    return {
        demand, capacity, processed, backlog: Math.min(unfinished, limit),
        failed: Math.max(0, unfinished - limit), busyUtilisation: processed / capacity, demandRatio: demand / capacity
    };
}
export function initialCampaign(runId: string): Campaign {
    const app = processWork(0, Q.startingTraffic, Q.appCapacity, Q.appBacklogLimit);
    const db = processWork(0, Q.startingTraffic, Q.dbCapacity, Q.dbBacklogLimit);
    const snapshot: Snapshot = {
        step: 0, incoming: Q.startingTraffic, admitted: Q.startingTraffic, rejected: 0,
        app, db, installedAppCapacity: Q.appCapacity, successful: 300, failed: 0, latencyMs: 100, serviceErrorRate: 0
    };
    const c: Campaign = {
        scenarioId: Q.id, scenarioVersion: Q.version, runId, step: 0,
        incomingRate: Q.startingTraffic, limit: null,
        apps: [{ id: "app-1", capacity: Q.appCapacity, backlog: 0, routed: true }],
        dbCapacity: Q.dbCapacity, dbBacklog: 0, upgraded: false, cashCents: Q.startingCashCents,
        ledger: emptyLedger(), remainders: { app: 0, db: 0, salary: 0 }, settlements: [], lastSettledPeriod: 0,
        revenueCents: 0, costsCents: 0, investedCents: 0,
        cumulative: { admitted: 0, rejected: 0, successful: 0, failed: 0 },
        pending: [], actions: [], inputs: [], consumedEvents: [], overloadSteps: 0, incident: null, reports: [],
        openingRecovered: false, firstPauseConsumed: false, snapshot, recent: [], trace: [], nextEventId: 1,
    };
    trace(c, "scenario", { scenarioId: Q.id, version: Q.version, configuration: JSON.stringify(Q) });
    return c;
}
/** Legacy fields are view compatibility projections, never physical inputs. */
export function projectCampaign(s: GameState): GameState {
    const c = s.campaign!;
    s.cash = c.cashCents / 100;
    s.users = Q.users;
    s.engineers = Q.engineers;
    s.turn = Math.floor(c.step / Q.periodSteps) + 1;
    s.infra.appHosts = c.apps.map(a => ({ id: a.id, status: "healthy", bornTurn: 1 }));
    s.infra.nextHostNum = c.apps.length + 1;
    s.infra.dbTier = c.upgraded ? 1 : 0;
    s.live = {
        peakRps: c.snapshot.incoming, tempServers: 0, latencyMs: c.snapshot.latencyMs,
        errorRate: c.snapshot.serviceErrorRate ?? 0, availability: 1 - (c.snapshot.serviceErrorRate ?? 0), shed: c.snapshot.rejected
    };
    s.totals.revenue = c.revenueCents / 100;
    s.totals.costs = c.costsCents / 100;
    s.totals.invested = c.investedCents / 100;
    s.totals.weeks = c.lastSettledPeriod;
    return s;
}
export function qualifiesForRecovery(m: Snapshot): boolean {
    return m.latencyMs < Q.latencyThresholdMs && m.serviceErrorRate !== null &&
        m.serviceErrorRate < Q.errorThreshold && m.admitted > 0 && m.successful + m.failed > 0;
}
export type StopReason = "first-incident" | "review" | "ended" | null;
export function step(prev: GameState): {
    state: GameState;
    stopReason: StopReason;
} {
    if (!prev.campaign)
        throw new Error("Physical step requires an opening-db campaign");
    if (prev.phase === "review" || prev.phase === "ended")
        return { state: prev, stopReason: prev.phase };
    const s = clone(prev);
    const stopReason = stepInPlace(s);
    return { state: projectCampaign(s), stopReason };
}
/**
 * Advance one physical step by mutating `s`. The caller owns `s`, rules out
 * review and ended phases, and projects the legacy view fields afterwards.
 */
export function stepInPlace(s: GameState): StopReason {
    const c = s.campaign!;
    c.step++;
    for (const action of c.pending.filter(a => a.activationStep === c.step)) {
        const dbBefore = c.dbCapacity, appBefore = c.apps.length * Q.appCapacity;
        const admittedBefore = Math.min(c.incomingRate, c.limit ?? c.incomingRate);
        if (action.type === "add-app")
            c.apps.push({ id: "app-2", capacity: Q.appCapacity, backlog: 0, routed: false });
        if (action.type === "upgrade-db") {
            c.dbCapacity = Q.upgradedDbCapacity;
            c.upgraded = true;
        }
        if (action.type === "limit")
            c.limit = Q.admissionLimit;
        if (action.type === "unlimit")
            c.limit = null;
        c.actions.find(a => a.id === action.id)!.activatedStep = c.step;
        trace(c, "action-activated", {
            actionId: action.id, dbBefore, dbAfter: c.dbCapacity, appBefore,
            appAfter: c.apps.length * Q.appCapacity, admittedBefore, admittedAfter: Math.min(c.incomingRate, c.limit ?? c.incomingRate)
        });
    }
    c.pending = c.pending.filter(a => a.activationStep > c.step);
    if (c.step === Q.growthStep && !c.consumedEvents.includes("opening-growth")) {
        c.incomingRate = Q.grownTraffic;
        c.consumedEvents.push("opening-growth");
        trace(c, "traffic-change", { eventId: "opening-growth", from: Q.startingTraffic, to: c.incomingRate });
    }
    const incoming = c.incomingRate, admitted = Math.min(incoming, c.limit ?? incoming), rejected = incoming - admitted;
    const primary = c.apps[0];
    const app = processWork(primary.backlog, admitted, primary.capacity, Q.appBacklogLimit);
    primary.backlog = app.backlog;
    const db = processWork(c.dbBacklog, app.processed, c.dbCapacity, Q.dbBacklogLimit);
    c.dbBacklog = db.backlog;
    const successful = db.processed, failed = app.failed + db.failed;
    c.snapshot = {
        step: c.step, incoming, admitted, rejected, app, db,
        installedAppCapacity: c.apps.reduce((n, a) => n + a.capacity, 0), successful, failed,
        latencyMs: Q.baseLatencyMs + 1000 * (app.backlog / primary.capacity + db.backlog / c.dbCapacity),
        serviceErrorRate: successful + failed > 0 ? failed / (successful + failed) : null
    };
    c.cumulative.admitted += admitted;
    c.cumulative.rejected += rejected;
    c.cumulative.successful += successful;
    c.cumulative.failed += failed;
    c.recent.push(c.snapshot);
    c.recent = c.recent.slice(-600);
    if (c.incident)
        c.incident.snapshots.push(c.snapshot);
    accruePeriod(c);
    settlePeriod(c);
    let stopReason: StopReason = null;
    if (c.cashCents <= 0) {
        s.phase = "ended";
        s.outcome = "bankrupt";
        stopReason = "ended";
        trace(c, "bankruptcy", { cashCents: c.cashCents });
    }
    else if (c.incident) {
        const prior = c.incident.stableSteps;
        c.incident.stableSteps = qualifiesForRecovery(c.snapshot) ? prior + 1 : 0;
        if (prior !== c.incident.stableSteps)
            trace(c, "recovery-streak", { from: prior, to: c.incident.stableSteps });
        if (c.incident.stableSteps >= Q.stableSteps) {
            trace(c, "incident-recovered", { incidentId: c.incident.id });
            c.reports.push(causalPostmortem(c));
            c.incident = null;
            c.openingRecovered = true;
            c.overloadSteps = 0;
            s.phase = "review";
            stopReason = "review";
        }
    }
    else {
        c.overloadSteps = db.demand > db.capacity ? c.overloadSteps + 1 : 0;
        if (c.overloadSteps >= Q.overloadSteps) {
            c.incident = { id: `incident-${c.nextEventId}`, openedStep: c.step, stableSteps: 0, snapshots: c.recent.slice(-3) };
            s.phase = "incident";
            trace(c, "incident-opened", { incidentId: c.incident.id, component: "db" });
            if (!c.firstPauseConsumed) {
                c.firstPauseConsumed = true;
                stopReason = "first-incident";
            }
        }
    }
    trace(c, "metrics", { snapshotStep: c.step });
    return stopReason;
}
export function advanceSteps(prev: GameState, count: number): {
    state: GameState;
    stepsConsumed: number;
    stopReason: StopReason;
} {
    if (!Number.isSafeInteger(count) || count < 0)
        throw new Error("Step count must be a nonnegative integer");
    if (count === 0)
        return { state: prev, stepsConsumed: 0, stopReason: null };
    if (!prev.campaign)
        throw new Error("Physical step requires an opening-db campaign");
    if (prev.phase === "review" || prev.phase === "ended")
        return { state: prev, stepsConsumed: 0, stopReason: prev.phase };
    // Copy once and step the copy, so a long advance costs no more than its steps.
    const s = clone(prev);
    let stepsConsumed = 0, stopReason: StopReason = null;
    while (stepsConsumed < count && !stopReason) {
        if (s.phase === "review" || s.phase === "ended")
            stopReason = s.phase;
        else {
            stopReason = stepInPlace(s);
            stepsConsumed++;
        }
    }
    return { state: projectCampaign(s), stepsConsumed, stopReason };
}
/**
 * Apply one player decision and record it as a replayable input. A rejected
 * decision is recorded too, because its rejection is part of the run's history.
 */
export function applyCampaignInput(prev: GameState, action: Action): { state: GameState; result: ActionResult } {
    const s = clone(prev);
    const failure = applyCampaignInputInPlace(s, action);
    return { state: s, result: failure ?? { ok: true, state: s } };
}
/** `applyCampaignInput` mutating `s`. Returns the rejection, or null when the decision was accepted. */
export function applyCampaignInputInPlace(s: GameState, action: Action): Rejection | null {
    const failure = actInPlace(s, action), c = s.campaign!;
    if (failure)
        trace(c, "action-rejected", { action: action.type, reason: failure.message });
    c.inputs.push({ step: c.step, action: clone(action) });
    return failure;
}
type Rejection = Extract<ActionResult, { ok: false }>;
/** Every check runs before the first mutation, so a rejection leaves `s` untouched. */
function actInPlace(s: GameState, action: Action): Rejection | null {
    const fail = (message: string): Rejection => ({ ok: false, reason: "invalid", message });
    if (action.type === "acknowledge_review" && s.phase === "review") {
        s.phase = "management";
        trace(s.campaign!, "review-acknowledged");
        return null;
    }
    if (s.phase === "review" || s.phase === "ended")
        return fail("Finish review or start a new company before acting.");
    if (action.type === "incident_inspect") {
        if (!["app", "db", "monitoring", "gateway"].includes(action.equipment))
            return fail("That component is not active in this opening.");
        trace(s.campaign!, "inspection", { component: action.equipment, snapshotStep: s.campaign!.step, snapshot: JSON.stringify(s.campaign!.snapshot) });
        return null;
    }
    const type: Intervention | null = action.type === "add_server" ? "add-app" : action.type === "start_db_upgrade" ? "upgrade-db" :
        action.type === "set_traffic_limit" ? (action.enabled ? "limit" : "unlimit") : null;
    if (!type)
        return fail("This action is unavailable during the opening.");
    const c = s.campaign!, infrastructure = type === "add-app" || type === "upgrade-db";
    if (infrastructure && c.pending.some(a => a.type === "add-app" || a.type === "upgrade-db"))
        return fail("An infrastructure deployment is already pending.");
    if (type === "add-app" && c.apps.length >= Q.maxApps)
        return fail("Two application instances are already installed.");
    if (type === "upgrade-db" && c.upgraded)
        return fail("The database is already upgraded.");
    if (!infrastructure && (c.pending.some(a => a.type === "limit" || a.type === "unlimit") || ((c.limit !== null) === (type === "limit"))))
        return fail("Admission setting is already active or a change is pending.");
    const costCents = type === "add-app" ? Q.appCostCents : type === "upgrade-db" ? Q.dbCostCents : 0;
    if (c.cashCents - costCents <= 0)
        return fail("This purchase would exhaust company cash.");
    const delay = type === "add-app" ? Q.appDelay : type === "upgrade-db" ? Q.dbDelay : Q.admissionDelay;
    const scheduled = { id: `action-${c.nextEventId}`, type, requestedStep: c.step, activationStep: c.step + delay, costCents, activatedStep: null };
    c.cashCents -= costCents;
    c.investedCents += costCents;
    c.pending.push(scheduled);
    c.actions.push({ ...scheduled });
    trace(c, "action-requested", { actionId: scheduled.id, type, costCents, activationStep: scheduled.activationStep });
    projectCampaign(s);
    return null;
}
