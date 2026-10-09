import { emptyMeasurement, measurementValid, type Measurement } from "./telemetry";
import type { GameState } from "@/sim";
import { newGame } from "@/sim";
import { routingValid } from "@/sim/step";
export const CAMPAIGN_SAVE_KEY = "nn.campaign.save.v1";
export interface SaveEnvelope {
    schemaVersion: 3;
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
    if (!m || !m.app || !m.db)
        return false;
    if(m.version===3) {
        const xs=m.instances;
        if(!xs?.length || xs.length>2 || new Set(xs.map(x=>x.id)).size!==xs.length || !m.routing ||
            !["single","balanced"].includes(m.routing.mode) || !m.routing.targets.length || new Set(m.routing.targets).size!==m.routing.targets.length ||
            m.routing.targets.some(id=>!xs.some(x=>x.id===id)) || (m.routing.mode==="single"&&(m.routing.targets.length!==1||m.routing.targets[0]!=="app-1")))return false;
        const sum=(k:"demand"|"processed"|"backlog"|"failed"|"capacity")=>xs.reduce((n,x)=>n+x[k],0);
        const routed=xs.filter(x=>x.routed).reduce((n,x)=>n+x.capacity,0);
        if(!xs.every(x=>/^app-[12]$/.test(x.id)&&x.state==="active"&&["base","large"].includes(x.tier)&&
            x.capacity===(x.tier==="base"?1000:1600)&&x.routed===m.routing!.targets.includes(x.id)&&
            [x.demand,x.processed,x.backlog,x.failed].every(integer)&&x.processed<=x.capacity&&x.backlog<=1000&&
            x.demandRate===x.demand&&x.demandCount===x.demand&&x.processingBudget===x.capacity&&
            x.busyUtilisation===x.processed/x.capacity&&x.demandRatio===x.demand/x.capacity&&(!x.routed?x.demand===0:true)))return false;
        const d=m.db;
        return integer(m.step)&&[m.incoming,m.admitted,m.rejected,m.successful,m.failed].every(integer)&&m.incoming===m.admitted+m.rejected&&
            sum("demand")===m.admitted&&m.installedAppCapacity===sum("capacity")&&m.effectiveAppCapacity===routed&&m.app.capacity===routed&&
            m.app.demand===m.admitted&&m.app.processed===sum("processed")&&m.app.backlog===sum("backlog")&&m.app.failed===sum("failed")&&
            integer(m.appBusyBudget!)&&m.appBusyBudget!>=routed&&m.appBusyBudget!<=sum("capacity")&&
            m.app.busyUtilisation===m.app.processed/m.appBusyBudget!&&m.app.busyUtilisation<=1&&m.app.demandRatio===m.admitted/routed&&
            [d.demand,d.capacity,d.processed,d.backlog,d.failed].every(integer)&&[600,1000,2000].includes(d.capacity)&&d.processed<=d.capacity&&d.backlog<=600&&
            d.busyUtilisation===d.processed/d.capacity&&d.demandRatio===d.demand/d.capacity&&d.demand===sum("processed")&&m.successful===d.processed&&m.failed===sum("failed")+d.failed&&
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
const integer = (n: number) => Number.isSafeInteger(n) && n >= 0;
function validateVersion(value: unknown, version: 2 | 3): Validation {
    try {
        if (!value || typeof value !== "object")
            return { status: "corrupt" };
        const e = value as SaveEnvelope;
        if (Number(e.schemaVersion) !== version || e.scenarioId !== "opening-db" || e.scenarioVersion !== 1)
            return { status: "unsupported" };
        const s = e.game, c = s.campaign!;
        const milestone=c?.openingMilestone;
        if(milestone===undefined || (milestone!==null&&(!c.openingRecovered||milestone.id!=="opening-stability"||
          milestone.incidentId!==c.reports[0]?.id||!integer(milestone.awardedStep)||
          milestone.awardedStep<c.reports[0].recoveredStep||milestone.awardedStep>c.step||
          typeof milestone.acknowledged!=="boolean")) || !measurementValid(e.runtime?.measurement) ||
          e.runtime.measurement.cursor>c.trace.length || e.runtime.measurement.pending.some(x=>x.runId!==c.runId))
          return {status:"corrupt"};
        const template = newGame();
        if(version===2) {
            const old=template.campaign! as unknown as Record<string,unknown>;
            for(const key of ["routing","loadBalancer","routingEnabledOnce","scaling","overload"])delete old[key];
            delete (old.remainders as Record<string,unknown>).lb;
            delete (old.ledger as Record<string,unknown>).lbNumerator;
        }
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
            !snapshotValid(c.snapshot) || c.snapshot.step !== c.step || !(version===3?[600,1000,2000]:[600,1000]).includes(c.dbCapacity) ||
            !integer(c.dbBacklog) || c.dbBacklog > 600 || ![null, 500].includes(c.limit) ||
            c.apps.length < 1 || c.apps.length > 2 ||
            c.apps.some((a, i) => a.id !== `app-${i + 1}` || (version===2?(a.capacity!==1000||a.routed!==(i===0)):(a.state!=="active"||!["base","large"].includes(a.tier)||a.capacity!==(a.tier==="base"?1000:1600)||a.routed!==c.routing.targets.includes(a.id))) || !integer(a.backlog) || a.backlog > 1000) ||
            (s.phase !== "ended" && (s.phase === "incident") !== !!c.incident) ||
            (c.incident && (!integer(c.incident.stableSteps) || c.incident.stableSteps >= 5 || (!Array.isArray(c.incident.snapshots) || !c.incident.snapshots.every(snapshotValid)))) ||
            !Object.values(c.remainders).every(v => integer(v) && v < 60) ||
            !Object.values(c.ledger).every(integer) ||
            !Object.values(c.cumulative).every(integer) ||
            c.cumulative.admitted !== c.cumulative.successful + c.cumulative.failed + c.apps.reduce((n, a) => n + a.backlog, 0) + c.dbBacklog ||
            !(version===3?[300,800,1400]:[300,800]).includes(c.incomingRate) || c.upgraded !== (c.dbCapacity >= 1000) ||
            c.snapshot.db.backlog !== c.dbBacklog || c.snapshot.app.backlog !== c.apps.reduce((n,a)=>n+a.backlog,0) ||
            c.snapshot.db.capacity !== c.dbCapacity || c.snapshot.installedAppCapacity !== c.apps.reduce((n,a)=>n+a.capacity,0) ||
            (c.step >= 4) !== c.consumedEvents.includes("opening-growth") ||
            c.actions.some(a => typeof a.id !== "string" || !(version===3?["add-app","upgrade-db","limit","unlimit","scale-up","deploy-lb","routing"]:["add-app", "upgrade-db", "limit", "unlimit"]).includes(a.type) || !integer(a.requestedStep) || a.requestedStep > c.step || !integer(a.activationStep) || a.activationStep <= a.requestedStep || !integer(a.costCents) || (a.activatedStep !== null && (!integer(a.activatedStep) || a.activatedStep !== a.activationStep || a.activatedStep > c.step))) ||
            c.settlements.length !== c.lastSettledPeriod ||
            !c.settlements.every((p, i) => p.period === i + 1 && p.step === (i + 1) * 60 && [p.revenueCents, p.appCents, p.dbCents, p.salaryCents,p.lbCents??0].every(integer) && p.netCents === p.revenueCents - p.appCents - p.dbCents - p.salaryCents - (p.lbCents??0)) ||
            c.pending.some(a => !c.actions.some(b=>JSON.stringify(a)===JSON.stringify(b)) || !integer(a.activationStep) || a.activationStep <= c.step || !integer(a.requestedStep) || a.requestedStep > c.step || !integer(a.costCents) || a.activatedStep !== null) ||
            new Set(c.pending.map(a => a.id)).size !== c.pending.length ||
            c.pending.some(a => !c.actions.some(b => b.id === a.id && b.activationStep === a.activationStep)) ||
            !c.trace.every((t, i) => t.id === i + 1 && integer(t.step) && t.step <= c.step && typeof t.type === "string" && !!t.data) || c.nextEventId !== c.trace.length + 1 ||
            !c.recent.every(snapshotValid) ||
            !c.reports.every(p => integer(p.openedStep) && integer(p.recoveredStep) && p.openedStep <= p.recoveredStep && p.recoveredStep <= c.step &&
            integer(p.setupCents) && typeof p.limited === "boolean" && typeof p.id === "string" && Array.isArray(p.snapshots) && p.snapshots.length > 0 && Array.isArray(p.events) && Array.isArray(p.explanations) && p.snapshots.every(snapshotValid) && p.explanations.every(t => typeof t === "string")))
            return { status: "corrupt" };
        if(version===3) {
            if(c.actions.some(a=>{
                const delay=a.type==="add-app"||a.type==="deploy-lb"?2:a.type==="upgrade-db"||a.type==="scale-up"?3:1;
                const cost=a.type==="add-app"||a.type==="deploy-lb"?100000:a.type==="upgrade-db"?300000:a.type==="scale-up"?200000:0;
                return a.activationStep!==a.requestedStep+delay || a.costCents!==cost ||
                    (a.type==="add-app"&&a.targetId!=="app-2") ||
                    (a.type==="upgrade-db"&&![1000,2000].includes(a.capacityAfter!)) ||
                    ((["scale-up","deploy-lb","routing"].includes(a.type)||a.capacityAfter===2000)&&!c.openingMilestone?.acknowledged);
            }) || c.pending.filter(a=>["add-app","upgrade-db","scale-up","deploy-lb"].includes(a.type)).length>1 ||
                c.pending.filter(a=>a.type==="routing").length>1 || c.pending.filter(a=>a.type==="limit"||a.type==="unlimit").length>1 ||
                (c.dbCapacity===2000&&!c.openingMilestone?.acknowledged))return {status:"corrupt"};
            if(!routingValid(c,c.routing)||typeof c.loadBalancer!=="boolean"||typeof c.routingEnabledOnce!=="boolean"||
                !c.overload||Object.keys(c.overload).some(id=>id!=="db"&&!c.apps.some(a=>a.id===id))||!["db",...c.apps.map(a=>a.id)].every(id=>integer(c.overload[id]))||c.overload.db!==c.overloadSteps||
                !integer(c.ledger.lbNumerator!)||!integer(c.remainders.lb!)||
                (c.scaling!==null&&(!c.openingMilestone?.acknowledged||c.scaling.id!=="application-scaling"||c.scaling.version!==1||!integer(c.scaling.enteredStep)||c.scaling.enteredStep>c.step||
                (c.scaling.dueStep!==null&&(!integer(c.scaling.dueStep)||c.scaling.dueStep<=c.scaling.enteredStep))||typeof c.scaling.consumed!=="boolean"||c.scaling.consumed!==c.consumedEvents.includes("scaling-growth")))||
                (!c.scaling&&c.consumedEvents.includes("scaling-growth"))||
                (c.snapshot.version===3&&(!c.snapshot.instances!.every(x=>c.apps.some(a=>a.id===x.id&&a.capacity===x.capacity&&a.backlog===x.backlog&&a.routed===x.routed))||JSON.stringify(c.snapshot.routing)!==JSON.stringify(c.routing)))||
                c.actions.some(a=>(a.type==="scale-up"&&(!c.apps.some(x=>x.id===a.targetId)||a.capacityAfter!==1600))||(a.type==="routing"&&(!a.routing||!routingValid(c,a.routing)))))return {status:"corrupt"};
        }
        return { status: "ok", envelope: e };
    }
    catch {
        return { status: "corrupt" };
    }
}
export function validateEnvelope(value: unknown): Validation { return validateVersion(value,3); }
export function decodeSave(raw: string): Validation {
    try {
        return validateEnvelope(JSON.parse(raw));
    }
    catch {
        return { status: "corrupt" };
    }
}
export function makeEnvelope(game: GameState, remainderMs = 0, savedAt = Date.now(), measurement: Measurement = emptyMeasurement()): SaveEnvelope {
    return { schemaVersion: 3, scenarioId: "opening-db", scenarioVersion: 1, runId: game.campaign!.runId, game, runtime: { remainderMs, measurement }, savedAt };
}
/** Future migrations must preserve source bytes before replacing a validated slot. No v0 conversion is registered. */
export type MigrationRegistry = Readonly<Record<number, (value: unknown) => unknown>>;
export function migrateSave(storage: Pick<Storage, "getItem" | "setItem">, migrations: MigrationRegistry = PHASE3_MIGRATIONS): boolean {
    try {
        const original = storage.getItem(CAMPAIGN_SAVE_KEY);
        if (original === null)
            return false;
        let value = JSON.parse(original) as {
            schemaVersion?: number;
        };
        const sourceVersion = value.schemaVersion;
        if (typeof sourceVersion !== "number" || sourceVersion >= 3 || !migrations[sourceVersion])
            return false;
        const backup = `${CAMPAIGN_SAVE_KEY}.backup.v${sourceVersion}`;
        if (storage.getItem(backup) !== null && storage.getItem(backup) !== original)
            return false;
        storage.setItem(backup, original);
        while (typeof value.schemaVersion === "number" && value.schemaVersion < 3) {
            const version = value.schemaVersion, migrate = migrations[version];
            if (!migrate)
                return false;
            value = migrate(value) as {
                schemaVersion?: number;
            };
            if (!value || (value.schemaVersion !== version + 1 && value.schemaVersion !== 3))
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
    e.schemaVersion=3;return e;
}};
