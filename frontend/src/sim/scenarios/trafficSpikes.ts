/** Versioned Phase 5 values; earlier scenarios remain unchanged. */
export const TRAFFIC_SPIKES = Object.freeze({
 id:"traffic-spikes" as const, version:1 as const, baseline:2400, peak:4000,
 offsets:[8,28,48,68] as readonly number[], high:8000, highSteps:3, low:6000, lowSteps:6,
 minimum:2, maximum:4, provisionDelay:3, routingDelay:1, cooldown:4,
 controllerCostCents:100000, controllerDelay:2, controllerWeeklyCents:10000,
 targets:[5000,6000,7000,8000] as readonly number[], minimums:[2,3,4] as readonly number[], scaleInGap:2000,
});
