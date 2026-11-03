import type { Campaign } from "@/sim/campaignTypes";
import { OPENING_DB } from "@/sim/scenarios/openingDatabaseIncident";

/** Steps the In gate keeps its callout after the growth arrives, so the jump is read before it goes. */
const LINGER_STEPS = 4;

/**
 * The Opening's first seconds: customer demand is about to grow, so the In gate, where requests enter the building,
 * says so from the first Run until the growth has arrived and been seen. Only a company that came through the
 * introduction gets it; scripted Launch Week companies and practice keep the guidance they had.
 */
export type OpeningTrafficCue = "rising" | "risen";

export function openingTrafficCue(c: Campaign | null | undefined): OpeningTrafficCue | null {
  if (!c || c.launchWeek || !c.completedIntroduction || c.step < 1 || c.step >= OPENING_DB.growthStep + LINGER_STEPS) return null;
  return c.step < OPENING_DB.growthStep ? "rising" : "risen";
}

/** What the In gate says while the cue lasts. */
export const OPENING_TRAFFIC_NOTE: Record<OpeningTrafficCue, string> = {
  rising: "More customers are arriving. Requests are about to climb.",
  risen: "Requests climbed. Watch where the extra work goes.",
};

/** Whether this update is the company's first second of time, the moment its first Run takes effect. */
export function startsOpeningTraffic(prev: Campaign | null | undefined, next: Campaign | null | undefined): boolean {
  return prev?.step === 0 && prev.runId === next?.runId && !!openingTrafficCue(next);
}
