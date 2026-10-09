import type { Campaign, Ledger } from "./campaignTypes";
import { OPENING_DB as Q } from "./scenarios/openingDatabaseIncident";
import { trace } from "./trace";
export function emptyLedger(): Ledger {
    return { successes: 0, failures: 0, rejected: 0, appNumerator: 0, dbNumerator: 0, salaryNumerator: 0 };
}
export function accruePeriod(c: Campaign): void {
    const l = c.ledger, m = c.snapshot;
    l.successes += m.successful;
    l.failures += m.failed;
    l.rejected += m.rejected;
    l.appNumerator += c.apps.length * Q.appWeeklyCents;
    l.dbNumerator += c.upgraded ? Q.upgradedDbWeeklyCents : Q.dbWeeklyCents;
    l.salaryNumerator += Q.engineers * Q.salaryWeeklyCents;
}
export function settlePeriod(c: Campaign): void {
    if (c.step === 0 || c.step % Q.periodSteps !== 0)
        return;
    const period = c.step / Q.periodSteps;
    if (period <= c.lastSettledPeriod)
        return;
    const charge = (key: keyof Campaign["remainders"], numerator: number) => {
        const total = numerator + c.remainders[key];
        c.remainders[key] = total % Q.periodSteps;
        return Math.floor(total / Q.periodSteps);
    };
    const appCents = charge("app", c.ledger.appNumerator);
    const dbCents = charge("db", c.ledger.dbNumerator);
    const salaryCents = charge("salary", c.ledger.salaryNumerator);
    const revenueCents = c.ledger.successes * Q.revenueCents;
    const netCents = revenueCents - appCents - dbCents - salaryCents;
    c.cashCents += netCents;
    c.revenueCents += revenueCents;
    c.costsCents += appCents + dbCents + salaryCents;
    c.lastSettledPeriod = period;
    c.settlements.push({ period, step: c.step, revenueCents, appCents, dbCents, salaryCents, netCents });
    trace(c, "settlement", { period, revenueCents, appCents, dbCents, salaryCents, netCents });
    c.ledger = emptyLedger();
}
