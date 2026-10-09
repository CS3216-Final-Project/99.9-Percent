import type { GameState, Action, ActionResult } from "./types";
import type { Campaign, Snapshot, ComponentSnapshot, Intervention, Routing, ScheduledAction } from "./campaignTypes";
import { clone } from "./state";
import { OPENING_DB as Q } from "./scenarios/openingDatabaseIncident";
import { APPLICATION_SCALING as P } from "./scenarios/applicationScaling";
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
/** Integer allocation independent of capacity and array ordering. */
export function allocateTraffic(demand: number, targets: string[]): Record<string, number> {
    if (!Number.isSafeInteger(demand) || demand < 0 || !targets.length || new Set(targets).size !== targets.length)
        throw Error("Invalid routing allocation");
    const ordered = [...targets].sort((a, b) => Number(a.split("-")[1]) - Number(b.split("-")[1]));
    return Object.fromEntries(ordered.map((id, i) => [id, Math.floor(demand / ordered.length) + (i < demand % ordered.length ? 1 : 0)]));
}
export function routingValid(c: Campaign, r: Routing): boolean {
    return ["single", "balanced"].includes(r.mode) && Array.isArray(r.targets) && r.targets.length > 0 &&
        new Set(r.targets).size === r.targets.length && r.targets.every(id => c.apps.some(a => a.id === id && a.state === "active")) &&
        (r.mode === "single" ? r.targets.length === 1 && r.targets[0] === "app-1" : c.loadBalancer);
}
export function enterScaling(s: GameState): GameState {
    if (!s.campaign?.openingMilestone?.acknowledged || s.campaign.scaling || s.phase==="ended") return s;
    const next = clone(s), c = next.campaign!;
    c.scaling = { id: P.id, version: P.version, enteredStep: c.step, dueStep: null, consumed: false };
    trace(c, "scaling-stage-entered", { continuationId: P.id, continuationVersion: P.version, configuration:JSON.stringify(P) });
    return next;
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
        apps: [{ id: "app-1", capacity: Q.appCapacity, backlog: 0, routed: true, tier: "base", state: "active" }],
        routing: { mode: "single", targets: ["app-1"] }, loadBalancer: false, routingEnabledOnce: false,
        scaling: null, overload: { "app-1": 0, db: 0 },
        dbCapacity: Q.dbCapacity, dbBacklog: 0, upgraded: false, cashCents: Q.startingCashCents,
        ledger: emptyLedger(), remainders: { app: 0, db: 0, salary: 0, lb: 0 }, settlements: [], lastSettledPeriod: 0,
        revenueCents: 0, costsCents: 0, investedCents: 0,
        cumulative: { admitted: 0, rejected: 0, successful: 0, failed: 0 },
        pending: [], actions: [], consumedEvents: [], overloadSteps: 0, incident: null, reports: [],
        openingMilestone: null, openingRecovered: false, firstPauseConsumed: false, snapshot, recent: [], trace: [], nextEventId: 1,
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
    s.infra.dbTier = c.dbCapacity >= P.dbCapacity ? 2 : c.upgraded ? 1 : 0;
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
    const s = clone(prev), c = s.campaign!;
    c.step++;
    for (const action of c.pending.filter(a => a.activationStep === c.step)) {
        const dbBefore = c.dbCapacity, appBefore = c.apps.reduce((n,a)=>n+a.capacity,0);
        const targetCapacityBefore = action.targetId ? c.apps.find(a=>a.id===action.targetId)?.capacity ?? 0 : null;
        const routingBefore = JSON.stringify(c.routing);
        const effectiveBefore = c.apps.filter(a=>c.routing.targets.includes(a.id)).reduce((n,a)=>n+a.capacity,0);
        const admittedBefore = Math.min(c.incomingRate, c.limit ?? c.incomingRate);
        if (action.type === "add-app")
            c.apps.push({ id: action.targetId ?? "app-2", capacity: Q.appCapacity, backlog: 0, routed: false, tier: "base", state: "active" });
        if (action.type === "upgrade-db") {
            c.dbCapacity = action.capacityAfter ?? Q.upgradedDbCapacity;
            c.upgraded = true;
        }
        if (action.type === "scale-up") {
            const target = c.apps.find(a=>a.id===action.targetId)!;
            target.capacity = P.appCapacity; target.tier = "large";
        }
        if (action.type === "deploy-lb") c.loadBalancer = true;
        if (action.type === "routing") {
            if (!action.routing || !routingValid(c, action.routing)) throw Error("Scheduled routing targets became invalid");
            c.routing = clone(action.routing);
            c.routing.targets.sort((a,b)=>Number(a.split("-")[1])-Number(b.split("-")[1]));
            c.apps.forEach(a=>a.routed=c.routing.targets.includes(a.id));
        }
        if (action.type === "limit")
            c.limit = Q.admissionLimit;
        if (action.type === "unlimit")
            c.limit = null;
        c.actions.find(a => a.id === action.id)!.activatedStep = c.step;
        trace(c, "action-activated", {
            actionId: action.id, costCents:action.costCents, dbBefore, dbAfter: c.dbCapacity, appBefore,
            appAfter: c.apps.reduce((n,a)=>n+a.capacity,0), admittedBefore, admittedAfter: Math.min(c.incomingRate, c.limit ?? c.incomingRate),
            targetId: action.targetId ?? null, capacityBefore:targetCapacityBefore, capacityAfter:action.targetId?c.apps.find(a=>a.id===action.targetId)?.capacity??null:action.capacityAfter??null, routingBefore, routingAfter: JSON.stringify(c.routing),
            effectiveBefore, effectiveAfter: c.apps.filter(a=>c.routing.targets.includes(a.id)).reduce((n,a)=>n+a.capacity,0),
            routingFirstEnabled: action.type === "routing" && c.routing.mode === "balanced" && !c.routingEnabledOnce
        });
        if (action.type === "routing" && c.routing.mode === "balanced") c.routingEnabledOnce = true;
    }
    if (c.scaling && !c.scaling.consumed) {
        const ready = c.openingMilestone?.acknowledged && c.dbCapacity >= P.dbCapacity && s.phase === "management" &&
            !c.incident && c.dbBacklog === 0 && c.apps.every(a=>a.backlog===0);
        if (ready && c.scaling.dueStep === null) {
            c.scaling.dueStep = c.step + P.observationSteps;
            trace(c,"traffic-scheduled",{eventId:"scaling-growth",dueStep:c.scaling.dueStep,continuationVersion:P.version});
        }
        if (ready && c.scaling.dueStep !== null && c.step >= c.scaling.dueStep) {
            const from = c.incomingRate; c.incomingRate = P.traffic; c.scaling.consumed = true;
            c.consumedEvents.push("scaling-growth");
            trace(c,"traffic-change",{eventId:"scaling-growth",from,to:P.traffic,scheduledStep:c.scaling.dueStep,actualStep:c.step,continuationVersion:P.version});
        }
    }
    c.pending = c.pending.filter(a => a.activationStep > c.step);
    if (c.step === Q.growthStep && !c.consumedEvents.includes("opening-growth")) {
        c.incomingRate = Q.grownTraffic;
        c.consumedEvents.push("opening-growth");
        trace(c, "traffic-change", { eventId: "opening-growth", from: Q.startingTraffic, to: c.incomingRate });
    }
    const incoming = c.incomingRate, admitted = Math.min(incoming, c.limit ?? incoming), rejected = incoming - admitted;
    const allocation = allocateTraffic(admitted, c.routing.targets);
    let appBusyBudget = 0;
    const instances = c.apps.map(a => {
        const demand = allocation[a.id] ?? 0;
        if (a.routed || a.backlog > 0) appBusyBudget += a.capacity;
        const result = processWork(a.backlog, demand, a.capacity, Q.appBacklogLimit);
        a.backlog = result.backlog;
        return { ...result, id:a.id, tier:a.tier, state:a.state, routed:a.routed, demandRate:demand, demandCount:demand, processingBudget:a.capacity };
    });
    const effectiveAppCapacity = c.apps.filter(a=>a.routed).reduce((n,a)=>n+a.capacity,0);
    const sum = (key: "processed" | "backlog" | "failed") => instances.reduce((n,a)=>n+a[key],0);
    const app: ComponentSnapshot = { demand:admitted,capacity:effectiveAppCapacity,processed:sum("processed"),backlog:sum("backlog"),failed:sum("failed"),
        busyUtilisation:sum("processed")/appBusyBudget,demandRatio:admitted/effectiveAppCapacity };
    const db = processWork(c.dbBacklog, app.processed, c.dbCapacity, Q.dbBacklogLimit);
    c.dbBacklog = db.backlog;
    const successful = db.processed, failed = app.failed + db.failed;
    c.snapshot = {
        version: 3, instances, effectiveAppCapacity, appBusyBudget, routing: clone(c.routing), step: c.step, incoming, admitted, rejected, app, db,
        installedAppCapacity: c.apps.reduce((n, a) => n + a.capacity, 0), successful, failed,
        latencyMs: Q.baseLatencyMs + 1000 * (Math.max(...instances.map(a=>a.backlog/a.capacity)) + db.backlog / c.dbCapacity),
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
    for (const a of instances) c.overload[a.id] = a.demand > a.capacity ? (c.overload[a.id] ?? 0) + 1 : 0;
    c.overload.db = db.demand > db.capacity ? (c.overload.db ?? 0) + 1 : 0;
    c.overloadSteps = c.overload.db;
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
            Object.keys(c.overload).forEach(id=>c.overload[id]=0);
            s.phase = "review";
            stopReason = "review";
        }
    }
    else {
        const components = [...instances].sort((a,b)=>Number(a.id.split("-")[1])-Number(b.id.split("-")[1])).map(a=>a.id).concat("db").filter(id=>c.overload[id]>=Q.overloadSteps);
        if (components.length) {
            c.incident = { id: `incident-${c.nextEventId}`, openedStep: c.step, stableSteps: 0, snapshots: c.recent.slice(-3), components, primaryComponent:components[0] };
            s.phase = "incident";
            trace(c, "incident-opened", { incidentId: c.incident.id, component: components[0], components: JSON.stringify(components) });
            if (!c.firstPauseConsumed) {
                c.firstPauseConsumed = true;
                stopReason = "first-incident";
            }
        }
    }
    trace(c, "metrics", { snapshotStep: c.step });
    return { state: projectCampaign(s), stopReason };
}
export function advanceSteps(prev: GameState, count: number): {
    state: GameState;
    stepsConsumed: number;
    stopReason: StopReason;
} {
    if (!Number.isSafeInteger(count) || count < 0)
        throw new Error("Step count must be a nonnegative integer");
    let state = prev, stepsConsumed = 0, stopReason: StopReason = null;
    while (stepsConsumed < count) {
        if (state.phase === "review" || state.phase === "ended") {
            stopReason = state.phase;
            break;
        }
        const result = step(state);
        state = result.state;
        stopReason = result.stopReason;
        stepsConsumed++;
        if (stopReason)
            break;
    }
    return { state, stepsConsumed, stopReason };
}
export function campaignAction(prev: GameState, action: Action): ActionResult {
    const fail = (message: string): ActionResult => ({ ok: false, reason: "invalid", message });
    if (action.type === "acknowledge_review" && prev.phase === "review") {
        const s = clone(prev);
        s.phase = "management";
        const c=s.campaign!, report=c.reports.at(-1)!;
        trace(c, "review-acknowledged", {incidentId:report.id});
        if(!c.openingMilestone && report.id===c.reports[0].id) {
            c.openingMilestone={id:"opening-stability",incidentId:report.id,awardedStep:c.step,acknowledged:false};
            trace(c,"milestone-awarded",{incidentId:report.id});
        }
        return { ok: true, state: s };
    }
    if(action.type==="acknowledge_milestone") {
        if(!prev.campaign?.openingMilestone || prev.campaign.openingMilestone.acknowledged)return fail("No milestone awaits acknowledgement.");
        const s=clone(prev);s.campaign!.openingMilestone!.acknowledged=true;
        trace(s.campaign!,"milestone-acknowledged");return {ok:true,state:enterScaling(s)};
    }
    if (action.type === "enter_scaling") {
        if (!prev.campaign?.openingMilestone?.acknowledged || prev.campaign.scaling) return fail("Scaling stage is locked or already entered.");
        return {ok:true,state:enterScaling(prev)};
    }
    if (prev.phase === "review" || prev.phase === "ended")
        return fail("Finish review or start a new company before acting.");
    if (action.type === "incident_inspect") {
        if (!["app", "db", "monitoring", "gateway"].includes(action.equipment))
            return fail("That component is not active in this opening.");
        const s = clone(prev);
        if(action.appId && !s.campaign!.apps.some(a=>a.id===action.appId))return fail("Unknown application instance.");
        trace(s.campaign!, "inspection", { component: action.equipment, appId:action.appId??null, snapshotStep: s.campaign!.step, snapshot: JSON.stringify(s.campaign!.snapshot) });
        return { ok: true, state: s };
    }
    const type: Intervention | null = action.type === "add_server" ? "add-app" : action.type === "start_db_upgrade" ? "upgrade-db" :
        action.type === "set_traffic_limit" ? (action.enabled ? "limit" : "unlimit") :
        action.type === "scale_up" ? "scale-up" : action.type === "deploy_load_balancer" ? "deploy-lb" : action.type === "set_routing" ? "routing" : null;
    if (!type)
        return fail("This action is unavailable during the opening.");
    const c = prev.campaign!, unlocked = !!c.openingMilestone?.acknowledged;
    if (["scale-up","deploy-lb","routing"].includes(type) && !unlocked)return fail("Acknowledge the opening milestone first.");
    const infrastructure = !["limit","unlimit","routing"].includes(type);
    if (infrastructure && c.pending.some(a => !["limit","unlimit","routing"].includes(a.type)))
        return fail("An infrastructure deployment is already pending.");
    if (type === "add-app" && c.apps.length >= Q.maxApps)
        return fail("Two application instances are already installed.");
    if (type === "upgrade-db" && (c.dbCapacity >= P.dbCapacity || (c.upgraded && !unlocked)))
        return fail("The database is already upgraded.");
    const target = action.type === "scale_up" ? c.apps.find(a=>a.id===action.appId) : null;
    if (type === "scale-up" && (!target || target.state !== "active" || target.tier !== "base"))return fail("Select an active base application to scale up.");
    if (type === "deploy-lb" && c.loadBalancer)return fail("Load balancing is already deployed.");
    const routing = action.type === "set_routing" ? {mode:action.mode,targets:[...action.targets].sort((a,b)=>Number(a.split("-")[1])-Number(b.split("-")[1]))} : null;
    if (routing && (!c.loadBalancer || !routingValid(c,routing) || c.pending.some(a=>a.type==="routing") || JSON.stringify(routing)===JSON.stringify(c.routing)))return fail("Routing requires deployed load balancing, valid active targets and a changed configuration.");
    if (["limit","unlimit"].includes(type) && (c.pending.some(a => a.type === "limit" || a.type === "unlimit") || ((c.limit !== null) === (type === "limit"))))
        return fail("Admission setting is already active or a change is pending.");
    const costCents = type === "add-app" ? Q.appCostCents : type === "upgrade-db" ? Q.dbCostCents : type === "scale-up" ? P.appCostCents : type === "deploy-lb" ? P.lbCostCents : 0;
    if (c.cashCents - costCents <= 0)
        return fail("This purchase would exhaust company cash.");
    const s = clone(prev), n = s.campaign!;
    const delay = type === "add-app" ? Q.appDelay : type === "upgrade-db" ? Q.dbDelay : type === "scale-up" ? P.appDelay : type === "deploy-lb" ? P.lbDelay : Q.admissionDelay;
    const scheduled: ScheduledAction = { id: `action-${n.nextEventId}`, type, requestedStep: n.step, activationStep: n.step + delay, costCents, activatedStep: null,
        ...(type === "add-app" ? {targetId:"app-2"} : {}), ...(target ? {targetId:target.id,capacityAfter:P.appCapacity} : {}),
        ...(type === "upgrade-db" ? {capacityAfter:c.dbCapacity===Q.dbCapacity?Q.upgradedDbCapacity:P.dbCapacity} : {}), ...(routing ? {routing} : {}) };
    n.cashCents -= costCents;
    n.investedCents += costCents;
    n.pending.push(scheduled);
    n.actions.push({ ...scheduled });
    trace(n, "action-requested", { actionId: scheduled.id, type, costCents, activationStep: scheduled.activationStep, targetId:scheduled.targetId??null,
        routingBefore:JSON.stringify(c.routing), capacityBefore:target?.capacity??(type==="upgrade-db"?c.dbCapacity:null),capacityAfter:scheduled.capacityAfter??null,routing:routing?JSON.stringify(routing):null });
    return { ok: true, state: projectCampaign(s) };
}
