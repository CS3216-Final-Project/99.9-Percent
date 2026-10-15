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
/** Installed recurring costs per complete operating period, including idle equipment. */
export function operatingCharges(c: Campaign) {
    return {
        app: c.apps.reduce((n,a)=>n+(a.tier==="large"?P.appWeeklyCents:Q.appWeeklyCents),0),
        db: c.dbCapacity===D.dbCapacity?D.dbWeeklyCents:c.dbCapacity >= P.dbCapacity ? P.dbWeeklyCents : c.upgraded ? Q.upgradedDbWeeklyCents : Q.dbWeeklyCents,
        salary: Q.engineers * Q.salaryWeeklyCents,
        lb: c.loadBalancer ? P.lbWeeklyCents : 0,
        cache: c.readCache ? D.cacheWeeklyCents : 0,
        controller: c.spikeStage?.controller ? T.controllerWeeklyCents : 0,
        checks: c.reliabilityStage?.checksStep != null ? R.checksWeeklyCents : 0,
        failover: c.reliabilityStage?.failover ? R.failoverWeeklyCents : 0,
    };
}
export function accruedCharges(c: Campaign) {
    const l = c.ledger;
    const numerator = { app:l.appNumerator, db:l.dbNumerator, salary:l.salaryNumerator, lb:l.lbNumerator??0, cache:l.cacheNumerator??0, controller:l.controllerNumerator??0, checks:c.reliabilityStage ? l.checksNumerator??0 : 0, failover:c.reliabilityStage ? l.failoverNumerator??0 : 0 };
    return Object.fromEntries(Object.entries(numerator).map(([key,n])=>[key,Math.floor((n+(c.remainders[key as keyof typeof c.remainders]??0))/Q.periodSteps)])) as ReturnType<typeof operatingCharges>;
}
export function accruePeriod(c: Campaign): void {
    const l = c.ledger, m = c.snapshot;
    const costs = operatingCharges(c);
    l.successes += m.successful;
    l.failures += m.failed;
    l.rejected += m.rejected;
    l.appNumerator += costs.app;
    l.dbNumerator += costs.db;
    l.lbNumerator = (l.lbNumerator ?? 0) + costs.lb;
    l.cacheNumerator=(l.cacheNumerator??0)+costs.cache;
    l.controllerNumerator=(l.controllerNumerator??0)+costs.controller;
    if(c.reliabilityStage){l.checksNumerator=(l.checksNumerator??0)+costs.checks;l.failoverNumerator=(l.failoverNumerator??0)+costs.failover;}
    l.salaryNumerator += costs.salary;
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
    const added = { ...(c.dataStage?{cacheCents}:{}), ...(c.spikeStage?{controllerCents}:{}), ...(c.reliabilityStage?{checksCents,failoverCents}:{}) };
    c.settlements.push({ period, step: c.step, revenueCents, appCents, dbCents, salaryCents,
        ...(c.foundation && c.step<=c.foundation.step ? {} : {lbCents}), ...added, netCents });
    trace(c, "settlement", { period, revenueCents, appCents, dbCents, salaryCents, lbCents, ...added, netCents });
    c.ledger = emptyLedger();
}
