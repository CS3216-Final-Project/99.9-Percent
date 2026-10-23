/** Immutable Launch Week tuning; opening-db version 2. Saved runs resolve this exact scenario. */
export const LAUNCH_WEEK = Object.freeze({
    id: "launch-week" as const, version: 1 as const, stepSeconds: 1, periodSteps: 60, weeks: 1,
    // One week: launch traffic outgrows the small database while the one app server keeps room.
    startingTraffic: 300, spikeStep: 4, spikeTraffic: 450,
    appCapacity: 500, appBacklogLimit: 1000, appCostCents: 100000, appDelay: 2, maxApps: 2, appWeeklyCents: 70000,
    // The database upgrade is the week's one fix; it unlocks when the traffic arrives.
    dbCapacity: 400, dbBacklogLimit: 900, upgradedDbCapacity: 2600, grownDbWork: 100,
    dbCostCents: 300000, dbDelay: 3, dbWeeklyCents: 50000, upgradedDbWeeklyCents: 150000,
    growthStep: 4, grownTraffic: 450,
    lbCostCents: 100000, lbDelay: 2, lbWeeklyCents: 30000, routingDelay: 1,
    // The research pick deploys at once and is billed in the next Sunday settlement.
    researchStep: 30, researchCostCents: 200000,
    // Week 3: a scripted promotion multiplies demand while it runs; the pick is what absorbs it.
    surgeStep: 100000, surgeFactor: 5, surgeSteps: 40, endStep: 60,
    cacheHitShare: 4000, autoscalerCapacity: 1500,
    startingCashCents: 1500000, users: 2000, engineers: 4, salaryWeeklyCents: 160000,
    revenueCents: 20, admissionLimit: 500, admissionDelay: 1, baseLatencyMs: 100,
});
