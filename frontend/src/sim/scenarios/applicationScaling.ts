/** Immutable continuation tuning; opening-db v1 remains the company's origin. */
export const APPLICATION_SCALING = Object.freeze({
  id: "application-scaling" as const, version: 1 as const,
  traffic: 1400, observationSteps: 3, dbCapacity: 2000,
  dbCostCents: 300000, dbDelay: 3, dbWeeklyCents: 250000,
  appCapacity: 1600, appCostCents: 200000, appDelay: 3, appWeeklyCents: 110000,
  lbCostCents: 100000, lbDelay: 2, lbWeeklyCents: 30000, routingDelay: 1,
});
