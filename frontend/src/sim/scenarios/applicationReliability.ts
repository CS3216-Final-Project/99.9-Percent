export const APPLICATION_RELIABILITY = {
 id:"application-reliability",version:1, research:3, faultDelay:8, faultDuration:20,
 checksCostCents:50000, checksDelay:2, checksWeeklyCents:10000,
 failoverCostCents:100000, failoverDelay:2, failoverWeeklyCents:10000,
 spareCostCents:100000, spareDelay:2, restoreDelay:3, promotionDelay:1,
} as const;
