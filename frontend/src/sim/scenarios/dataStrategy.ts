/** Versioned local continuation; never retunes preceding scenarios. */
export const DATA_STRATEGY = Object.freeze({
 id: "data-strategy" as const, version: 1 as const, traffic: 2400, observationSteps: 3,
 dbCapacity: 3000, dbCostCents: 400000, dbDelay: 4, dbWeeklyCents: 350000,
 cacheCostCents: 150000, cacheDelay: 2, cacheWeeklyCents: 40000,
 tuningCostCents: 100000, tuningDelay: 2, baseTarget: 6000, tunedTarget: 7500, warmIncrement: 1200,
});
export const DATA_PROFILES = Object.freeze({
 "read-heavy": Object.freeze({readShare:8000,cacheableReadShare:10000}),
 "write-heavy": Object.freeze({readShare:2000,cacheableReadShare:10000}),
});
export type DataProfile = keyof typeof DATA_PROFILES;
