/**
 * Guided Mode's Chapter 0 lessons, by id. Saved progress stores an index into this list, tagged with
 * WALKTHROUGH_VERSION; an untagged index belongs to the earlier 21-lesson walkthrough and is mapped forward.
 */
export const WALKTHROUGH_LESSON_IDS = ["goal", "inspect-app", "inspect-db", "warnings", "run", "quote", "cancel", "money", "speed", "ready"] as const;
export type LessonId = (typeof WALKTHROUGH_LESSON_IDS)[number];

export const WALKTHROUGH_VERSION = 2;
export const WALKTHROUGH_LESSONS = WALKTHROUGH_LESSON_IDS.length;
export const lessonIndex = (id: LessonId) => WALKTHROUGH_LESSON_IDS.indexOf(id);
export const lessonAt = (step: number | undefined): LessonId | undefined => step === undefined ? undefined : WALKTHROUGH_LESSON_IDS[step];
/** The lesson whose exercise runs the real company for one game second. */
export const RUN_LESSON = lessonIndex("run");

/** Where each lesson of the 21-lesson walkthrough is taught now; later topics moved to tips and chapter guides. */
const LEGACY: readonly LessonId[] = [
  "goal", "inspect-db", "inspect-db", "warnings", "run", "run", "quote", "cancel",
  "money", "money", "money", "speed", "speed",
];

/** A lesson index saved by the earlier walkthrough, as an index into the current one. */
export function migrateLegacyStep(step: number): number {
  return lessonIndex(LEGACY[step] ?? "ready");
}

/** A saved index as a current one: migrated when it predates this version, and always within range. */
export function currentStep(step: number, version: unknown): number {
  const current = version === WALKTHROUGH_VERSION ? step : migrateLegacyStep(step);
  return Math.min(Math.max(0, current), WALKTHROUGH_LESSONS - 1);
}
