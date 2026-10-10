import { APPLICATION_RELIABILITY as R } from "@/sim/scenarios/applicationReliability";
import { effectiveTargets, initializeHealth } from "@/sim/reliability";
import { emptyMeasurement, measurementValid, type Measurement } from "./telemetry";
import type { GameState } from "@/sim";
import { newGame } from "@/sim";
import { classifyData, routingValid } from "@/sim/step";
import { DATA_STRATEGY as D, DATA_PROFILES } from "@/sim/scenarios/dataStrategy";
import { TRAFFIC_SPIKES as T } from "@/sim/scenarios/trafficSpikes";
import { spikeInput } from "@/sim/autoscaling";
export const CAMPAIGN_SAVE_KEY = "nn.campaign.save.v1";
export interface SaveEnvelope {
    schemaVersion: 5 | 6;
    scenarioId: "opening-db";
    scenarioVersion: 1;
    runId: string;
    game: GameState;
    runtime: {
        remainderMs: number;
        measurement: Measurement;
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
    if(m?.version===6)return reliabilitySnapshotValid(m);
    if (!m || !m.app || !m.db)
        return false;
    if(m.version===3 || m.version===4 || m.version===5) {
        if(m.version===4||m.version===5) {
            const w=m.data;
            if(!w || !["read-heavy","write-heavy"].includes(w.profile) || w.readShare!==DATA_PROFILES[w.profile].readShare ||
                w.cacheableReadShare!==10000 || ![w.warmthUsed,w.warmthAfterStep,w.effectiveHitRateUsed,w.target].every(integer) ||
                typeof w.deployed!=="boolean" || (w.deployed?![6000,7500].includes(w.target):w.target!==0) ||
                w.warmthUsed>w.target || w.effectiveHitRateUsed!==w.warmthUsed ||
                w.warmthAfterStep!==(w.deployed&&w.eligibleReads>0?Math.min(w.target,w.warmthUsed+1200):w.warmthUsed))return false;
            const expected=classifyData(m.app.processed,w.readShare,w.cacheableReadShare,w.effectiveHitRateUsed);
            if(Object.entries(expected).some(([k,v])=>w[k as keyof typeof w]!==v))return false;
        } else if(m.data!==undefined)return false;
        const xs=m.instances;
        if(!xs?.length || xs.length>(m.version===5?4:2) || new Set(xs.map(x=>x.id)).size!==xs.length || !m.routing ||
            !["single","balanced"].includes(m.routing.mode) || !m.routing.targets.length || new Set(m.routing.targets).size!==m.routing.targets.length ||
            m.routing.targets.some(id=>!xs.some(x=>x.id===id)) || (m.routing.mode==="single"&&(m.routing.targets.length!==1||m.routing.targets[0]!=="app-1")))return false;
        const sum=(k:"demand"|"processed"|"backlog"|"failed"|"capacity")=>xs.reduce((n,x)=>n+x[k],0);
        const routed=xs.filter(x=>x.routed).reduce((n,x)=>n+x.capacity,0);
        if(!xs.every(x=>(m.version===5?/^app-[1-9][0-9]*$/:/^app-[12]$/).test(x.id)&&x.state==="active"&&["base","large"].includes(x.tier)&&
            x.capacity===(x.tier==="base"?1000:1600)&&x.routed===m.routing!.targets.includes(x.id)&&
            [x.demand,x.processed,x.backlog,x.failed].every(integer)&&x.processed<=x.capacity&&x.backlog<=1000&&
            x.demandRate===x.demand&&x.demandCount===x.demand&&x.processingBudget===x.capacity&&
            x.busyUtilisation===x.processed/x.capacity&&x.demandRatio===x.demand/x.capacity&&(!x.routed?x.demand===0:true)))return false;
        if(m.version===5) {
            const o=m.spikes;
            const work=xs.filter(x=>x.routed).reduce((n,x)=>n+x.processed,0);
            if(!o || ![null,1,2].includes(o.activePulse) || (o.activePulse===null?m.incoming!==T.baseline:m.incoming!==T.peak) ||
                o.installed!==xs.length || o.routed!==m.routing.targets.length || o.routedBusyBasisPoints!==Math.floor(work*10000/routed) ||
                typeof o.enabled!=="boolean" || !integer(o.highSteps) || o.highSteps>=T.highSteps || !integer(o.lowSteps) || o.lowSteps>=T.lowSteps ||
                !integer(o.cooldownUntil) || !(o.blockedReason===null||typeof o.blockedReason==="string"))return false;
        } else if(m.spikes!==undefined)return false;
        const d=m.db;
        return integer(m.step)&&[m.incoming,m.admitted,m.rejected,m.successful,m.failed].every(integer)&&m.incoming===m.admitted+m.rejected&&
            sum("demand")===m.admitted&&m.installedAppCapacity===sum("capacity")&&m.effectiveAppCapacity===routed&&m.app.capacity===routed&&
            m.app.demand===m.admitted&&m.app.processed===sum("processed")&&m.app.backlog===sum("backlog")&&m.app.failed===sum("failed")&&
            integer(m.appBusyBudget!)&&m.appBusyBudget!>=routed&&m.appBusyBudget!<=sum("capacity")&&
            m.app.busyUtilisation===m.app.processed/m.appBusyBudget!&&m.app.busyUtilisation<=1&&m.app.demandRatio===m.admitted/routed&&
            [d.demand,d.capacity,d.processed,d.backlog,d.failed].every(integer)&&[600,1000,2000,3000].includes(d.capacity)&&d.processed<=d.capacity&&d.backlog<=600&&
            d.busyUtilisation===d.processed/d.capacity&&d.demandRatio===d.demand/d.capacity&&d.demand===(m.data?.databaseNewDemand??sum("processed"))&&m.successful===d.processed+(m.data?.hits??0)&&m.failed===sum("failed")+d.failed&&
            m.latencyMs===100+1000*(Math.max(...xs.map(x=>x.backlog/x.capacity))+d.backlog/d.capacity)&&
            m.serviceErrorRate===(m.successful+m.failed?m.failed/(m.successful+m.failed):null);
    }
    if(m.version!==undefined)return false;
    const components = [m.app, m.db];
    return integer(m.step) && [m.incoming, m.admitted, m.rejected, m.successful, m.failed, m.installedAppCapacity].every(integer) &&
        m.incoming === m.admitted + m.rejected && m.successful === m.db.processed && m.failed === m.app.failed + m.db.failed &&
        components.every(x => [x.demand, x.capacity, x.processed, x.backlog, x.failed].every(integer) && x.capacity > 0 && x.processed <= x.capacity && x.busyUtilisation === x.processed / x.capacity && x.demandRatio === x.demand / x.capacity) &&
        m.db.demand === m.app.processed && m.app.backlog <= 1000 && m.db.backlog <= 600 &&
        m.latencyMs === 100 + 1000 * (m.app.backlog / m.app.capacity + m.db.backlog / m.db.capacity) &&
        m.serviceErrorRate === (m.successful + m.failed ? m.failed / (m.successful + m.failed) : null);
}
/** Optional schema-5 extension: absence is a valid old save, never inferred history. */
function preventionValid(c: import("@/sim/campaignTypes").Campaign, phase: GameState["phase"]): boolean {
    const p=c.openingPrevention;
    if(p===undefined)return true;
    if(!p || !integer(p.eligibleStep) || p.eligibleStep<4 || p.eligibleStep>c.step ||
        !c.trace.some(t=>t.type==="opening-prevention-eligible"&&t.step===p.eligibleStep) ||
        !integer(p.stableSteps) || p.stableSteps>5)return false;
    for(const [step,component] of [[p.appInspectedStep,"app"],[p.dbInspectedStep,"db"]] as const) {
        if(step!==null && (!integer(step)||step<p.eligibleStep||step>c.step||
            !c.trace.some(t=>t.type==="inspection"&&t.step===step&&t.data.component===component)||
            !c.trace.some(t=>t.type===`opening-prevention-${component==="app"?"application":"database"}-inspected`&&t.step===step)))return false;
    }
    const healthy=(m: import("@/sim/campaignTypes").Snapshot)=>snapshotValid(m)&&m.incoming===800&&m.admitted===800&&m.rejected===0&&
        m.app.backlog===0&&m.db.backlog===0&&m.latencyMs<500&&m.serviceErrorRate!==null&&m.serviceErrorRate<0.01&&m.successful+m.failed>0;
    const evidence=(xs: import("@/sim/campaignTypes").Snapshot[],end:number,count:number)=>
        p.appInspectedStep!==null&&p.dbInspectedStep!==null&&xs.length===count&&xs.every((m,i)=>
            healthy(m)&&m.step===end-count+1+i&&m.step>p.eligibleStep&&m.step>p.appInspectedStep!&&m.step>p.dbInspectedStep!);
    if(p.outcome===null) {
        if(p.stableSteps===5)return false;
        return p.stableSteps===0 || (phase==="management"&&c.cashCents>0&&c.limit===null&&!c.firstPauseConsumed&&!c.incident&&!c.reports.length&&!c.openingMilestone&&
            !c.trace.some(t=>t.type==="incident-opened")&&evidence(c.recent.slice(-p.stableSteps),c.step,p.stableSteps));
    }
    const o=p.outcome;
    if(!o||o.id!=="opening-prevention"||!integer(o.qualifiedStep)||o.qualifiedStep>c.step||p.stableSteps!==5||typeof o.acknowledged!=="boolean"||
        !integer(o.rejectedDemand)||!integer(o.setupCents)||o.rejectedDemand>c.cumulative.rejected||o.setupCents>c.investedCents||
        !Array.isArray(o.snapshots)||!evidence(o.snapshots,o.qualifiedStep,5)||
        c.trace.some(t=>t.type==="incident-opened"&&t.step<=o.qualifiedStep)||
        !c.trace.some(t=>t.type==="opening-prevention-qualified"&&t.step===o.qualifiedStep&&t.data.outcomeId===o.id))return false;
    const ack=c.trace.some(t=>t.type==="opening-prevention-review-acknowledged"&&t.step>=o.qualifiedStep&&t.data.outcomeId===o.id);
    return o.acknowledged===ack && (o.acknowledged?
        c.openingMilestone?.outcomeId===o.id&&c.openingMilestone.incidentId===null:
        phase==="management"&&c.step===o.qualifiedStep&&c.cashCents>0&&c.limit===null&&!c.incident&&!c.reports.length&&!c.openingMilestone&&!c.openingRecovered);
}

const integer = (n: number) => Number.isSafeInteger(n) && n >= 0;
function validateVersion(value: unknown, version: 2 | 3 | 4 | 5 | 6): Validation {
    try {
        if (!value || typeof value !== "object")
            return { status: "corrupt" };
        const e = value as SaveEnvelope;
        if (Number(e.schemaVersion) !== version || e.scenarioId !== "opening-db" || e.scenarioVersion !== 1)
            return { status: "unsupported" };
        const s = e.game, c = s.campaign!;
        const milestone=c?.openingMilestone;
        const preventionMilestone=version>=5&&milestone?.incidentId===null;
        if(milestone===undefined || (milestone!==null&&(milestone.id!=="opening-stability"||!integer(milestone.awardedStep)||
          milestone.awardedStep>c.step||typeof milestone.acknowledged!=="boolean"||
          (preventionMilestone?(!c.openingPrevention?.outcome?.acknowledged||milestone.outcomeId!==c.openingPrevention.outcome.id||
            milestone.awardedStep<c.openingPrevention.outcome.qualifiedStep):
            (!c.openingRecovered||milestone.incidentId!==c.reports[0]?.id||milestone.awardedStep<c.reports[0].recoveredStep||milestone.outcomeId!==undefined)))) || !measurementValid(e.runtime?.measurement) ||
          e.runtime.measurement.cursor>c.trace.length || e.runtime.measurement.pending.some(x=>x.runId!==c.runId))
          return {status:"corrupt"};
        const template = newGame();
        if(version<5) {
            const old=template.campaign! as unknown as Record<string,unknown>;
            delete old.spikeStage;delete old.nextAppNumber;
            delete (old.remainders as Record<string,unknown>).controller;
            delete (old.ledger as Record<string,unknown>).controllerNumerator;
            if(c.spikeStage!=null)return {status:"corrupt"};
        }
        if(version<4) {
            const old=template.campaign! as unknown as Record<string,unknown>;
            delete old.dataStage;delete old.readCache;
            delete (old.remainders as Record<string,unknown>).cache;
            delete (old.ledger as Record<string,unknown>).cacheNumerator;
        }
        if(version===2) {
            const old=template.campaign! as unknown as Record<string,unknown>;
            for(const key of ["routing","loadBalancer","routingEnabledOnce","scaling","overload"])delete old[key];
            delete (old.remainders as Record<string,unknown>).lb;
            delete (old.ledger as Record<string,unknown>).lbNumerator;
        }
        if(version<6&&(c.reliabilityStage!=null||c.apps.some(a=>a.health!==undefined||a.detectedHealth!==undefined||a.role!==undefined)))return {status:"corrupt"};
        if(version===6&&!reliabilityValid(c))return {status:"corrupt"};
        if (!finiteTree(e) || !shape(s, template) || !c || !shape(c, template.campaign) ||
            !e.runtime || !integer(e.runtime.remainderMs) || e.runtime.remainderMs >= 1000 ||
            !Number.isFinite(e.savedAt) || typeof e.runId !== "string" || !e.runId || e.runId !== c.runId ||
            c.scenarioId !== e.scenarioId || c.scenarioVersion !== e.scenarioVersion ||
            !["management", "incident", "review", "ended"].includes(s.phase) ||
            (s.phase === "ended" ? s.outcome !== "bankrupt" : s.outcome !== null) ||
            (s.phase === "review" && (!c.reports.length || c.reports.at(-1)!.recoveredStep !== c.step)) ||
            s.cash !== c.cashCents / 100 || s.users !== 2000 || s.engineers !== 4 || s.infra.appHosts.length !== c.apps.length ||
            !integer(c.step) || !Number.isSafeInteger(c.cashCents) || !integer(c.nextEventId) ||
            !integer(c.overloadSteps) || c.lastSettledPeriod !== Math.floor(c.step / 60) ||
            !snapshotValid(c.snapshot) || c.snapshot.step !== c.step || !(version>=4?[600,1000,2000,3000]:version===3?[600,1000,2000]:[600,1000]).includes(c.dbCapacity) ||
            !integer(c.dbBacklog) || c.dbBacklog > 600 || ![null, 500].includes(c.limit) ||
            c.apps.length < 1 || c.apps.length > (version>=5&&c.spikeStage?4:2) ||
            c.apps.some((a, i) => (version>=5&&c.spikeStage?!/^app-[1-9][0-9]*$/.test(a.id):a.id !== `app-${i + 1}`) || (version===2?(a.capacity!==1000||a.routed!==(i===0)):(a.state!=="active"||!["base","large"].includes(a.tier)||a.capacity!==(a.tier==="base"?1000:1600)||a.routed!==c.routing.targets.includes(a.id))) || !integer(a.backlog) || a.backlog > 1000) ||
            (s.phase !== "ended" && (s.phase === "incident") !== !!c.incident) ||
            (c.incident && (!integer(c.incident.stableSteps) || c.incident.stableSteps >= 5 || (!Array.isArray(c.incident.snapshots) || !c.incident.snapshots.every(snapshotValid)))) ||
            !Object.values(c.remainders).every(v => integer(v) && v < 60) ||
            !Object.values(c.ledger).every(integer) ||
            !Object.values(c.cumulative).every(integer) ||
            c.cumulative.admitted !== c.cumulative.successful + c.cumulative.failed + c.apps.reduce((n, a) => n + a.backlog, 0) + c.dbBacklog ||
            !(version>=4?[300,800,1400,2400,...(version>=5?[4000]:[])]:version===3?[300,800,1400]:[300,800]).includes(c.incomingRate) || c.upgraded !== (c.dbCapacity >= 1000) ||
            c.snapshot.db.backlog !== c.dbBacklog || c.snapshot.app.backlog !== c.apps.reduce((n,a)=>n+a.backlog,0) ||
            c.snapshot.db.capacity !== c.dbCapacity || c.snapshot.installedAppCapacity !== c.apps.reduce((n,a)=>n+a.capacity,0) ||
            (c.step >= 4) !== c.consumedEvents.includes("opening-growth") ||
            c.actions.some(a => typeof a.id !== "string" || !(version>=3?["add-app","upgrade-db","limit","unlimit","scale-up","deploy-lb","routing",...(version>=4?["cache","cache-tuning"]:[]),...(version>=5?["deploy-autoscaler","retire-app"]:[]),...(version===6?["health-checks","create-spare","reserve-spare","release-spare","failover","promote-spare","restore-app"]:[])]:["add-app", "upgrade-db", "limit", "unlimit"]).includes(a.type) || !integer(a.requestedStep) || a.requestedStep > c.step || !integer(a.activationStep) || a.activationStep <= a.requestedStep || !integer(a.costCents) || (a.activatedStep !== null && (!integer(a.activatedStep) || a.activatedStep !== a.activationStep || a.activatedStep > c.step))) ||
            c.settlements.length !== c.lastSettledPeriod ||
            !c.settlements.every((p, i) => p.period === i + 1 && p.step === (i + 1) * 60 && [p.revenueCents, p.appCents, p.dbCents, p.salaryCents,p.lbCents??0,p.cacheCents??0,p.controllerCents??0,p.checksCents??0,p.failoverCents??0].every(integer) && p.netCents === p.revenueCents - p.appCents - p.dbCents - p.salaryCents - (p.lbCents??0) - (p.cacheCents??0) - (p.controllerCents??0) - (p.checksCents??0) - (p.failoverCents??0)) ||
            c.pending.some(a => !c.actions.some(b=>JSON.stringify(a)===JSON.stringify(b)) || !integer(a.activationStep) || a.activationStep <= c.step || !integer(a.requestedStep) || a.requestedStep > c.step || !integer(a.costCents) || a.activatedStep !== null) ||
            new Set(c.pending.map(a => a.id)).size !== c.pending.length ||
            c.pending.some(a => !c.actions.some(b => b.id === a.id && b.activationStep === a.activationStep)) ||
            !c.trace.every((t, i) => t.id === i + 1 && integer(t.step) && t.step <= c.step && typeof t.type === "string" && !!t.data) || c.nextEventId !== c.trace.length + 1 ||
            !c.recent.every(snapshotValid) ||
            !c.reports.every(p => integer(p.openedStep) && integer(p.recoveredStep) && p.openedStep <= p.recoveredStep && p.recoveredStep <= c.step &&
            integer(p.setupCents) && typeof p.limited === "boolean" && typeof p.id === "string" && Array.isArray(p.snapshots) && p.snapshots.length > 0 && Array.isArray(p.events) && Array.isArray(p.explanations) && p.snapshots.every(snapshotValid) && p.explanations.every(t => typeof t === "string")))
            return { status: "corrupt" };
        if(version>=3) {
            if(c.actions.some(a=>{
                const dataUpgrade=a.type==="upgrade-db"&&a.capacityAfter===3000;
                const reliabilityDelay=({"health-checks":2,"create-spare":2,"reserve-spare":1,"release-spare":1,"failover":2,"promote-spare":1,"restore-app":3} as Record<string,number>)[a.type];
                const delay=reliabilityDelay??(dataUpgrade?4:a.type==="cache"||a.type==="cache-tuning"?2:a.type==="add-app"&&a.source==="autoscaler"?3:a.type==="add-app"||a.type==="deploy-lb"||a.type==="deploy-autoscaler"?2:a.type==="upgrade-db"||a.type==="scale-up"?3:1);
                const reliabilityCost=({"health-checks":50000,"create-spare":100000,"reserve-spare":0,"release-spare":0,"failover":100000,"promote-spare":0,"restore-app":0} as Record<string,number>)[a.type];
                const cost=reliabilityCost??(dataUpgrade?400000:a.type==="cache"?150000:a.type==="cache-tuning"?100000:a.type==="add-app"||a.type==="deploy-lb"||a.type==="deploy-autoscaler"?100000:a.type==="upgrade-db"?300000:a.type==="scale-up"?200000:0);
                return a.activationStep!==a.requestedStep+delay || a.costCents!==cost ||
                    (a.type==="add-app"&&(!(version>=5&&c.spikeStage)?a.targetId!=="app-2":!/^app-[1-9][0-9]*$/.test(a.targetId??""))) ||
                    (a.type==="upgrade-db"&&!(version>=4?[1000,2000,3000]:[1000,2000]).includes(a.capacityAfter!)) ||
                    ((["scale-up","deploy-lb","routing"].includes(a.type)||a.capacityAfter===2000)&&!c.openingMilestone?.acknowledged);
            }) || c.pending.filter(a=>!["limit","unlimit","routing","promote-spare"].includes(a.type)).length>1 ||
                c.pending.filter(a=>a.type==="routing"||a.type==="retire-app"||a.type==="promote-spare").length>1 || c.pending.filter(a=>a.type==="limit"||a.type==="unlimit").length>1 ||
                (c.dbCapacity===2000&&!c.openingMilestone?.acknowledged))return {status:"corrupt"};
            if(!routingValid(c,c.routing)||typeof c.loadBalancer!=="boolean"||typeof c.routingEnabledOnce!=="boolean"||
                !c.overload||Object.keys(c.overload).some(id=>id!=="db"&&!c.apps.some(a=>a.id===id))||!["db",...c.apps.map(a=>a.id)].every(id=>integer(c.overload[id]))||c.overload.db!==c.overloadSteps||
                !integer(c.ledger.lbNumerator!)||!integer(c.remainders.lb!)||
                (c.scaling!==null&&(!c.openingMilestone?.acknowledged||c.scaling.id!=="application-scaling"||c.scaling.version!==1||!integer(c.scaling.enteredStep)||c.scaling.enteredStep>c.step||
                (c.scaling.dueStep!==null&&(!integer(c.scaling.dueStep)||c.scaling.dueStep<=c.scaling.enteredStep))||typeof c.scaling.consumed!=="boolean"||c.scaling.consumed!==c.consumedEvents.includes("scaling-growth")))||
                (!c.scaling&&c.consumedEvents.includes("scaling-growth"))||
                ((c.snapshot.version===3||c.snapshot.version===4||c.snapshot.version===5)&&(!c.snapshot.instances!.every(x=>c.apps.some(a=>a.id===x.id&&a.capacity===x.capacity&&a.backlog===x.backlog&&a.routed===x.routed))||JSON.stringify(c.snapshot.routing)!==JSON.stringify(c.routing)))||
                c.actions.some(a=>(a.type==="scale-up"&&(!c.apps.some(x=>x.id===a.targetId)||a.capacityAfter!==1600))||(a.type==="routing"&&(!a.routing||(version>=5&&c.spikeStage?!a.routing.targets.every(id=>/^app-[1-9][0-9]*$/.test(id)&&Number(id.slice(4))<c.nextAppNumber):!routingValid(c,a.routing))))))return {status:"corrupt"};
        }
        if(version>=4) {
            const d=c.dataStage,k=c.readCache;
            if(d===undefined||k===undefined||!integer(c.ledger.cacheNumerator!)||!integer(c.remainders.cache!))return {status:"corrupt"};
            if(d!==null&&(!c.scaling?.consumed||d.id!==D.id||d.version!==1||!integer(d.enteredStep)||d.enteredStep>c.step||
                (d.dueStep!==null&&(!integer(d.dueStep)||d.dueStep<d.enteredStep+4))||!["read-heavy","write-heavy"].includes(d.profile)||
                !["seeded","evaluation"].includes(d.source)||d.configuration!==JSON.stringify(D)||typeof d.consumed!=="boolean"||
                typeof d.contrastConsumed!=="boolean"||d.consumed!==c.consumedEvents.includes("data-growth")||
                d.contrastConsumed!==c.consumedEvents.includes("data-contrast")||(!d.consumed&&d.contrastConsumed)))return {status:"corrupt"};
            if(!d&&(k||c.dbCapacity===3000||c.consumedEvents.includes("data-growth")||c.actions.some(a=>["cache","cache-tuning"].includes(a.type)||a.capacityAfter===3000)))return {status:"corrupt"};
            if(k&&(!c.actions.some(a=>a.type==="cache"&&a.activatedStep===k.activatedStep)||(k.tuned&&!c.actions.some(a=>a.type==="cache-tuning"&&a.activatedStep!==null))||!d||!integer(k.activatedStep)||k.activatedStep>c.step||!integer(k.warmth)||k.warmth>k.target||
                typeof k.tuned!=="boolean"||k.target!==(k.tuned?7500:6000)||(!k.tuned&&k.warmth%1200!==0)))return {status:"corrupt"};
            if(d?.consumed&&((c.spikeStage?c.incomingRate!==spikeInput(c):c.incomingRate!==2400)||!(c.reliabilityStage?[4,5,6]:c.spikeStage?[4,5]:[4]).includes(c.snapshot.version!)||(c.snapshot.data?.profile!==d.profile&&!c.trace.some(t=>t.type==="workload-changed"&&t.data.eventId==="data-contrast"&&t.step===c.step&&t.id>(c.trace.filter(x=>x.type==="metrics").at(-1)?.id??0)))||
                c.snapshot.data!.deployed!==!!k||c.snapshot.data!.warmthAfterStep!==(k?.warmth??0)||c.snapshot.data!.target!==(k?.target??0)))return {status:"corrupt"};
            if(!d?.consumed&&(c.snapshot.version===4||c.snapshot.version===5))return {status:"corrupt"};
            if(c.actions.some(a=>["cache","cache-tuning"].includes(a.type)&&(!d||a.requestedStep<d.enteredStep))||
                c.actions.some(a=>a.type==="cache-tuning"&&(!k||a.requestedStep<k.activatedStep)))return {status:"corrupt"};
        }
        if((version>=5?!preventionValid(c,s.phase):c.openingPrevention!==undefined))return {status:"corrupt"};
        if(version>=5&&!phase5Valid(c))return {status:"corrupt"};
        return { status: "ok", envelope: e };
    }
    catch {
        return { status: "corrupt" };
    }
}
export function validateEnvelope(value: unknown): Validation { return validateVersion(value,6); }
export function decodeSave(raw: string): Validation {
    try {
        return validateEnvelope(JSON.parse(raw));
    }
    catch {
        return { status: "corrupt" };
    }
}
export function makeEnvelope(game: GameState, remainderMs = 0, savedAt = Date.now(), measurement: Measurement = emptyMeasurement()): SaveEnvelope {
    return { schemaVersion: 6, scenarioId: "opening-db", scenarioVersion: 1, runId: game.campaign!.runId, game, runtime: { remainderMs, measurement }, savedAt };
}
/** Future migrations must preserve source bytes before replacing a validated slot. No v0 conversion is registered. */
export type MigrationRegistry = Readonly<Record<number, (value: unknown) => unknown>>;
export function migrateSave(storage: Pick<Storage, "getItem" | "setItem">, migrations: MigrationRegistry = PHASE6_MIGRATIONS): boolean {
    try {
        const original = storage.getItem(CAMPAIGN_SAVE_KEY);
        if (original === null)
            return false;
        let value = JSON.parse(original) as {
            schemaVersion?: number;
        };
        const sourceVersion = value.schemaVersion;
        if (typeof sourceVersion !== "number" || sourceVersion >= 6 || !migrations[sourceVersion])
            return false;
        const backup = `${CAMPAIGN_SAVE_KEY}.backup.v${sourceVersion}`;
        if (storage.getItem(backup) !== null && storage.getItem(backup) !== original)
            return false;
        storage.setItem(backup, original);
        while (typeof value.schemaVersion === "number" && value.schemaVersion < 6) {
            const version = value.schemaVersion, migrate = migrations[version];
            if (!migrate)
                return false;
            value = migrate(value) as {
                schemaVersion?: number;
            };
            if (!value || (value.schemaVersion !== version + 1 && value.schemaVersion !== 6))
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

/** Preserve scenario v1; only add milestone and application measurement metadata. */
export const PHASE2_MIGRATIONS: MigrationRegistry = {1: value => {
    const e=structuredClone(value) as SaveEnvelope;
    const c=e.game.campaign!;
    c.openingMilestone=null;
    if(c.reports.length) {
      const first=c.reports[0];
      const ack=c.trace.find(t=>t.type==="review-acknowledged" && t.step>=first.recoveredStep);
      if(ack)c.openingMilestone={id:"opening-stability",incidentId:first.id,awardedStep:ack.step,acknowledged:true};
      else if(e.game.phase!=="review" || c.reports.length!==1)throw Error("Ambiguous report acknowledgement");
    }
    (e as unknown as {schemaVersion:number}).schemaVersion=2;
    e.runtime.measurement={...emptyMeasurement(),origin:"phase1",runStarted:true,cursor:c.trace.length};
    return e;
}};
export const PHASE3_MIGRATIONS: MigrationRegistry = {...PHASE2_MIGRATIONS,2:value=>{
    if(validateVersion(value,2).status!=="ok")throw Error("Invalid Phase 2 source");
    const e=structuredClone(value) as SaveEnvelope,c=e.game.campaign!;
    c.apps=c.apps.map(a=>({...a,tier:"base",state:"active"}));
    c.routing={mode:"single",targets:["app-1"]};c.loadBalancer=false;c.routingEnabledOnce=false;c.scaling=null;
    c.overload=Object.fromEntries(c.apps.map(a=>[a.id,0]));c.overload.db=c.overloadSteps;
    c.ledger.lbNumerator=0;c.remainders.lb=0;
    for(const a of [...c.actions,...c.pending]) {
        if(a.type==="add-app")a.targetId="app-2";
        if(a.type==="upgrade-db")a.capacityAfter=1000;
    }
    (e as unknown as {schemaVersion:number}).schemaVersion=3;return e;
}};

export const PHASE4_MIGRATIONS: MigrationRegistry = {...PHASE3_MIGRATIONS,3:value=>{
 if(validateVersion(value,3).status!=="ok")throw Error("Invalid Phase 3 source");
 const e=structuredClone(value) as SaveEnvelope,c=e.game.campaign!;
 c.dataStage=null;c.readCache=null;c.ledger.cacheNumerator=0;c.remainders.cache=0;
 (e as unknown as {schemaVersion:number}).schemaVersion=4;return e;
}};

/** Source validated before any new fields; no automatic stage entry or historical observations. */
export const PHASE5_MIGRATIONS:MigrationRegistry={...PHASE4_MIGRATIONS,4:value=>{
 if(validateVersion(value,4).status!=="ok")throw Error("Invalid Phase 4 source");
 const e=structuredClone(value) as SaveEnvelope,c=e.game.campaign!;
 c.spikeStage=null;
 const ids=[...c.apps.map(a=>a.id),...c.actions.map(a=>a.targetId??""),...c.trace.flatMap(t=>[String(t.data.targetId??"")])];
 c.nextAppNumber=Math.max(1,...ids.filter(id=>/^app-[1-9][0-9]*$/.test(id)).map(id=>Number(id.slice(4))))+1;
 c.ledger.controllerNumerator=0;c.remainders.controller=0;e.schemaVersion=5;return e;
}};
function phase5Valid(c:import("@/sim/campaignTypes").Campaign):boolean {
 if(!integer(c.nextAppNumber)||c.nextAppNumber<2||new Set(c.apps.map(a=>a.id)).size!==c.apps.length||
 c.apps.some(a=>Number(a.id.slice(4))>=c.nextAppNumber)||!integer(c.ledger.controllerNumerator!)||!integer(c.remainders.controller!))return false;
 const d=c.spikeStage;
 if(d===undefined)return false;
 if(!d)return c.incomingRate!==4000&&c.snapshot.version!==5&&!c.actions.some(a=>a.source==="autoscaler"||["deploy-autoscaler","retire-app"].includes(a.type));
 if(!c.dataStage?.consumed||d.id!==T.id||d.version!==1||d.configuration!==JSON.stringify(T)||!integer(d.enteredStep)||d.enteredStep>c.step||
 !Array.isArray(d.deadlines)||JSON.stringify(d.deadlines)!==JSON.stringify(T.offsets.map(x=>d.enteredStep+x))||!Array.isArray(d.consumed)||
 d.researchEarned!==1||![0,1].includes(d.researchSpent)||!integer(d.baselineStableSteps)||d.baselineStableSteps>5||typeof d.acknowledged!=="boolean"||
 (d.completedStep===null?d.acknowledged:!integer(d.completedStep))||
 (d.completedStep!==null&&(d.completedStep<d.deadlines[3]+4||d.completedStep>c.step||d.baselineStableSteps!==5)))return false;
 const expected=["spike-1-start","spike-1-end","spike-2-start","spike-2-end"].filter((_,i)=>c.step>=d.deadlines[i]);
 if(JSON.stringify(d.consumed)!==JSON.stringify(expected)||expected.some(id=>!c.consumedEvents.includes(id)))return false;
 const a=d.controller;
 if(a) {
  if(d.researchSpent!==1||!integer(a.activatedStep)||a.activatedStep>c.step||typeof a.enabled!=="boolean"||
   !integer(a.highSteps)||a.highSteps>=3||!integer(a.lowSteps)||a.lowSteps>=6||!integer(a.cooldownUntil)||
   !Array.isArray(a.managedAppIds)||new Set(a.managedAppIds).size!==a.managedAppIds.length||
   a.managedAppIds.some(id=>!c.apps.some(x=>x.id===id&&x.tier==="base")||!c.actions.some(x=>x.type==="add-app"&&x.source==="autoscaler"&&x.targetId===id&&x.activatedStep!==null))||
   !(a.joiningAppId===null||(c.apps.some(x=>x.id===a.joiningAppId)&&c.actions.some(x=>x.type==="add-app"&&x.source==="autoscaler"&&x.targetId===a.joiningAppId&&x.activatedStep!==null))||c.pending.some(x=>x.type==="add-app"&&x.source==="autoscaler"&&x.targetId===a.joiningAppId))||
   typeof a.expectedRouting!=="string"||!(a.blockedReason===null||typeof a.blockedReason==="string")||
   !c.actions.some(x=>x.type==="deploy-autoscaler"&&x.activatedStep===a.activatedStep))return false;
 }
 if(c.actions.some(x=>(x.type==="deploy-autoscaler"&&d.researchSpent!==1)||(x.source!==undefined&&!["player","autoscaler",...(c.reliabilityStage?["failover"]:[])].includes(x.source))||
  ((x.source==="autoscaler"||["deploy-autoscaler","retire-app"].includes(x.type))&&x.requestedStep<d.enteredStep)||
  (x.cancelledStep!==undefined&&(!["retire-app","promote-spare"].includes(x.type)||(x.type==="retire-app"&&x.cancelledStep!==x.activationStep)||x.activatedStep!==null||x.cancelledStep>c.step))||
  (x.source==="autoscaler"&&!a)))return false;
 if(c.pending.some(x=>x.routing&&!routingValid(c,x.routing)))return false;
 if(c.snapshot.version===5) {
  const o=c.snapshot.spikes;if(!o||o.installed!==c.apps.length||o.routed!==c.routing.targets.length||!integer(o.routedBusyBasisPoints)||o.routedBusyBasisPoints>10000||
   typeof o.enabled!=="boolean"||!integer(o.highSteps)||o.highSteps>=3||!integer(o.lowSteps)||o.lowSteps>=6||!integer(o.cooldownUntil)||!(o.blockedReason===null||typeof o.blockedReason==="string"))return false;
 }
 return true;
}

export const PHASE6_MIGRATIONS:MigrationRegistry={...PHASE5_MIGRATIONS,5:value=>{
 if(validateVersion(value,5).status!=="ok")throw Error("Invalid Phase 5 source");
 const e=structuredClone(value) as SaveEnvelope,c=e.game.campaign!;
 c.reliabilityStage=null;c.apps.forEach(a=>initializeHealth(a,c.step));
 c.ledger.checksNumerator=0;c.ledger.failoverNumerator=0;c.remainders.checks=0;c.remainders.failover=0;
 e.schemaVersion=6;return e;
}};
function reliabilitySnapshotValid(m:import("@/sim/campaignTypes").Snapshot):boolean {
 const xs=m.instances,o=m.reliability,w=m.data,d=m.db;
 if(!xs?.length||xs.length>4||!o||!w||!m.routing||!finiteTree(m)||new Set(xs.map(x=>x.id)).size!==xs.length)return false;
 if(!["single","balanced"].includes(m.routing.mode)||!m.routing.targets.length||new Set(m.routing.targets).size!==m.routing.targets.length||m.routing.targets.some(id=>!xs.some(a=>a.id===id))||JSON.stringify(o.configured)!==JSON.stringify(m.routing.targets)||new Set(o.effective).size!==o.effective.length||o.effective.some(id=>!o.configured.includes(id)))return false;
 const sum=(key:"demand"|"processed"|"backlog"|"failed"|"capacity")=>xs.reduce((n,a)=>n+a[key],0);
 if(xs.some(a=>!/^app-[1-9][0-9]*$/.test(a.id)||a.state!=="active"||!["base","large"].includes(a.tier)||a.capacity!==(a.tier==="base"?1000:1600)||!["healthy","failed"].includes(a.health!)||!["healthy","unhealthy","unknown"].includes(a.detectedHealth!)||!["serving","spare"].includes(a.role!)||a.configured!==o.configured.includes(a.id)||a.routed!==o.effective.includes(a.id)||a.processingBudget!==(a.health==="failed"?0:a.capacity)||![a.demand,a.processed,a.backlog,a.failed].every(integer)||a.backlog>1000||a.processed>a.processingBudget||a.busyUtilisation!==a.processed/a.capacity||a.demandRatio!==a.demand/a.capacity||a.demandRate!==a.demand||a.demandCount!==a.demand||(!a.routed&&a.demand!==0)||(a.health==="failed"&&(a.processed!==0||a.failed!==a.demand))||(a.role==="spare"&&(a.routed||a.backlog||a.demand))))return false;
 const routed=xs.filter(a=>a.routed&&a.health==="healthy").reduce((n,a)=>n+a.capacity,0);
 const budget=xs.filter(a=>a.health==="healthy"&&(a.routed||a.backlog>0||a.processed>0)).reduce((n,a)=>n+a.capacity,0);
 if(o.unroutable!==(o.effective.length?0:m.admitted)||o.failedDeliveries!==xs.filter(a=>a.health==="failed").reduce((n,a)=>n+a.failed,0)+o.unroutable||o.healthyCapacity!==xs.filter(a=>a.health==="healthy").reduce((n,a)=>n+a.capacity,0)||o.healthyRoutedCapacity!==routed||o.spareCapacity!==xs.filter(a=>a.role==="spare").reduce((n,a)=>n+a.capacity,0))return false;
 const data=classifyData(sum("processed"),w.readShare,w.cacheableReadShare,w.effectiveHitRateUsed);
 if(!["read-heavy","write-heavy"].includes(w.profile)||w.readShare!==DATA_PROFILES[w.profile].readShare||w.cacheableReadShare!==10000||Object.entries(data).some(([k,v])=>w[k as keyof typeof w]!==v)||![w.warmthUsed,w.warmthAfterStep,w.target].every(integer)||w.effectiveHitRateUsed!==w.warmthUsed||w.warmthUsed>w.target||w.warmthAfterStep!==(w.deployed&&w.eligibleReads>0?Math.min(w.target,w.warmthUsed+1200):w.warmthUsed))return false;
 return [m.step,m.incoming,m.admitted,m.rejected,m.successful,m.failed].every(integer)&&m.incoming===m.admitted+m.rejected&&sum("demand")+o.unroutable===m.admitted&&m.app.demand===m.admitted&&m.app.capacity===routed&&m.effectiveAppCapacity===routed&&m.installedAppCapacity===sum("capacity")&&m.app.processed===sum("processed")&&m.app.backlog===sum("backlog")&&m.app.failed===sum("failed")+o.unroutable&&integer(m.appBusyBudget!)&&m.appBusyBudget!>=budget&&m.appBusyBudget!<=sum("capacity")&&m.app.busyUtilisation===(m.appBusyBudget?m.app.processed/m.appBusyBudget:0)&&m.app.demandRatio===(routed?m.admitted/routed:0)&&[d.demand,d.capacity,d.processed,d.backlog,d.failed].every(integer)&&[600,1000,2000,3000].includes(d.capacity)&&d.backlog<=600&&d.processed<=d.capacity&&d.busyUtilisation===d.processed/d.capacity&&d.demandRatio===d.demand/d.capacity&&d.demand===data.databaseNewDemand&&m.successful===d.processed+w.hits&&m.failed===m.app.failed+d.failed&&m.latencyMs===100+1000*(Math.max(...xs.map(a=>a.backlog/a.capacity))+d.backlog/d.capacity)&&m.serviceErrorRate===(m.successful+m.failed?m.failed/(m.successful+m.failed):null);
}
function reliabilityValid(c:import("@/sim/campaignTypes").Campaign):boolean {
 const d=c.reliabilityStage;
 // Current schema-6 saves created directly by older in-memory fixtures may lack health until entry; no historical observations inferred.
 if(d==null)return !c.apps.some(a=>a.health==="failed"||a.role==="spare")&&!c.actions.some(a=>["health-checks","create-spare","reserve-spare","release-spare","failover","promote-spare","restore-app"].includes(a.type));
 if(!c.spikeStage?.acknowledged||d.id!==R.id||d.version!==1||d.configuration!==JSON.stringify(R)||!integer(d.enteredStep)||d.enteredStep>c.step||d.researchEarned!==3||new Set(d.owned).size!==d.owned.length||d.owned.some(id=>!["health_checks","standby","auto_failover"].includes(id))||!c.trace.some(t=>t.type==="reliability-research-awarded"&&t.step===d.enteredStep)||d.owned.some(id=>!c.trace.some(t=>t.type==="reliability-tech-unlocked"&&t.data.techId===id))||(!d.owned.includes("health_checks")&&d.checksStep!==null)||(!d.owned.includes("standby")&&d.spareId!==null)||(!d.owned.includes("auto_failover")&&d.failover))return false;
 if(!integer(d.stableSteps)||d.stableSteps>5||!integer(d.failureSteps)||typeof d.acknowledged!=="boolean"||(d.completedStep===null?d.acknowledged:(!integer(d.completedStep)||d.completedStep>c.step||d.stableSteps!==5||!c.trace.some(t=>t.type==="reliability-stage-completed"&&t.step===d.completedStep))))return false;
 if(c.apps.some(a=>!["healthy","failed"].includes(a.health!)||!["unknown","healthy","unhealthy"].includes(a.detectedHealth!)||!["serving","spare"].includes(a.role!)||!integer(a.healthChangedStep!)||a.healthChangedStep!>c.step||(a.detectedStep!==null&&(!integer(a.detectedStep!)||a.detectedStep!>c.step))))return false;
 const spares=c.apps.filter(a=>a.role==="spare");if(spares.length>1||(d.spareId===null?spares.length!==0:spares[0]?.id!==d.spareId)||spares.some(a=>a.backlog||a.routed))return false;
 const f=d.fault;
 if(f&&(!c.apps.some(a=>a.id===f.targetId)||!integer(f.armedStep)||f.startStep!==f.armedStep+8||f.naturalStep!==f.startStep+20||f.armedStep<d.enteredStep||f.armedStep>c.step||(f.startedStep===null?c.step>=f.startStep:(f.startedStep!==f.startStep||f.startedStep>c.step))||(f.restoredStep!==null&&(!integer(f.restoredStep)||f.restoredStep<f.startStep||f.restoredStep>f.naturalStep||f.restoredStep>c.step||!["manual","natural"].includes(f.restoreSource!)))||c.apps.some(a=>a.health==="failed"&&(a.id!==f.targetId||f.startedStep===null||f.restoredStep!==null))))return false;
 if(!f&&(c.apps.some(a=>a.health==="failed")||d.completedStep!==null))return false;
 if(f&&f.startedStep!==null&&f.restoredStep===null&&c.step>=f.naturalStep)return false;
 if(d.completedStep!==null&&(!f||f.restoredStep===null||d.completedStep<f.restoredStep+4))return false;
 if(d.checksStep!==null&&(!integer(d.checksStep)||d.checksStep>c.step||!c.actions.some(a=>a.type==="health-checks"&&a.activatedStep===d.checksStep)))return false;
 if(d.failover&&(!integer(d.failover.activatedStep)||d.failover.activatedStep>c.step||typeof d.failover.enabled!=="boolean"||!c.actions.some(a=>a.type==="failover"&&a.activatedStep===d.failover!.activatedStep)))return false;
 if(d.owned.includes("auto_failover")&&(!d.owned.includes("health_checks")||!d.owned.includes("standby")||!c.loadBalancer))return false;
 const inspectedAfterMetrics=c.trace.some(t=>t.type==="health-change-detected"&&t.data.source==="manual"&&t.step===c.step&&t.id>(c.trace.filter(x=>x.type==="metrics").at(-1)?.id??0));
 if(c.snapshot.version===6&&!inspectedAfterMetrics&&(JSON.stringify(c.snapshot.reliability?.effective)!==JSON.stringify(effectiveTargets(c))||JSON.stringify(c.snapshot.routing)!==JSON.stringify(c.routing)))return false;
 return true;
}
