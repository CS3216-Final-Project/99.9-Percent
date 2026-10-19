import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGame } from "@/game/store";
import { completeTutorialFixture } from "@/testing/tutorial";
import { CampaignHeader, CampaignPanel, CampaignControls, CampaignOverlays } from "./CampaignUI";
import Tutorial from "./Tutorial";
import { CHAPTER_MISSIONS } from "./chapterMissions";
import { DEFAULT_META, saveGame, saveMeta } from "@/game/persist";
import { applyAction, newGame, type Action, type GameState } from "@/sim";
import { advanceSteps } from "@/sim/step";

beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
function start() { useGame.getState().boot(); useGame.getState().play(); }
function renderCompany() { return render(<><CampaignHeader /><CampaignPanel /><CampaignControls /><CampaignOverlays /><Tutorial /></>); }
function decide(g: GameState, a: Action) { const r = applyAction(g, a); if (!r.ok) throw Error(r.message); return r.state; }
const OPENING = CHAPTER_MISSIONS.opening.length;
const guide = (step: number, of = OPENING, name = "Chapter guide") => screen.getByRole("dialog", { name: `${name}, step ${step} of ${of}` });
const panel = () => within(screen.getByRole("complementary", { name: "System metrics" }));
const run = (seconds: number) => act(() => { useGame.getState().setRunning(true); useGame.getState().tick(seconds); });

it("guides the Opening from Chapter 0 to the growth wave and the bottleneck, pausing when demand jumps", () => {
  start(); renderCompany();
  act(() => completeTutorialFixture(true));
  expect(guide(1).textContent).toContain("Chapter 1: Opening");
  fireEvent.click(within(guide(1)).getByRole("button", { name: "Got it" }));
  // Waiting on a real action: no Next until the time has passed.
  expect(guide(2).textContent).toContain("Press Run.");
  expect(within(guide(2)).queryByRole("button", { name: "Next" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Run" }));
  run(4);
  expect(useGame.getState().game.campaign!.consumedEvents).toContain("opening-growth");
  expect(guide(3).textContent).toContain("Demand just grew");
  expect(useGame.getState().running).toBe(false);
  fireEvent.click(panel().getByRole("button", { name: "Database" }));
  expect(guide(4).textContent).toContain("Fix the bottleneck");
  expect(within(guide(4)).getByText("Learn more")).toBeTruthy();
  // Back revisits a finished step without it moving on again by itself.
  fireEvent.click(within(guide(4)).getByRole("button", { name: "Back" }));
  expect(guide(3).textContent).toContain("Demand just grew");
  fireEvent.click(within(guide(3)).getByRole("button", { name: "Next" }));
  act(() => { useGame.getState().act({ type: "start_db_upgrade" }); });
  expect(guide(5).textContent).toContain("Finish without a slowdown");
});

it("walks the first slowdown to recovery, then returns to the interrupted guide only while it still applies", () => {
  start(); renderCompany();
  act(() => { completeTutorialFixture(true); useGame.getState().tourGo(3); });
  run(10);
  expect(useGame.getState().game.phase).toBe("incident");
  const slow = (step: number) => guide(step, 4, "Slowdown guide");
  expect(slow(1).textContent).toContain("A slowdown started");
  fireEvent.click(within(slow(1)).getByRole("button", { name: "Next" }));
  expect(slow(2).textContent).toContain("Click Database.");
  fireEvent.click(panel().getByRole("button", { name: "Database" }));
  expect(slow(3).textContent).toContain("Press Upgrade database");
  act(() => { useGame.getState().act({ type: "start_db_upgrade" }); });
  expect(slow(4).textContent).toContain("Run to recover");
  run(30);
  // Recovered: the postmortem opens, and the Opening's remaining steps no longer apply.
  expect(useGame.getState().game.phase).toBe("review");
  expect(useGame.getState().tour).toBeNull();
});

it("skips the Scaling steps a company has already done and lights the routing it still needs", () => {
  let g = advanceSteps(newGame(1, "scaling-mission"), 6).state;
  g = decide(g, { type: "start_db_upgrade" });
  g = decide(decide(advanceSteps(g, 30).state, { type: "acknowledge_review" }), { type: "acknowledge_milestone" });
  g = decide(advanceSteps(decide(g, { type: "add_server" }), 3).state, { type: "deploy_load_balancer" });
  // Left pending: an upgrade on its way already counts as making room.
  g = decide(advanceSteps(g, 2).state, { type: "start_db_upgrade" });
  saveGame(g);
  saveMeta({ ...DEFAULT_META, tutorialDone: true, chapterTours: ["opening", "scaling"], tipsSeen: ["slowdown"] });
  start(); renderCompany();
  act(() => useGame.getState().startTour("scaling"));
  const of = CHAPTER_MISSIONS.scaling.length;
  fireEvent.click(within(guide(1, of)).getByRole("button", { name: "Got it" }));
  // Limit, server and load balancer are already handled (the Database upgrade too, later on); routing is next.
  const routing = guide(5, of);
  expect(routing.textContent).toContain("Send traffic to both servers");
  expect(document.querySelector<HTMLDetailsElement>('[data-tour="routing"]')!.open).toBe(true);
  fireEvent.click(within(routing).getByRole("button", { name: "Skip" }));
  expect(useGame.getState().tour).toBeNull();
});

it("replays the current chapter's guide from View chapters", () => {
  saveMeta({ ...DEFAULT_META, tutorialDone: true, chapterTours: ["opening"] });
  start(); renderCompany();
  fireEvent.click(screen.getByRole("button", { name: "View chapters" }));
  fireEvent.click(screen.getByRole("button", { name: "Replay chapter guide" }));
  expect(useGame.getState().tour).toEqual({ track: "opening", step: 0 });
  expect(guide(1).textContent).toContain("Chapter 1: Opening");
});
