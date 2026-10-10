/** Immutable tuning: saved runs resolve this exact scenario version. Money is cents. */
export const OPENING_DB = {
    id: "opening-db", version: 1, stepSeconds: 1, periodSteps: 60,
    startingTraffic: 300, growthStep: 4, grownTraffic: 800,
    appCapacity: 1000, appBacklogLimit: 1000, dbCapacity: 600, dbBacklogLimit: 600,
    upgradedDbCapacity: 1000, baseLatencyMs: 100,
    startingCashCents: 2000000, users: 2000, engineers: 4,
    appCostCents: 100000, appDelay: 2, maxApps: 2,
    dbCostCents: 300000, dbDelay: 3, admissionDelay: 1, admissionLimit: 500,
    appWeeklyCents: 70000, dbWeeklyCents: 50000, upgradedDbWeeklyCents: 150000,
    salaryWeeklyCents: 160000, revenueCents: 20,
    overloadSteps: 3, stableSteps: 5, latencyThresholdMs: 500, errorThreshold: 0.01,
} as const;
