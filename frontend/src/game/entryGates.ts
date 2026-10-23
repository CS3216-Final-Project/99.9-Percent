import type { combinedEntryGates } from "@/sim/combinedCampaign";
import type { reliabilityEntryGates } from "@/sim/reliability";

type Gate = keyof ReturnType<typeof reliabilityEntryGates> | keyof ReturnType<typeof combinedEntryGates>;

/** A chapter entry gate as the player sees it, worded like the chapter requirements. */
const GATE_LABELS: Record<Gate, string> = {
  management: "No report is waiting to be read",
  cash: "Company cash is positive",
  incident: "No incident is open",
  pending: "Queued changes have finished",
  queues: "Application and Database queues are empty",
  apps: "Every application server is up",
  reports: "Every incident report has been read",
  healthy: "Requests are fast and error-free",
  baseline: "Traffic is back to normal (2,400 req/s)",
};

/**
 * Why a chapter entry is refused: the labels of its unmet gates in a stable order, or, when only a progression step
 * such as the current chapter's own completion is missing, that. Empty when the entry is `ready`.
 */
export function entryBlockers(ready: boolean, gates: Partial<Record<Gate, boolean>>): string[] {
  if (ready) return [];
  const unmet = (Object.keys(GATE_LABELS) as Gate[]).filter(id => gates[id] === false).map(id => GATE_LABELS[id]);
  return unmet.length ? unmet : ["Every chapter requirement is met"];
}

/** One sentence naming what a chapter still waits for, for notes and disabled controls. */
export const waitsFor = (chapter: string, unmet: string[]) => `${chapter} opens once: ${unmet.join("; ")}.`;
