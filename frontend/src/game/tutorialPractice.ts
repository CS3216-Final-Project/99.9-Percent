import type { GameState } from "@/sim";
import { decodeSave, makeEnvelope } from "./saveEnvelope";
import type { Measurement } from "./telemetry";
import { currentStep, WALKTHROUGH_LESSONS, WALKTHROUGH_VERSION } from "./walkthrough";

const KEY = "nn.campaign.tutorial.v1";

export interface TutorialCompany {
  game: GameState;
  remainderMs: number;
  measurement: Measurement;
}

/** Practice never replaces the player's company slot or its cloud checkpoint. */
export function saveTutorialPractice(companyRunId: string, practice: TutorialCompany, step: number, furthest: number): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify({ companyRunId, step, furthest, version: WALKTHROUGH_VERSION, save: makeEnvelope(practice.game, practice.remainderMs, Date.now(), practice.measurement) }));
    return true;
  } catch { return false; }
}

export function loadTutorialPractice(companyRunId: string): (TutorialCompany & { step: number; furthest: number }) | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "null");
    // Practice saved by the earlier 21-lesson walkthrough has no version; its indices are mapped to the current lessons.
    const limit = value?.version === WALKTHROUGH_VERSION ? WALKTHROUGH_LESSONS : 21;
    if (value?.companyRunId !== companyRunId || !Number.isInteger(value.step) || value.step < 0 || value.step >= limit
      || !Number.isInteger(value.furthest) || value.furthest < value.step || value.furthest >= limit) return null;
    const result = decodeSave(JSON.stringify(value.save));
    if (result.status !== "ok" || result.game.phase !== "management" || result.game.campaign!.step > 1) return null;
    return { game: result.game, remainderMs: result.envelope.runtime.remainderMs, measurement: result.envelope.runtime.measurement,
      step: currentStep(value.step, value.version), furthest: currentStep(value.furthest, value.version) };
  } catch { return null; }
}

export function clearTutorialPractice(): void {
  try { localStorage.removeItem(KEY); } catch { /* The cleared walkthrough metadata also prevents resuming it. */ }
}
