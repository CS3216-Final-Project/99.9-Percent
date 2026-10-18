import { useGame, WALKTHROUGH_STEPS } from "@/game/store";

/** Establish a completed profile for tests of features outside Chapter 0. Its UI has dedicated journeys. */
export function completeTutorialFixture() {
  if (useGame.getState().tour?.track !== "campaign") return;
  while (useGame.getState().tour!.step < WALKTHROUGH_STEPS.campaign - 1) useGame.getState().tourNext();
  useGame.getState().endTour(true);
}
