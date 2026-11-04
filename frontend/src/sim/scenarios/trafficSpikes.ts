/** Versioned Phase 5 values; earlier scenarios remain unchanged. */
export const TRAFFIC_SPIKES = Object.freeze({
 id:"traffic-spikes" as const, version:1 as const, baseline:2400, peak:4000,
 offsets:[8,28,48,68] as readonly number[], high:8000, highSteps:3, low:6000, lowSteps:6,
 minimum:2, maximum:4, provisionDelay:3, routingDelay:1, cooldown:4,
 controllerCostCents:100000, controllerDelay:2, controllerWeeklyCents:10000,
});
/**
 * Version 2 grades the chapter: the first spike is practice, and the second and every retry must serve
 * `passBasisPoints` of incoming requests. A failed test schedules another spike after a calm interval.
 * The peak suits the company's workload: 3,400 req/s write-heavy traffic still fits the largest database
 * with a warm cache, so every company can pass, while 4,000 req/s would never fit.
 */
export const GRADED_SPIKES = Object.freeze({
 version:2 as const, pulseSteps:20, retryGapSteps:20, passBasisPoints:9500,
 peaks:Object.freeze({"read-heavy":4000,"write-heavy":3400}),
});
