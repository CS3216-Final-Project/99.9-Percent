import { completeTutorialFixture } from "@/testing/tutorial";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { newGame, applyAction, type GameState } from "../sim";
import { advanceSteps } from "../sim/step";
import { useGame } from "./store";
import { saveGame, saveMeta, loadMeta, DEFAULT_META } from "./persist";

beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); });
afterEach(() => vi.restoreAllMocks());
function act(g: GameState, a: Parameters<typeof applyAction>[1]) { const r = applyAction(g, a); if (!r.ok) throw Error(r.message); return r.state; }
function enter() { useGame.getState().boot(); useGame.getState().play(); }
/** Run the company's clock for `seconds` game seconds, as the frame loop would. */
function run(seconds: number) { useGame.getState().setRunning(true); useGame.getState().tick(seconds); }
/** A recovered Opening slowdown, its postmortem acknowledged, with the traffic limit used to recover still on. */
function limitedRecovery() {
  let g = advanceSteps(newGame(1, "missions-test"), 6).state;
  expect(g.phase).toBe("incident");
  g = act(act(g, { type: "set_traffic_limit", enabled: true }), { type: "start_db_upgrade" });
  return act(advanceSteps(g, 30).state, { type: "acknowledge_review" });
}

it("hands Chapter 0 over to the Opening's guide once, on the real company", () => {
  enter();
  completeTutorialFixture(true);
  expect(useGame.getState().tour).toEqual({ track: "opening", step: 0 });
  expect(useGame.getState().running).toBe(false);
  expect(loadMeta().chapterTours).toEqual(["opening"]);
  useGame.getState().endTour(false);
  expect(useGame.getState().tour).toBeNull();
  // Practice replays of Chapter 0 return to the company without showing it again.
  useGame.getState().startTour("campaign");
  completeTutorialFixture(true);
  expect(useGame.getState().tutorialCompany).toBeNull();
  expect(useGame.getState().tour).toBeNull();
});

it("does not open the Opening's guide for a company already past the Opening", () => {
  saveGame(act(limitedRecovery(), { type: "acknowledge_milestone" }));
  saveMeta({ ...DEFAULT_META, walkthroughStep: 0 });
  enter();
  completeTutorialFixture(true);
  expect(useGame.getState().tour?.track).not.toBe("opening");
});

it("walks the first slowdown once, paused, and resumes the chapter guide it interrupted", () => {
  enter(); completeTutorialFixture(true);
  useGame.getState().tourGo(3);
  run(10);
  const s = useGame.getState();
  expect(s.game.phase).toBe("incident");
  expect(s.running).toBe(false);
  expect(s.tour).toEqual({ track: "slowdown", step: 0, resume: { track: "opening", step: 3 } });
  expect(loadMeta().tipsSeen).toContain("slowdown");
  // Ending the tip returns to the interrupted guide.
  useGame.getState().endTour(false);
  expect(useGame.getState().tour).toEqual({ track: "opening", step: 3 });
});

it("walks a slowdown only the first time", () => {
  saveMeta({ ...DEFAULT_META, tutorialDone: true, tipsSeen: ["slowdown"], chapterTours: ["opening"] });
  enter();
  run(10);
  expect(useGame.getState().game.phase).toBe("incident");
  expect(useGame.getState().tour).toBeNull();
});

it("points out a traffic limit left on once the company is calm, after any chapter guide", () => {
  saveGame(limitedRecovery());
  saveMeta({ ...DEFAULT_META, tutorialDone: true, tipsSeen: ["slowdown"], chapterTours: ["opening"] });
  enter();
  expect(useGame.getState().act({ type: "acknowledge_milestone" })).toBe(true);
  // The Scaling guide takes the moment; its own step covers the limit.
  expect(useGame.getState().tour).toEqual({ track: "scaling", step: 0 });
  useGame.getState().endTour(false);
  run(1);
  expect(useGame.getState().tour).toEqual({ track: "limit", step: 0 });
  expect(useGame.getState().running).toBe(false);
  useGame.getState().endTour(true);
  run(1);
  expect(useGame.getState().tour).toBeNull();
  expect(loadMeta().tipsSeen).toEqual(["slowdown", "limit"]);
});

it("keeps spotlight guides off walkthrough tracks when moving between steps", () => {
  enter();
  useGame.getState().tourGo(4);
  expect(useGame.getState().tour).toEqual({ track: "campaign", step: 0 });
  completeTutorialFixture(true);
  useGame.getState().tourGo(2);
  expect(useGame.getState().tour).toEqual({ track: "opening", step: 2 });
});
