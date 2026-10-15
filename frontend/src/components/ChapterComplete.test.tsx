import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { useGame } from "@/game/store";
import { finishedChapter } from "@/game/campaignChapters";
import { loadMeta } from "@/game/persist";
import { applyAction, type Action, type GameState } from "@/sim";
import { step as simStep } from "@/sim/step";
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
const play = (action: Action) => act(() => useGame.getState().act(action));
/** Runs the clock one step at a time, through incidents, until `done`. */
function runUntil(done: (game: GameState) => boolean) {
  for (let i = 0; i < 100 && !done(useGame.getState().game); i++) act(() => { useGame.setState({ running: true }); useGame.getState().tick(1); });
  expect(done(useGame.getState().game)).toBe(true);
}
const dialog = () => screen.queryByRole("dialog", { name: "Scaling & Routing complete" });
const dataDialog = () => screen.queryByRole("dialog", { name: "Data Strategy complete" });
/** Sending all traffic to one application overloads it; the incident ends Data Strategy's finished state until reviewed. */
const overload: Action = { type: "set_routing", mode: "balanced", targets: ["app-1"] };
const rebalance: Action = { type: "set_routing", mode: "balanced", targets: ["app-1", "app-2"] };
/** A Data Strategy company in an incident it is recovering from, so the chapter is not finished yet. */
function recoveringData(): GameState {
  const apply = (g: GameState, a: Action) => { const r = applyAction(g, a); if (!r.ok) throw Error(r.message); return r.state; };
  let g = apply(finishedData(), overload);
  while (g.phase !== "incident") g = simStep(g).state;
  return apply(g, rebalance);
}
/** Recovers from the incident and runs until Data Strategy is finished again. */
function recover() {
  runUntil(game => game.phase === "review");
  play({ type: "acknowledge_review" });
  runUntil(game => finishedChapter(game) === "data");
}

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

it("does not announce Scaling & Routing again when it slips and is finished again", () => {
  show(finishingScaling());
  step();
  const runId = useGame.getState().game.campaign!.runId;
  expect(loadMeta().chapterCompletions).toEqual({ runId, chapters: ["scaling"] });
  fireEvent.click(screen.getByRole("button", { name: "Stay in this chapter" }));
  // Lifting the traffic limit briefly unfinishes the chapter; it is finished again two steps later.
  play({ type: "set_traffic_limit", enabled: false });
  step();
  expect(finishedChapter(useGame.getState().game)).toBeNull();
  step();
  step();
  expect(finishedChapter(useGame.getState().game)).toBe("scaling");
  expect(dialog()).toBeNull();
});

it("dismisses with Escape for good", () => {
  show(finishingScaling());
  step();
  fireEvent.keyDown(dialog()!, { key: "Escape" });
  expect(dialog()).toBeNull();
  expect(useGame.getState().chapterComplete).toBeNull();
  step();
  expect(dialog()).toBeNull();
});

it("appears over History when the chapter finishes there, as the clock stops", () => {
  show(finishingScaling());
  act(() => useGame.setState({ view: "history" }));
  step();
  expect(dialog()).not.toBeNull();
  expect(useGame.getState().running).toBe(false);
});

it("announces Data Strategy and continues into Traffic Spikes", () => {
  show(recoveringData());
  expect(finishedChapter(useGame.getState().game)).toBeNull();
  recover();
  expect(useGame.getState().running).toBe(false);
  expect(dataDialog()!.textContent).toContain("Next: Traffic Spikes & Autoscaling.");
  fireEvent.click(screen.getByRole("button", { name: /Continue to traffic spikes/ }));
  expect(dataDialog()).toBeNull();
  expect(useGame.getState().game.campaign!.spikeStage).toBeTruthy();
});

it("does not announce a company loaded already finished after an incident and recovery", () => {
  show(finishedData());
  play(overload);
  runUntil(game => game.phase === "incident");
  play(rebalance);
  recover();
  expect(dataDialog()).toBeNull();
});
