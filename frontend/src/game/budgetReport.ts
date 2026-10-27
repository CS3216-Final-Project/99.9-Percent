import type { Campaign, ErrorBudget } from "@/sim/campaignTypes";
import { budgetUsed, BUDGET_NAMES } from "@/sim/errorBudget";
import { ERROR_BUDGET as B } from "@/sim/scenarios/errorBudget";
import type { ReportLesson } from "./campaignReport";
import { num } from "./format";

const SHARE = `${B.scenarioShareBasisPoints / 100}%`;
/** "Traffic Spikes", or "Growth wave 2", for the scenario a budget judges. */
export function budgetName(c: Campaign, b: ErrorBudget): string {
  const index = c.combinedStage?.currentRound?.budget === b ? c.combinedStage.currentRound.index : null;
  return b.scenario === "growth" && index !== null ? `Growth wave ${index + 1}` : BUDGET_NAMES[b.scenario];
}
/** The live budget of the scenario now running, if one is. */
export function activeBudget(c: Campaign): ErrorBudget | null {
  if (c.combinedStage) return c.combinedStage.currentRound?.budget ?? null;
  if (c.reliabilityStage) return c.reliabilityStage.fault ? c.reliabilityStage.budget ?? null : null;
  return c.spikeStage?.budget ?? null;
}
/** One checklist row: how much of the running scenario's budget is spent, or when the next one starts. */
export function budgetRequirement(c: Campaign): { label: string; met: boolean } {
  const b = activeBudget(c);
  if (!b) return { label: c.combinedStage ? "Error budget: set when the next growth wave starts" : "Error budget: set when the reliability test starts", met: true };
  const used = budgetUsed(c, b);
  return { label: `Error budget: ${num(used)} / ${num(b.allowance)} requests lost`, met: used <= b.allowance };
}

/** What the recorded company had during the scenario, never later state. */
function response(c: Campaign, b: ErrorBudget): string {
  const during = c.recent.filter(m => m.step > b.fromStep && (!b.judged || m.step <= b.judged.step));
  const peak = Math.max(0, ...during.map(m => m.incoming));
  const lowest = Math.min(...during.filter(m => m.incoming === peak).map(m => m.effectiveAppCapacity ?? m.app.capacity));
  const capacity = Number.isFinite(lowest) ? ` At the ${num(peak)} requests/s peak, healthy routed application capacity fell as low as ${num(lowest)} requests/s.` : "";
  const turned = during.reduce((n, m) => n + m.rejected, 0);
  const limit = turned ? ` A traffic limit turned away ${num(turned)} of the lost requests.` : "";
  if (b.scenario === "spikes") return (c.spikeStage?.controller ? "The autoscaler reacted, but it needs about seven game seconds to decide, install and route a new app, and an incident opens after three overloaded ones." : "No automation added capacity during the pulses.") + capacity + limit;
  if (b.scenario === "reliability") return (c.reliabilityStage?.checksStep != null ? "Health Checks took the failed app out of routing, but the remaining capacity still lost requests." : "Without Health Checks, traffic kept reaching the failed app until it was restored.") + capacity + limit;
  return "Requests were lost to an overloaded component, to overflowing queues or to a failed app that still received traffic." + capacity + limit;
}
const IMPROVE: Record<ErrorBudget["scenario"], string> = {
  spikes: "Before the first pulse, make sure routed capacity can serve 4,000 requests/s, by adding or scaling apps yourself or by tuning automation to act sooner.",
  reliability: "Deploy Health Checks so a failed app leaves routing, and keep enough surviving capacity, for example a reserved spare with Automatic Failover.",
  growth: "Before the wave starts, compare its peak with healthy routed capacity and database headroom, and plan for losing one app.",
};
/** The four report sections for a scenario that went over its error budget. */
export function budgetLesson(c: Campaign, b: ErrorBudget): ReportLesson {
  const lost = budgetUsed(c, b);
  return {
    happened: `${budgetName(c, b)} lost ${num(lost)} requests. Its error budget was ${num(b.allowance)}: ${SHARE} of the ${num(b.scheduledDemand)} requests it scheduled.`,
    response: response(c, b),
    improve: IMPROVE[b.scenario],
    takeaway: "An error budget is how much failure a service objective can afford. Retry the scenario with the same company once you have changed what lost the requests.",
  };
}
