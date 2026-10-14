import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { useGame } from "@/game/store";
import { finishedChapter } from "@/game/campaignChapters";
import type { GameState } from "@/sim";
import { finishingScaling } from "@/sim/__tests__/dataFixture";
import { dataCompany as finishedData } from "@/sim/__tests__/spikeFixtures";
import { CampaignOverlays } from "./CampaignUI";

beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); });
afterEach(cleanup);
function show(game: GameState) {
  useGame.setState({ game, ready: true, hasRun: true, started: true, onboarding: false, running: true });
  render(<CampaignOverlays />);
}
const step = () => act(() => useGame.getState().advance());
const dialog = () => screen.queryByRole("dialog", { name: "Scaling & Routing complete" });

it("announces Scaling & Routing once, paused, on the step that finishes it", () => {
  show(finishingScaling());
  expect(finishedChapter(useGame.getState().game)).toBeNull();
  expect(dialog()).toBeNull();
  step();
  expect(dialog()).not.toBeNull();
  expect(dialog()!.textContent).toContain("Next: Data Strategy.");
  expect(useGame.getState().running).toBe(false);
});

it("stays in the chapter without announcing it again", () => {
  show(finishingScaling());
  step();
  fireEvent.click(screen.getByRole("button", { name: "Stay in this chapter" }));
  expect(dialog()).toBeNull();
  step();
  expect(dialog()).toBeNull();
  expect(useGame.getState().game.campaign!.dataStage).toBeFalsy();
});

it("continues straight into the next chapter", () => {
  show(finishingScaling());
  step();
  fireEvent.click(screen.getByRole("button", { name: /Continue to data strategy/ }));
  expect(dialog()).toBeNull();
  expect(useGame.getState().game.campaign!.dataStage).toBeTruthy();
});

it("does not announce a company that was already finished when it loaded", () => {
  show(finishedData());
  expect(finishedChapter(useGame.getState().game)).toBe("data");
  expect(screen.queryByRole("dialog", { name: "Data Strategy complete" })).toBeNull();
});
