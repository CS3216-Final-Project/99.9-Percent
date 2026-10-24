import type { combinedEntryGates } from "@/sim/combinedCampaign";
import type { reliabilityEntryGates } from "@/sim/reliability";

type Gate = keyof ReturnType<typeof reliabilityEntryGates> | keyof ReturnType<typeof combinedEntryGates>;

/** A chapter entry gate as the player sees it: a clause that completes "<chapter> opens once ...". */
const GATE_LABELS: Record<Gate, string> = {
  management: "normal operations have resumed",
  cash: "company cash is positive",
  incident: "no incident is open",
  pending: "queued changes have finished",
  queues: "the Application and Database queues are empty",
  apps: "every application server is up",
  reports: "every incident report has been read",
  healthy: "requests are fast and error-free",
  baseline: "traffic is back to normal (2,400 req/s)",
};

/**
 * Why a chapter entry is refused: the labels of its unmet gates in a stable order, or, when only a progression step
 * is missing, that the `previous` chapter is finished. Empty when the entry is `ready`.
 */
export function entryBlockers(ready: boolean, gates: Partial<Record<Gate, boolean>>, previous: string): string[] {
  if (ready) return [];
  const unmet = (Object.keys(GATE_LABELS) as Gate[]).filter(id => gates[id] === false).map(id => GATE_LABELS[id]);
  return unmet.length ? unmet : [`${previous} is finished`];
}

/** One sentence naming what a chapter still waits for, for notes and disabled controls. */
export const waitsFor = (chapter: string, unmet: string[]) =>
  `${chapter} opens once ${unmet.length > 1 ? `${unmet.slice(0, -1).join(", ")} and ${unmet.at(-1)}` : unmet[0]}.`;
