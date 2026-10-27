import type { Campaign } from "@/sim/campaignTypes";
import { requestUptime } from "@/sim/errorBudget";

/**
 * The headline uptime: the share of settled requests the company served. A request counts only once its outcome
 * is decided - served, lost or turned away - so work still waiting in a queue never drags the figure down before
 * it has actually been lost. Uptime therefore falls only on real losses, and more slowly than during a backlog.
 * Null before the first settled request.
 */
export function campaignUptime(c: Campaign): number | null {
  const { rejected, successful, failed } = c.cumulative;
  return requestUptime(successful, failed, rejected);
}
