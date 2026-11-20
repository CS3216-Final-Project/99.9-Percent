import type { GameState } from "./types";

/** A launch is a commitment, not a promise of sufficient capacity. */
export function scalingLaunchBlocker(game: GameState): string | null {
  const c = game.campaign;
  if (!c?.scaling || c.scaling.version !== 2) return "This company uses scheduled growth.";
  if (c.scaling.consumed || c.scaling.dueStep !== null) return "The growth campaign has already launched.";
  if (game.phase !== "management" || c.incident) return "Recover and review the active incident before launching.";
  if (!c.openingMilestone?.acknowledged || c.reports.some(r => !c.trace.some(e => e.type === "review-acknowledged" && e.data.incidentId === r.id))) return "Review the company’s reports before launching.";
  if (c.cashCents <= 0) return "The company needs positive cash to launch.";
  if (c.dbBacklog || c.apps.some(a => a.backlog)) return "Drain the current queues before launching.";
  return null;
}
