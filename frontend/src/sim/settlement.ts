import type { Campaign, Ledger } from "./campaignTypes";
import { OPENING_DB as Q } from "./scenarios/openingDatabaseIncident";
import { APPLICATION_SCALING as P } from "./scenarios/applicationScaling";
import { DATA_STRATEGY as D } from "./scenarios/dataStrategy";
import { TRAFFIC_SPIKES as T } from "./scenarios/trafficSpikes";
import { APPLICATION_RELIABILITY as R } from "./scenarios/applicationReliability";
import { trace } from "./trace";
export function emptyLedger(): Ledger {
    return { successes: 0, failures: 0, rejected: 0, appNumerator: 0, dbNumerator: 0, salaryNumerator: 0, lbNumerator: 0, cacheNumerator: 0, controllerNumerator:0 };
}
export function accruePeriod(c: Campaign): void {
    const l = c.ledger, m = c.snapshot;
    l.successes += m.successful;
    l.failures += m.failed;
    l.rejected += m.rejected;
    l.appNumerator += c.apps.reduce((n,a)=>n+(a.tier==="large"?P.appWeeklyCents:Q.appWeeklyCents),0);
    l.dbNumerator += c.dbCapacity===D.dbCapacity?D.dbWeeklyCents:c.dbCapacity >= P.dbCapacity ? P.dbWeeklyCents : c.upgraded ? Q.upgradedDbWeeklyCents : Q.dbWeeklyCents;
    l.lbNumerator = (l.lbNumerator ?? 0) + (c.loadBalancer ? P.lbWeeklyCents : 0);
    l.cacheNumerator=(l.cacheNumerator??0)+(c.readCache?D.cacheWeeklyCents:0);
    l.controllerNumerator=(l.controllerNumerator??0)+(c.spikeStage?.controller?T.controllerWeeklyCents:0);
    if(c.reliabilityStage){l.checksNumerator=(l.checksNumerator??0)+(c.reliabilityStage.checksStep!==null?R.checksWeeklyCents:0);l.failoverNumerator=(l.failoverNumerator??0)+(c.reliabilityStage.failover?R.failoverWeeklyCents:0);}
    l.salaryNumerator += Q.engineers * Q.salaryWeeklyCents;
}
export function settlePeriod(c: Campaign): void {
    if (c.step === 0 || c.step % Q.periodSteps !== 0)
        return;
    const period = c.step / Q.periodSteps;
    if (period <= c.lastSettledPeriod)
        return;
    const charge = (key: keyof Campaign["remainders"], numerator: number) => {
        const total = numerator + (c.remainders[key] ?? 0);
        c.remainders[key] = total % Q.periodSteps;
        return Math.floor(total / Q.periodSteps);
    };
    const appCents = charge("app", c.ledger.appNumerator);
    const dbCents = charge("db", c.ledger.dbNumerator);
    const salaryCents = charge("salary", c.ledger.salaryNumerator);
    const lbCents = charge("lb", c.ledger.lbNumerator ?? 0);
    const cacheCents=charge("cache",c.ledger.cacheNumerator??0);
    const controllerCents=charge("controller",c.ledger.controllerNumerator??0);
    const checksCents=c.reliabilityStage?charge("checks",c.ledger.checksNumerator??0):0,failoverCents=c.reliabilityStage?charge("failover",c.ledger.failoverNumerator??0):0;
    const revenueCents = c.ledger.successes * Q.revenueCents;
    const netCents = revenueCents - appCents - dbCents - salaryCents - lbCents - cacheCents - controllerCents - checksCents - failoverCents;
    c.cashCents += netCents;
    c.revenueCents += revenueCents;
    c.costsCents += appCents + dbCents + salaryCents + lbCents + cacheCents + controllerCents + checksCents + failoverCents;
    c.lastSettledPeriod = period;
    c.settlements.push({ period, step: c.step, revenueCents, appCents, dbCents, salaryCents, lbCents, cacheCents, controllerCents, ...(c.reliabilityStage?{checksCents,failoverCents}:{}), netCents });
    trace(c, "settlement", { period, revenueCents, appCents, dbCents, salaryCents, lbCents, cacheCents, controllerCents, ...(c.reliabilityStage?{checksCents,failoverCents}:{}), netCents });
    c.ledger = emptyLedger();
}
