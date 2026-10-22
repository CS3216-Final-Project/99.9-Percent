import type { GameState } from "@/sim";
import { canEnterCombined, currentFault, promotionActive } from "@/sim/combinedCampaign";
import { accruedCharges, operatingCharges } from "@/sim/settlement";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";
import { financeForecast, financeMoney, totalCharges } from "./campaignFinance";

/** Presentation only. A recent loss is a risk estimate, never proof of insolvency. */
export function chapter6FinancialRisk(game: GameState) {
  const c = game.campaign;
  if (!c || game.phase === "ended" || c.cashCents <= 0 || (!c.combinedStage && !canEnterCombined(game))) return null;
  const costs = operatingCharges(c), costsCents = totalCharges(costs);
  // Deliberately narrow proof: no cache, other equipment, pending improvement,
  // spare/routing option, or installed asset that can automatically retire.
  const app = c.apps[0], fault = currentFault(c);
  const originalSetup = c.apps.length === 1 && app.id === "app-1" && app.state === "active" && app.tier === "base" &&
    app.capacity === Q.appCapacity && app.health !== "failed" && app.role !== "spare" &&
    c.dbCapacity === Q.dbCapacity && !c.upgraded && !c.readCache && !c.loadBalancer && !c.spikeStage?.controller &&
    c.reliabilityStage?.checksStep == null && !c.reliabilityStage?.failover && !c.pending.length &&
    !promotionActive(c) && (!c.promotion || c.step >= c.promotion.endStep) &&
    (!fault || fault.restoredStep !== null) && (!c.foundation || c.step >= c.foundation.step);
  if (originalSetup) {
    // Without a cache, even unhealthy maximum-throughput play cannot earn more
    // than the DB's processing budget. Count already earned money, and safely
    // underestimate rounding of remaining costs, so a viable receipt is never ignored.
    const maximumRevenueCents = c.dbCapacity * Q.periodSteps * Q.revenueCents;
    const remaining = Q.periodSteps - c.step % Q.periodSteps;
    const nextCostsLowerBound = totalCharges(accruedCharges(c)) + Object.values(costs).reduce((sum, cost) => sum + Math.floor(cost * remaining / Q.periodSteps), 0);
    const nextCashUpperBound = c.cashCents + c.ledger.successes * Q.revenueCents + c.dbCapacity * remaining * Q.revenueCents - nextCostsLowerBound;
    // Every throughput-improving purchase costs at least a base server. Health
    // checks/promotions cannot raise this bound, and there is no manual sale/refund.
    if (maximumRevenueCents < costsCents && Math.max(c.cashCents, nextCashUpperBound) <= Q.appCostCents) {
      return { kind: "blocked" as const, costsCents, maximumRevenueCents,
        message: `This setup can earn at most ${financeMoney(maximumRevenueCents)} per period but costs ${financeMoney(costsCents)}. With ${financeMoney(c.cashCents)}, even the next cash update cannot fund a capacity improvement. Review finances; you can export this company before starting again.` };
    }
  }
  const limitedRevenueCents = c.limit === null ? null : c.limit * Q.periodSteps * Q.revenueCents;
  if (limitedRevenueCents !== null && c.cashCents <= costsCents && limitedRevenueCents < costsCents)
    return { kind: "risk" as const, costsCents, maximumRevenueCents: null,
      message: `At the current traffic limit, ongoing earnings are capped at ${financeMoney(limitedRevenueCents)} per period, below ${financeMoney(costsCents)} running costs. Check capacity and finances before keeping or lifting the limit. Pending changes and earned money may help; this does not mean recovery is impossible.` };
  const forecast = financeForecast(c);
  if (!forecast || forecast.burnCents <= 0) return null;
  return { kind: "risk" as const, costsCents, maximumRevenueCents: null,
    message: `Recent earnings of ${financeMoney(forecast.revenueCents)} are below current running costs of ${financeMoney(costsCents)} per period. ${c.limit !== null ? "Rejected requests earn nothing; prepare capacity before lifting the limit." : "Review served requests and running costs before spending more."} This estimate can change; it does not mean recovery is impossible.` };
}
