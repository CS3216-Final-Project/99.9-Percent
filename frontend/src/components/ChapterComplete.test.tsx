import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGame } from "@/game/store";
import { finishedChapter } from "@/game/campaignChapters";
import { loadMeta } from "@/game/persist";
import { applyAction, type Action, type GameState } from "@/sim";
import { step as simStep } from "@/sim/step";
import { finishingScaling } from "@/sim/__tests__/dataFixture";
import { dataCompany as finishedData } from "@/sim/__tests__/spikeFixtures";
import { pendingSpikeAcknowledgement } from "@/sim/autoscaling";
import { campaignGuidance } from "@/game/campaignGuidance";
import { act as decide, spikeCompany, tick } from "@/sim/__tests__/spikeFixtures";
import { finishedLaunchWeek, recoveredOpening } from "@/game/__fixtures__/openingOutcome";
import { reliabilityOutcome, reliabilityOutcomeWithQueuedChange } from "@/game/__fixtures__/reliabilityOutcome";
import { CampaignChapters } from "./CampaignChapters";
import { CampaignHeader, CampaignOverlays, CampaignPanel } from "./CampaignUI";

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

it("announces Scaling & Routing once, paused, on the game second that finishes it", () => {
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
  fireEvent.click(screen.getByRole("button", { name: /Continue to Data Strategy/ }));
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
  fireEvent.click(screen.getByRole("button", { name: /Continue to Traffic Spikes/ }));
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

/** A Traffic Spikes company whose spike response awaits the player. */
function spikeRecognition(): GameState {
  let g = spikeCompany(false);
  for (let i = 0; i < 300 && !pendingSpikeAcknowledgement(g.campaign!); i++) g = g.phase === "review" ? decide(g, { type: "acknowledge_review" }) : tick(g);
  return g;
}
const button = (dialog: HTMLElement, name: string | RegExp) => within(dialog).getByRole("button", { name });

it("ends Traffic Spikes with Stay or Continue, and Continue enters Stay Online paused", () => {
  show(spikeRecognition());
  const recognition = screen.getByRole("dialog", { name: "Spike response handled" });
  expect(button(recognition, "Stay in this chapter")).toBeTruthy();
  fireEvent.click(button(recognition, /Continue to Stay Online/));
  const c = useGame.getState().game.campaign!;
  expect(c.spikeStage!.acknowledged).toBe(true);
  expect(c.reliabilityStage).toBeTruthy();
  expect(screen.queryByRole("dialog", { name: "Spike response handled" })).toBeNull();
  expect(useGame.getState().running).toBe(false);
});

it("stays in Traffic Spikes and offers Stay Online through Next in the chapter bar", () => {
  useGame.setState({ game: spikeRecognition(), ready: true, hasRun: true, started: true, onboarding: false });
  render(<><CampaignChapters /><CampaignOverlays /></>);
  fireEvent.click(button(screen.getByRole("dialog", { name: "Spike response handled" }), "Stay in this chapter"));
  expect(useGame.getState().game.campaign!.spikeStage!.acknowledged).toBe(true);
  expect(useGame.getState().game.campaign!.reliabilityStage).toBeFalsy();
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Next: Continue to Stay Online" }));
  expect(useGame.getState().game.campaign!.reliabilityStage).toBeTruthy();
});

it("ends Stay Online with Stay or Continue into Grow the Company", () => {
  show(reliabilityOutcome());
  fireEvent.click(button(screen.getByRole("dialog", { name: "Reliability outcome" }), /Continue to Grow the Company/));
  expect(useGame.getState().game.campaign!.reliabilityStage!.acknowledged).toBe(true);
  expect(useGame.getState().game.campaign!.combinedStage).toBeTruthy();
});

it("disables Continue and names what Grow the Company waits for while a change is installing", () => {
  const game = reliabilityOutcomeWithQueuedChange();
  show(game);
  const outcome = screen.getByRole("dialog", { name: "Reliability outcome" });
  const proceed = button(outcome, /Continue to Grow the Company/) as HTMLButtonElement;
  expect(proceed.disabled).toBe(true);
  const reason = document.getElementById(proceed.getAttribute("aria-describedby")!)!;
  expect(reason.textContent).toContain("Grow the Company opens once queued changes have finished.");
  fireEvent.click(proceed);
  expect(useGame.getState().game).toBe(game);
  expect(useGame.getState().finishChapter("continue")).toBe(false);
  fireEvent.click(button(outcome, "Stay in this chapter"));
  expect(useGame.getState().game.campaign!.reliabilityStage!.acknowledged).toBe(true);
  expect(useGame.getState().game.campaign!.combinedStage).toBeNull();
});

it("ends Launch Week with Stay, Continue and Copy result; Continue enters Scaling & Routing", () => {
  show(finishedLaunchWeek());
  const card = screen.getByRole("dialog", { name: "Launch Week complete" });
  expect(button(card, "Copy result")).toBeTruthy();
  fireEvent.click(button(card, /Continue to Scaling & Routing/));
  expect(useGame.getState().game.campaign!.scaling).toBeTruthy();
});

it("keeps a Launch Week company that stayed out of Scaling & Routing after a reload", () => {
  show(finishedLaunchWeek());
  fireEvent.click(button(screen.getByRole("dialog", { name: "Launch Week complete" }), "Stay in this chapter"));
  const { runId, openingMilestone, scaling } = useGame.getState().game.campaign!;
  expect(openingMilestone!.acknowledged).toBe(true);
  expect(scaling).toBeNull();
  expect(loadMeta().chapterCompletions).toEqual({ runId, chapters: ["opening"] });
  act(() => { useGame.getState().saveNow(true); useGame.setState(useGame.getInitialState(), true); useGame.getState().boot(); useGame.getState().play(); });
  expect(useGame.getState().game.campaign!.runId).toBe(runId);
  expect(useGame.getState().game.campaign!.scaling).toBeNull();
});

it("does not record a stay made on a Launch Week practice company over the real company's record", () => {
  const real = finishedLaunchWeek();
  show(finishedLaunchWeek());
  act(() => useGame.setState({ tutorialCompany: { game: real, remainderMs: 0, measurement: useGame.getState().measurement } }));
  fireEvent.click(button(screen.getByRole("dialog", { name: "Launch Week complete" }), "Stay in this chapter"));
  expect(useGame.getState().game.campaign!.openingMilestone!.acknowledged).toBe(true);
  expect(loadMeta().chapterCompletions).toBeNull();
});

it("ends a version-1 Opening with Stay or Continue, and a stayed company continues later through Next", () => {
  useGame.setState({ game: decide(recoveredOpening(), { type: "acknowledge_review" }), ready: true, hasRun: true, started: true, onboarding: false });
  render(<><CampaignChapters /><CampaignOverlays /></>);
  const recognition = screen.getByRole("dialog", { name: "First growth challenge handled" });
  expect(button(recognition, /Continue to Scaling & Routing/)).toBeTruthy();
  fireEvent.click(button(recognition, "Stay in this chapter"));
  expect(useGame.getState().game.campaign!.openingMilestone!.acknowledged).toBe(true);
  expect(useGame.getState().game.campaign!.scaling).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Next: Continue to Scaling & Routing" }));
  expect(useGame.getState().game.campaign!.scaling).toBeTruthy();
});

it("shows a company that stayed after Launch Week no Scaling & Routing controls or requirements, only Next", () => {
  useGame.setState({ game: finishedLaunchWeek(), ready: true, hasRun: true, started: true, onboarding: false });
  render(<><CampaignHeader /><CampaignPanel /><CampaignOverlays /></>);
  fireEvent.click(button(screen.getByRole("dialog", { name: "Launch Week complete" }), "Stay in this chapter"));
  expect(screen.queryByRole("region", { name: "Scaling growth risk" })).toBeNull();
  expect(screen.queryByText(/Scaling stage active|Database headroom/)).toBeNull();
  expect(screen.getByLabelText("Current chapter").textContent).toBe("Launch Week");
  expect(screen.getByLabelText("Current objective").textContent).toContain("continue to Scaling & Routing with Next");
  const guidance = screen.getByRole("region", { name: "Guided Mode guidance" });
  expect(guidance.textContent).toContain("Launch Week is complete. Continue to Scaling & Routing through Next in the chapter bar when you are ready.");
  fireEvent.click(screen.getByRole("button", { name: "Next: Continue to Scaling & Routing" }));
  expect(useGame.getState().game.campaign!.scaling).toBeTruthy();
});

it.each([
  ["Launch Week complete", () => finishedLaunchWeek(), (g: GameState) => g.campaign!.openingMilestone!.acknowledged && !g.campaign!.scaling],
  ["First growth challenge handled", () => decide(recoveredOpening(), { type: "acknowledge_review" }), (g: GameState) => g.campaign!.openingMilestone!.acknowledged && !g.campaign!.scaling],
  ["Spike response handled", () => spikeRecognition(), (g: GameState) => g.campaign!.spikeStage!.acknowledged && !g.campaign!.reliabilityStage],
  ["Reliability outcome", () => reliabilityOutcome(), (g: GameState) => g.campaign!.reliabilityStage!.acknowledged && !g.campaign!.combinedStage],
] as const)("stays in the chapter for good when Escape closes %s", (name, company, stayed) => {
  show(company());
  fireEvent.keyDown(screen.getByRole("dialog", { name }), { key: "Escape" });
  expect(screen.queryByRole("dialog", { name })).toBeNull();
  expect(stayed(useGame.getState().game)).toBe(true);
  expect(useGame.getState().view).toBeNull();
  step();
  expect(screen.queryByRole("dialog", { name })).toBeNull();
});

it("opens each completion menu on Continue, or on Stay while Continue is not possible", () => {
  show(spikeRecognition());
  expect(document.activeElement).toBe(button(screen.getByRole("dialog", { name: "Spike response handled" }), /Continue to Stay Online/));
  cleanup();
  show(reliabilityOutcomeWithQueuedChange());
  expect(document.activeElement).toBe(button(screen.getByRole("dialog", { name: "Reliability outcome" }), "Stay in this chapter"));
});

it("says so when a stay cannot be saved, and still stays for this visit", () => {
  show(finishedLaunchWeek());
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("full", "QuotaExceededError"); });
  fireEvent.click(button(screen.getByRole("dialog", { name: "Launch Week complete" }), "Stay in this chapter"));
  vi.restoreAllMocks();
  expect(useGame.getState().toast).toMatchObject({ kind: "error", text: expect.stringContaining("could not be saved") });
  expect(useGame.getState().game.campaign!.scaling).toBeNull();
});

it("does not mention reviewing the spike response before there is one", () => {
  expect(campaignGuidance(spikeCompany(false)).notice).toBeNull();
  expect(campaignGuidance(spikeRecognition()).notice).toBe("Stay Online opens after you review the spike response.");
});

it("shows four nines and copies the correctly named game from the chapter-end score card", async () => {
  const game = finishedLaunchWeek();
  game.campaign!.cumulative = { ...game.campaign!.cumulative, successful: 19998, failed: 2, rejected: 0 };
  const writeText = vi.fn().mockResolvedValue(undefined);
  const clipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  try {
    show(game);
    const card = screen.getByRole("dialog", { name: "Launch Week complete" });
    expect(within(card).getByText("four nines")).toBeTruthy();
    await act(async () => { fireEvent.click(button(card, "Copy result")); });
    expect(writeText).toHaveBeenCalledWith("Launch Week: 99.990% uptime (four nines), 2 requests lost - 99.99%");
    expect(button(card, "Stay in this chapter")).toBeTruthy();
    expect(button(card, "Continue to Scaling & Routing")).toBeTruthy();
  } finally {
    if (clipboard) Object.defineProperty(navigator, "clipboard", clipboard);
    else Reflect.deleteProperty(navigator, "clipboard");
  }
});
