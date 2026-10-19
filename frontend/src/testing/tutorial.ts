import { useGame, WALKTHROUGH_STEPS } from "@/game/store";

/** Establish a completed profile for tests of features outside Chapter 0. Its UI has dedicated journeys. */
/** Finish Chapter 0. The Opening's own guide follows it; tests about something else skip that too unless asked. */
export function completeTutorialFixture(keepOpeningGuide = false) {
  if (useGame.getState().tour?.track !== "campaign") return;
  while (useGame.getState().tour!.step < WALKTHROUGH_STEPS.campaign - 1) useGame.getState().tourNext();
  useGame.getState().endTour(true);
  if (!keepOpeningGuide && useGame.getState().tour?.track === "opening") useGame.getState().endTour(false);
}
