/**
 * The company's service-level objective. Planned surges and failure drills each get a fixed error budget, a share of
 * the demand they schedule, because even a well-prepared company loses requests for one health-check interval when
 * an app fails. Normal operation is held to the full objective in Grow the Company's final week.
 */
export const ERROR_BUDGET = Object.freeze({
 objective: 0.9999,
 scenarioShareBasisPoints: 200,
 stableSteps: 5,
 finalWeekSteps: 60,
});
