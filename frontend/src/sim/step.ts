import { activateReliability, advanceHealth, detect, effectiveTargets, initializeHealth, observeReliability, pendingReliability, recoverySafe, reliabilityAction } from "./reliability";
import { pendingPreventionReview, observePrevention, recordPreventionInspection } from "./openingPrevention";
import type { GameState, Action, ActionResult } from "./types";
import type { Campaign, Snapshot, ComponentSnapshot, Intervention, Routing, ScheduledAction, TraceEvent } from "./campaignTypes";
import { pendingSpikeAcknowledgement, spikeAction, advanceSpikeTraffic, runAutoscaler, activateRetirement } from "./autoscaling";
import { TRAFFIC_SPIKES as T } from "./scenarios/trafficSpikes";
import { clone } from "./state";
import { OPENING_DB as Q } from "./scenarios/openingDatabaseIncident";
import { DATA_STRATEGY as D, DATA_PROFILES, type DataProfile } from "./scenarios/dataStrategy";
import { rand } from "./rng";
import type { DataSnapshot } from "./campaignTypes";
import { APPLICATION_SCALING as P } from "./scenarios/applicationScaling";
import { emptyLedger, accruePeriod, settlePeriod } from "./settlement";
import { trace, causalPostmortem, retainFoundationTrace } from "./trace";
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
        new Set(r.targets).size === r.targets.length && r.targets.every(id => c.apps.some(a => a.id === id && a.state === "active" && a.role!=="spare")) &&
        (r.mode === "single" ? r.targets.length === 1 && r.targets[0] === "app-1" : c.loadBalancer);
}
export function enterScaling(s: GameState): GameState {
    if (!s.campaign?.openingMilestone?.acknowledged || s.campaign.scaling || s.phase==="ended") return s;
    const next = clone(s);
    enterScalingInPlace(next);
    return next;
}
function enterScalingInPlace(s: GameState): void {
    const c = s.campaign!;
    c.scaling = { id: P.id, version: P.version, enteredStep: c.step, dueStep: null, consumed: false };
    trace(c, "scaling-stage-entered", { continuationId: P.id, continuationVersion: P.version, configuration:JSON.stringify(P) });
}
export function canEnterData(s: GameState): boolean {
 const c=s.campaign;
 return !!c?.scaling?.consumed && s.phase==="management" && !c.incident && c.dbBacklog===0 && c.apps.every(a=>a.backlog===0) &&
 c.reports.every(r=>c.trace.some(t=>t.type==="review-acknowledged"&&t.data.incidentId===r.id));
}
/** The sequential, currently unlocked database purchase; shared with presentation. */
export function databaseUpgrade(c: Campaign): {capacity:number;costCents:number;delay:number} | null {
    if (c.dbCapacity === Q.dbCapacity) return {capacity:Q.upgradedDbCapacity,costCents:Q.dbCostCents,delay:Q.dbDelay};
    if (!c.openingMilestone?.acknowledged) return null;
    if (c.dbCapacity === Q.upgradedDbCapacity) return {capacity:P.dbCapacity,costCents:Q.dbCostCents,delay:Q.dbDelay};
    if (c.dbCapacity === P.dbCapacity && c.dataStage) return {capacity:D.dbCapacity,costCents:D.dbCostCents,delay:D.dbDelay};
    return null;
}
/** Integer classification occurs after aggregate application processing. */
export function classifyData(P: number, readShare: number, cacheableReadShare: number, rate: number) {
 const reads=Math.floor(P*readShare/10000),writes=P-reads,eligibleReads=Math.floor(reads*cacheableReadShare/10000);
 const nonCacheableReads=reads-eligibleReads,hits=Math.floor(eligibleReads*rate/10000),eligibleMisses=eligibleReads-hits;
 return {logical:P,reads,writes,eligibleReads,nonCacheableReads,hits,eligibleMisses,
 databaseReadDemand:nonCacheableReads+eligibleMisses,databaseWriteDemand:writes,databaseNewDemand:P-hits};
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
        scaling: null, dataStage: null, readCache: null, spikeStage:null, nextAppNumber:2, overload: { "app-1": 0, db: 0 },
        dbCapacity: Q.dbCapacity, dbBacklog: 0, upgraded: false, cashCents: Q.startingCashCents,
        ledger: emptyLedger(), remainders: { app: 0, db: 0, salary: 0, lb: 0, cache: 0, controller:0 }, settlements: [], lastSettledPeriod: 0,
        revenueCents: 0, costsCents: 0, investedCents: 0,
        cumulative: { admitted: 0, rejected: 0, successful: 0, failed: 0 },
        pending: [], actions: [], inputs: [], consumedEvents: [], overloadSteps: 0, incident: null, reports: [],
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
    s.infra.nextHostNum = c.nextAppNumber;
    s.infra.dbTier = c.dbCapacity >= D.dbCapacity ? 3 : c.dbCapacity >= P.dbCapacity ? 2 : c.upgraded ? 1 : 0;
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
export type StopReason = "first-incident" | "review" | "ended" | "spike-acknowledgement" | "prevention-review" | "reliability-review" | null;
export function step(prev: GameState): {
    state: GameState;
    stopReason: StopReason;
} {
    if (!prev.campaign)
        throw new Error("Physical step requires an opening-db campaign");
    if (prev.phase === "review" || prev.phase === "ended")
        return { state: prev, stopReason: prev.phase };
    const pending = pendingStop(prev.campaign);
    if (pending)
        return { state: prev, stopReason: pending };
    const s = clone(prev);
    const stopReason = stepInPlace(s);
    return { state: projectCampaign(s), stopReason };
}
/** A recognition the player must acknowledge before time can advance again. */
export function pendingStop(c: Campaign | undefined): "reliability-review" | "prevention-review" | "spike-acknowledgement" | null {
    return pendingReliability(c) ? "reliability-review" : pendingPreventionReview(c) ? "prevention-review" : pendingSpikeAcknowledgement(c) ? "spike-acknowledgement" : null;
}
/**
 * Advance one physical step by mutating `s`. The caller owns `s`, rules out
 * review and ended phases, and projects the legacy view fields afterwards.
 */
export function stepInPlace(s: GameState): StopReason {
    const c = s.campaign!;
    const pending = pendingStop(c);
    if (pending) return pending;
    const traceStart = c.trace.length;
    const priorBacklogs = new Map(c.apps.map(a => [a.id, a.backlog]));
    const priorDbBacklog = c.dbBacklog;
    const activatedEffects: TraceEvent[] = [];
    c.step++;
    for (const action of c.pending.filter(a => a.activationStep === c.step)) {
        const dbBefore = c.dbCapacity, appBefore = c.apps.reduce((n,a)=>n+a.capacity,0);
        const targetCapacityBefore = action.targetId ? c.apps.find(a=>a.id===action.targetId)?.capacity ?? 0 : null;
        const routingBefore = JSON.stringify(c.routing);
        const effectiveBefore = c.apps.filter(a=>c.routing.targets.includes(a.id)).reduce((n,a)=>n+a.capacity,0);
        const admittedBefore = Math.min(c.incomingRate, c.limit ?? c.incomingRate);
        if(["health-checks","create-spare","reserve-spare","release-spare","failover","promote-spare","restore-app"].includes(action.type)&&!activateReliability(c,action))continue;
        if(action.type==="retire-app"&&!activateRetirement(c,action))continue;
        if(action.type==="deploy-autoscaler") {
          c.spikeStage!.controller={activatedStep:c.step,enabled:true,highSteps:0,lowSteps:0,cooldownUntil:c.step,managedAppIds:[],joiningAppId:null,expectedRouting:JSON.stringify(c.routing),blockedReason:null};
          trace(c,"autoscaling-enabled",{activationStep:c.step});
        }
        if(action.type=== "add-app"&&action.source==="autoscaler")c.spikeStage!.controller!.managedAppIds.push(action.targetId!);
        if (action.type === "add-app")
            c.apps.push({ id: action.targetId ?? "app-2", capacity: Q.appCapacity, backlog: 0, routed: false, tier: "base", state: "active" });
        if(c.reliabilityStage&&action.type==="add-app")initializeHealth(c.apps.at(-1)!,c.step);
        if (action.type === "upgrade-db") {
            c.dbCapacity = action.capacityAfter ?? Q.upgradedDbCapacity;
            c.upgraded = true;
        }
        if (action.type === "scale-up") {
            const target = c.apps.find(a=>a.id===action.targetId)!;
            target.capacity = P.appCapacity; target.tier = "large";
        }
        if (action.type === "deploy-lb") c.loadBalancer = true;
        if (action.type === "cache") c.readCache={activatedStep:c.step,warmth:0,target:D.baseTarget,tuned:false};
        if (action.type === "cache-tuning") { c.readCache!.target=D.tunedTarget;c.readCache!.tuned=true; }
        if (action.type === "routing") {
            if (!action.routing || !routingValid(c, action.routing)) throw Error("Scheduled routing targets became invalid");
            c.routing = clone(action.routing);
            c.routing.targets.sort((a,b)=>Number(a.split("-")[1])-Number(b.split("-")[1]));
            c.apps.forEach(a=>a.routed=c.routing.targets.includes(a.id));
        }
        if(action.type==="routing"&&action.source==="autoscaler") {
          const a=c.spikeStage!.controller!;a.joiningAppId=null;a.cooldownUntil=c.step+T.cooldown;a.expectedRouting=JSON.stringify(c.routing);
        }
        if (action.type === "limit")
            c.limit = Q.admissionLimit;
        if (action.type === "unlimit")
            c.limit = null;
        c.actions.find(a => a.id === action.id)!.activatedStep = c.step;
        trace(c, "action-activated", {
            actionId: action.id, ...(c.spikeStage?{source:action.source??"player"}:{}), costCents:action.costCents, dbBefore, dbAfter: c.dbCapacity, appBefore,
            appAfter: c.apps.reduce((n,a)=>n+a.capacity,0), admittedBefore, admittedAfter: Math.min(c.incomingRate, c.limit ?? c.incomingRate),
            targetId: action.targetId ?? null, capacityBefore:targetCapacityBefore, capacityAfter:action.targetId?c.apps.find(a=>a.id===action.targetId)?.capacity??null:action.capacityAfter??null, routingBefore, routingAfter: JSON.stringify(c.routing),
            effectiveBefore, effectiveAfter: c.apps.filter(a=>c.routing.targets.includes(a.id)).reduce((n,a)=>n+a.capacity,0),
            ...(c.dataStage?{cacheTarget:c.readCache?.target??0, cacheWarmth:c.readCache?.warmth??0}:{}),
            routingFirstEnabled: action.type === "routing" && c.routing.mode === "balanced" && !c.routingEnabledOnce
        });
        activatedEffects.push(c.trace[c.trace.length - 1]);
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
    if(c.dataStage && !c.dataStage.consumed) {
        const ready=canEnterData(s);
        if(ready && c.dataStage.dueStep===null) {
            c.dataStage.dueStep=c.step+D.observationSteps;
            trace(c,"traffic-scheduled",{eventId:"data-growth",dueStep:c.dataStage.dueStep});
        }
        if(ready && c.dataStage.dueStep!==null && c.step>=c.dataStage.dueStep) {
            const from=c.incomingRate;c.incomingRate=D.traffic;c.dataStage.consumed=true;c.consumedEvents.push("data-growth");
            trace(c,"workload-changed",{eventId:"data-growth",from,to:D.traffic,profile:c.dataStage.profile,
             ...DATA_PROFILES[c.dataStage.profile],scheduledStep:c.dataStage.dueStep,actualStep:c.step});
        }
    }
    c.pending = c.pending.filter(a => a.activationStep > c.step);
    if (c.step === Q.growthStep && !c.consumedEvents.includes("opening-growth")) {
        c.incomingRate = Q.grownTraffic;
        c.consumedEvents.push("opening-growth");
        trace(c, "traffic-change", { eventId: "opening-growth", from: Q.startingTraffic, to: c.incomingRate });
    }
    advanceSpikeTraffic(c);
    advanceHealth(c);
    const incoming = c.incomingRate, admitted = Math.min(incoming, c.limit ?? incoming), rejected = incoming - admitted;
    const recipients=c.reliabilityStage?effectiveTargets(c):c.routing.targets;
    const allocation = recipients.length?allocateTraffic(admitted, recipients):{};
    const unroutable=recipients.length?0:admitted;
    let appBusyBudget = 0;
    const instances = c.apps.map(a => {
        const demand = allocation[a.id] ?? 0;
        const available=a.health!=="failed";
        if (available&&(recipients.includes(a.id) || a.backlog > 0)) appBusyBudget += a.capacity;
        const result = available?processWork(a.backlog, demand, a.capacity, Q.appBacklogLimit):{demand,capacity:a.capacity,processed:0,backlog:a.backlog,failed:demand,busyUtilisation:0,demandRatio:demand/a.capacity};
        a.backlog = result.backlog;
        return { ...result, id:a.id, tier:a.tier, state:a.state, routed:recipients.includes(a.id), demandRate:demand, demandCount:demand, processingBudget:available?a.capacity:0, ...(c.reliabilityStage?{health:a.health??"healthy",detectedHealth:a.detectedHealth??"unknown",role:a.role??"serving",configured:a.routed}:{}) };
    });
    const effectiveAppCapacity = c.apps.filter(a=>recipients.includes(a.id)&&a.health!=="failed").reduce((n,a)=>n+a.capacity,0);
    const sum = (key: "processed" | "backlog" | "failed") => instances.reduce((n,a)=>n+a[key],0);
    const app: ComponentSnapshot = { demand:admitted,capacity:effectiveAppCapacity,processed:sum("processed"),backlog:sum("backlog"),failed:sum("failed")+unroutable,
        busyUtilisation:appBusyBudget?sum("processed")/appBusyBudget:0,demandRatio:effectiveAppCapacity?admitted/effectiveAppCapacity:0 };
    let data: DataSnapshot | undefined;
    if(c.dataStage?.consumed) {
        const profile=c.dataStage.profile,shares=DATA_PROFILES[profile],warmth=c.readCache?.warmth??0;
        const target=c.readCache?.target??0,rate=Math.min(warmth,target);
        const work=classifyData(app.processed,shares.readShare,shares.cacheableReadShare,rate);
        if(c.readCache && work.eligibleReads>0)c.readCache.warmth=Math.min(target,warmth+D.warmIncrement);
        data={...work,...shares,profile,effectiveHitRateUsed:rate,warmthUsed:warmth,
         warmthAfterStep:c.readCache?.warmth??0,target,deployed:!!c.readCache};
    }
    const db = processWork(c.dbBacklog, data?.databaseNewDemand??app.processed, c.dbCapacity, Q.dbBacklogLimit);
    c.dbBacklog = db.backlog;
    const successful = db.processed+(data?.hits??0), failed = app.failed + db.failed;
    c.snapshot = {
        version: c.reliabilityStage?6:c.spikeStage?5:data?4:3, ...(c.reliabilityStage?{reliability:{configured:[...c.routing.targets],effective:recipients,healthyCapacity:c.apps.filter(a=>a.health!=="failed").reduce((n,a)=>n+a.capacity,0),healthyRoutedCapacity:effectiveAppCapacity,spareCapacity:c.apps.filter(a=>a.role==="spare").reduce((n,a)=>n+a.capacity,0),failedDeliveries:instances.filter(a=>a.health==="failed").reduce((n,a)=>n+a.failed,0)+unroutable,unroutable,faultId:c.reliabilityStage.fault?.id??null}}:{}), ...(data?{data}:{}), instances, effectiveAppCapacity, appBusyBudget, routing: clone(c.routing), step: c.step, incoming, admitted, rejected, app, db,
        installedAppCapacity: c.apps.reduce((n, a) => n + a.capacity, 0), successful, failed,
        latencyMs: Q.baseLatencyMs + 1000 * (Math.max(...instances.map(a=>a.backlog/a.capacity)) + db.backlog / c.dbCapacity),
        serviceErrorRate: successful + failed > 0 ? failed / (successful + failed) : null
    };
    if(c.foundation && c.step<=c.foundation.step) {
        const {version: _version, instances: _instances, effectiveAppCapacity: _effective, appBusyBudget: _budget, routing: _routing, ...historical} = c.snapshot;
        c.snapshot=historical;
    }
    // Compare each scaling/routing activation with the same work and other changes,
    // leaving only that action unapplied. Natural drainage alone earns no causal credit.
    for (const effect of activatedEffects) {
        const action = c.actions.find(a => a.id === effect.data.actionId)!;
        if (action.type !== "scale-up" && action.type !== "routing") continue;
        const targets: string[] = action.type === "routing" ? JSON.parse(String(effect.data.routingBefore)).targets : c.routing.targets;
        const baselineAllocation = allocateTraffic(admitted, targets);
        const baselineApps = c.apps.map(a => processWork(priorBacklogs.get(a.id) ?? 0, baselineAllocation[a.id] ?? 0,
            action.type === "scale-up" && a.id === action.targetId ? Number(effect.data.capacityBefore) : a.capacity, Q.appBacklogLimit));
        const baselineProcessed = baselineApps.reduce((n,a) => n + a.processed, 0);
        const baselineDemand = data ? classifyData(baselineProcessed, data.readShare, data.cacheableReadShare, data.effectiveHitRateUsed).databaseNewDemand : baselineProcessed;
        const baselineDb = processWork(priorDbBacklog, baselineDemand, c.dbCapacity, Q.dbBacklogLimit);
        const baselineAppBacklog = baselineApps.reduce((n,a) => n + a.backlog, 0);
        const baselineLatency = Q.baseLatencyMs + 1000 * (Math.max(...baselineApps.map(a => a.backlog / a.capacity)) + baselineDb.backlog / c.dbCapacity);
        Object.assign(effect.data, {withoutChangeAppBacklog:baselineAppBacklog,withoutChangeDbBacklog:baselineDb.backlog,withoutChangeLatencyMs:baselineLatency,
            measuredRelief:c.snapshot.app.backlog + c.snapshot.db.backlog < baselineAppBacklog + baselineDb.backlog || c.snapshot.latencyMs < baselineLatency});
    }
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
    if(c.reliabilityStage)c.reliabilityStage.failureSteps=c.snapshot.reliability!.failedDeliveries>0?c.reliabilityStage.failureSteps+1:0;
    for (const a of instances) c.overload[a.id] = a.health!=="failed"&&a.demand > a.capacity ? (c.overload[a.id] ?? 0) + 1 : 0;
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
        c.incident.stableSteps = qualifiesForRecovery(c.snapshot)&&recoverySafe(c) ? prior + 1 : 0;
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
        const failure=c.reliabilityStage?.fault;
        const failedIncident=(c.reliabilityStage?.failureSteps??0)>=3&&!!failure;
        if(failedIncident&&!components.includes(failure!.targetId))components.unshift(failure!.targetId);
        if (components.length) {
            c.incident = { id: `incident-${c.nextEventId}`, openedStep: c.step, stableSteps: 0, snapshots: c.recent.slice(-3), components, primaryComponent:components[0],...(failedIncident?{kind:"application-failure" as const,failureId:failure!.id}:{}) };
            s.phase = "incident";
            trace(c, "incident-opened", { incidentId: c.incident.id, component: components[0], components: JSON.stringify(components) });
            if (!c.firstPauseConsumed) {
                c.firstPauseConsumed = true;
                stopReason = "first-incident";
            }
        }
    }
    observePrevention(c);
    if(pendingPreventionReview(c))stopReason="prevention-review";
    runAutoscaler(s);
    observeReliability(s);
    if(pendingReliability(c))stopReason="reliability-review";
    if(pendingSpikeAcknowledgement(c))stopReason="spike-acknowledgement";
    trace(c, "metrics", { snapshotStep: c.step, ...(data?{profile:data.profile,hits:data.hits,eligibleMisses:data.eligibleMisses,effectiveHitRate:data.effectiveHitRateUsed,dbDemand:db.demand,dbCapacity:db.capacity}: {}) });
    if(c.foundation && c.step<=c.foundation.step)retainFoundationTrace(c,traceStart);
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
    const pending = pendingStop(prev.campaign);
    if (pending) return { state: prev, stepsConsumed: 0, stopReason: pending };
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
    const traceStart=s.campaign!.trace.length;
    const failure = actInPlace(s, action), c = s.campaign!;
    if (failure)
        trace(c, "action-rejected", { action: action.type, reason: failure.message });
    if(c.foundation && c.inputs.length<c.foundation.inputs)retainFoundationTrace(c,traceStart);
    c.inputs.push({ step: c.step, action: clone(action) });
    return failure;
}
type Rejection = Extract<ActionResult, { ok: false }>;
/** Every check runs before the first mutation, so a rejection leaves `s` untouched. */
function actInPlace(s: GameState, action: Action): Rejection | null {
    const fail = (message: string): Rejection => ({ ok: false, reason: "invalid", message });
    const c0 = s.campaign!;
    const reliability = reliabilityAction(s, action);
    if (reliability !== undefined) return reliability;
    if (action.type === "acknowledge_prevention_review") {
        if (s.phase !== "management" || !pendingPreventionReview(c0))
            return fail("No prevention outcome awaits acknowledgement.");
        const outcome = c0.openingPrevention!.outcome!;
        outcome.acknowledged = true;
        trace(c0, "opening-prevention-review-acknowledged", {outcomeId:outcome.id});
        if(!c0.openingMilestone) {
            c0.openingMilestone={id:"opening-stability",incidentId:null,outcomeId:outcome.id,awardedStep:c0.step,acknowledged:false};
            trace(c0,"milestone-awarded",{outcomeId:outcome.id,outcome:"prevention"});
        }
        return null;
    }
    if (pendingReliability(c0)) return fail("Review the reliability outcome first.");
    if (pendingPreventionReview(c0)) return fail("Review the Opening prevention outcome first.");
    const spike = spikeAction(s, action);
    if (spike !== undefined) return spike;
    if (pendingSpikeAcknowledgement(c0)) return fail("Acknowledge spike completion first.");
    if (action.type === "acknowledge_review" && s.phase === "review") {
        s.phase = "management";
        const c=s.campaign!, report=c.reports.at(-1)!;
        trace(c, "review-acknowledged", {incidentId:report.id});
        if(!c.openingMilestone && report.id===c.reports[0].id) {
            c.openingMilestone={id:"opening-stability",incidentId:report.id,awardedStep:c.step,acknowledged:false};
            trace(c,"milestone-awarded",{incidentId:report.id});
        }
        return null;
    }
    if (action.type === "acknowledge_milestone") {
        const c = s.campaign!;
        if (!c.openingMilestone || c.openingMilestone.acknowledged) return fail("No milestone awaits acknowledgement.");
        c.openingMilestone.acknowledged = true;
        trace(c, "milestone-acknowledged");
        if (action.enterScaling !== false) enterScalingInPlace(s);
        return null;
    }
    if (action.type === "enter_scaling") {
        if (!s.campaign?.openingMilestone?.acknowledged || s.campaign.scaling || s.phase === "ended") return fail("Scaling stage is locked or already entered.");
        enterScalingInPlace(s);
        return null;
    }
    if(action.type==="enter_data") {
        const c=s.campaign!;
        if(c.dataStage || !canEnterData(s))return fail("Data strategy requires completed scaling growth, acknowledged reports and drained backlogs.");
        if(action.profile!==undefined && !Object.hasOwn(DATA_PROFILES,action.profile))return fail("Unknown workload profile.");
        const profile:DataProfile=action.profile??(rand(s)<.5?"read-heavy":"write-heavy");
        c.dataStage={id:D.id,version:D.version,enteredStep:c.step,dueStep:null,consumed:false,profile,
         source:action.profile?"evaluation":"seeded",configuration:JSON.stringify(D),contrastConsumed:false};
        trace(c,"data-stage-entered",{continuationId:D.id,continuationVersion:D.version,profile,source:c.dataStage.source,configuration:c.dataStage.configuration});
        return null;
    }
    if(action.type==="contrast_workload") {
        const c=s.campaign!,d=c.dataStage;
        if(c.spikeStage || !d?.consumed || d.contrastConsumed || !canEnterData(s))return fail("Finish review and drain backlog before changing workload.");
        const from=d.profile;
        d.profile=from==="read-heavy"?"write-heavy":"read-heavy";d.contrastConsumed=true;c.consumedEvents.push("data-contrast");
        trace(c,"workload-changed",{eventId:"data-contrast",fromProfile:from,profile:d.profile,from:c.incomingRate,to:c.incomingRate,...DATA_PROFILES[d.profile],scheduledStep:c.step,actualStep:c.step});
        return null;
    }
    if (s.phase === "review" || s.phase === "ended")
        return fail("Finish review or start a new company before acting.");
    if (action.type === "incident_inspect") {
        if (!["app", "db", "monitoring", "gateway", ...(s.campaign!.dataStage?["cache"]:[])].includes(action.equipment))
            return fail("That component is not active in this opening.");
        if (action.appId && !s.campaign!.apps.some(a => a.id === action.appId)) return fail("Unknown application instance.");
        trace(s.campaign!, "inspection", { component: action.equipment, appId: action.appId ?? null, snapshotStep: s.campaign!.step, snapshot: JSON.stringify(s.campaign!.snapshot) });
        recordPreventionInspection(s.campaign!,action.equipment);
        if(s.campaign!.reliabilityStage&&action.equipment==="app"&&action.appId)detect(s.campaign!,s.campaign!.apps.find(a=>a.id===action.appId)!,"manual");
        return null;
    }
    const type: Intervention | null = action.type === "add_server" ? "add-app" : action.type === "start_db_upgrade" ? "upgrade-db" :
        action.type === "set_traffic_limit" ? (action.enabled ? "limit" : "unlimit") :
        action.type === "scale_up" ? "scale-up" : action.type === "deploy_load_balancer" ? "deploy-lb" : action.type === "set_routing" ? "routing" : action.type === "deploy_cache" ? "cache" : action.type === "tune_cache" ? "cache-tuning" : null;
    if (!type)
        return fail("This action is unavailable during the opening.");
    const c = s.campaign!, unlocked = !!c.openingMilestone?.acknowledged;
    if (["scale-up","deploy-lb","routing"].includes(type) && !unlocked)return fail("Acknowledge the opening milestone first.");
    if(["cache","cache-tuning"].includes(type)&&!c.dataStage)return fail("Enter the data stage first.");
    if(type==="cache"&&c.readCache)return fail("Cache is already deployed.");
    if(type==="cache-tuning"&&(!c.readCache||c.readCache.tuned))return fail("Deploy an untuned cache first.");
    const infrastructure = !["limit","unlimit","routing"].includes(type);
    if (infrastructure && c.pending.some(a => !["limit","unlimit","routing"].includes(a.type)))
        return fail("An infrastructure deployment is already pending.");
    if (type === "add-app" && c.apps.length >= (c.spikeStage?T.maximum:Q.maxApps))
        return fail(c.spikeStage ? "Four application instances are already installed." : "Two application instances are already installed.");
    if (type === "upgrade-db" && !databaseUpgrade(c))
        return fail("The database is already upgraded.");
    const target = action.type === "scale_up" ? c.apps.find(a=>a.id===action.appId) : null;
    if (type === "scale-up" && (!target || target.state !== "active" || target.tier !== "base"))return fail("Select an active base application to scale up.");
    if (type === "deploy-lb" && c.loadBalancer)return fail("Load balancing is already deployed.");
    const routing = action.type === "set_routing" ? {mode:action.mode,targets:[...action.targets].sort((a,b)=>Number(a.split("-")[1])-Number(b.split("-")[1]))} : null;
    if (routing && (!c.loadBalancer || !routingValid(c,routing) || c.pending.some(a=>a.type==="routing"||a.type==="retire-app") || JSON.stringify(routing)===JSON.stringify(c.routing)))return fail("Routing requires deployed load balancing, valid active targets and a changed configuration.");
    if (["limit","unlimit"].includes(type) && (c.pending.some(a => a.type === "limit" || a.type === "unlimit") || ((c.limit !== null) === (type === "limit"))))
        return fail("Admission setting is already active or a change is pending.");
    const costCents = type === "add-app" ? Q.appCostCents : type === "upgrade-db" ? databaseUpgrade(c)!.costCents : type === "scale-up" ? P.appCostCents : type === "deploy-lb" ? P.lbCostCents : type==="cache"?D.cacheCostCents:type==="cache-tuning"?D.tuningCostCents:0;
    if (c.cashCents - costCents <= 0)
        return fail("This purchase would exhaust company cash.");
    const n = s.campaign!;
    const delay = type === "add-app" ? Q.appDelay : type === "upgrade-db" ? databaseUpgrade(c)!.delay : type === "scale-up" ? P.appDelay : type === "deploy-lb" ? P.lbDelay : type==="cache"?D.cacheDelay:type==="cache-tuning"?D.tuningDelay:Q.admissionDelay;
    const scheduled: ScheduledAction = { id: `action-${n.nextEventId}`, type, requestedStep: n.step, activationStep: n.step + delay, costCents, activatedStep: null,
        ...(type === "add-app" ? {targetId:`app-${n.nextAppNumber++}`} : {}), ...(target ? {targetId:target.id,capacityAfter:P.appCapacity} : {}),
        ...(type === "upgrade-db" ? {capacityAfter:databaseUpgrade(c)!.capacity} : {}), ...(routing ? {routing} : {}) };
    if(target&&n.spikeStage?.controller)n.spikeStage.controller.managedAppIds=n.spikeStage.controller.managedAppIds.filter(id=>id!==target.id);
    if(routing){for(const p of n.pending.filter(a=>a.type==="promote-spare")){n.actions.find(a=>a.id===p.id)!.cancelledStep=n.step;trace(n,"failover-cancelled",{actionId:p.id,reason:"Superseded by explicit manual routing"});}n.pending=n.pending.filter(a=>a.type!=="promote-spare");}
    n.cashCents -= costCents;
    n.investedCents += costCents;
    n.pending.push(scheduled);
    n.actions.push({ ...scheduled });
    trace(n, "action-requested", { actionId: scheduled.id, type, costCents, activationStep: scheduled.activationStep, targetId:scheduled.targetId??null,
        routingBefore:JSON.stringify(c.routing), capacityBefore:target?.capacity??(type==="upgrade-db"?c.dbCapacity:null),capacityAfter:scheduled.capacityAfter??null,routing:routing?JSON.stringify(routing):null });
    projectCampaign(s);
    return null;
}
