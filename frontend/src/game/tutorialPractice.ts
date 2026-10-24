import type { GameState } from "@/sim";
import { decodeSave, makeEnvelope } from "./saveEnvelope";
import type { Measurement } from "./telemetry";
import { WALKTHROUGH_VERSION } from "./persist";

const KEY = "nn.campaign.tutorial.v1";

export interface TutorialCompany {
  game: GameState;
  remainderMs: number;
  measurement: Measurement;
}

/** Practice never replaces the player's company slot or its cloud checkpoint. */
export function saveTutorialPractice(companyRunId: string, practice: TutorialCompany): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify({ companyRunId, version: WALKTHROUGH_VERSION, save: makeEnvelope(practice.game, practice.remainderMs, Date.now(), practice.measurement) }));
    return true;
  } catch { return false; }
}

export function loadTutorialPractice(companyRunId: string): TutorialCompany | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "null");
    // Practice saved by the retired lesson walkthroughs cannot resume; a Launch Week practice resumes where it was left.
    if (value?.companyRunId !== companyRunId || value?.version !== WALKTHROUGH_VERSION) return null;
    const result = decodeSave(JSON.stringify(value.save));
    if (result.status !== "ok") return null;
    return { game: result.game, remainderMs: result.envelope.runtime.remainderMs, measurement: result.envelope.runtime.measurement };
  } catch { return null; }
}

export function clearTutorialPractice(): void {
  try { localStorage.removeItem(KEY); } catch { /* The cleared practice metadata also prevents resuming it. */ }
}
