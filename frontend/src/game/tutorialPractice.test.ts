import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { newGame } from "@/sim";
import { advanceSteps } from "@/sim/step";
import { DEFAULT_META, loadGame, saveGame, saveMeta } from "./persist";
import { useGame } from "./store";
import { campaignChapters } from "./campaignChapters";
import { loadTutorialPractice, saveTutorialPractice } from "./tutorialPractice";
import { beginSession, emptyMeasurement } from "./telemetry";
import { RUN_LESSON, WALKTHROUGH_LESSONS } from "./walkthrough";

beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); });
afterEach(() => vi.restoreAllMocks());
function start() { useGame.getState().boot(); useGame.getState().play(); }
function incident() {
  const game = advanceSteps(newGame(1, "paused-company"), 6).state;
  saveGame(game, 400); saveMeta({ ...DEFAULT_META, tutorialDone: true }); start();
  return game;
}

it.each([false, true])("restarts a completed tutorial in fresh practice and returns the untouched incident, finish=%s", finish => {
  const company = incident();
  useGame.getState().startTour("campaign");
  const s = useGame.getState();
  expect(s).toMatchObject({ running: false, tour: { track: "campaign", step: 0 }, meta: { walkthroughFurthestStep: 0 } });
  expect(s.game.phase).toBe("management");
  expect(s.game.campaign!.runId).not.toBe(company.campaign!.runId);
  expect(s.game.campaign!.step).toBe(0);
  expect(campaignChapters(s.game, true, true)[0]).toMatchObject({ completed: false, status: "In progress" });
  for (let i = 0; i < RUN_LESSON; i++) useGame.getState().tourNext();
  useGame.getState().setRunning(true); useGame.getState().tick(30);
  expect(useGame.getState()).toMatchObject({ running: false, game: { campaign: { step: 1 } } });
  useGame.getState().tourNext(); useGame.getState().tourBack();
  useGame.getState().setRunning(true); useGame.getState().tick(30);
  expect(useGame.getState().game.campaign!.step).toBe(1);
  expect(loadGame()).toMatchObject({ status: "ok", game: company, remainderMs: 400 });
  useGame.getState().endSession();
  useGame.setState(useGame.getInitialState(), true); start();
  expect(useGame.getState()).toMatchObject({ tour: { step: RUN_LESSON }, tutorialCompany: { game: company }, game: { campaign: { step: 1 } } });
  if (finish) for (let i = RUN_LESSON; i < WALKTHROUGH_LESSONS - 1; i++) useGame.getState().tourNext();
  useGame.getState().endTour(finish);
  expect(useGame.getState()).toMatchObject({ game: company, remainderMs: 400, running: false, tour: null, tutorialCompany: null });
  expect(loadTutorialPractice(company.campaign!.runId)).toBeNull();
  useGame.setState(useGame.getInitialState(), true); start();
  expect(useGame.getState()).toMatchObject({ game: company, tour: null });
});

it("preserves the company if practice storage is unavailable", () => {
  const company = incident();
  const write = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key === "nn.campaign.tutorial.v1") throw Error("blocked");
    write.call(this, key, value);
  });
  useGame.getState().startTour("campaign");
  expect(useGame.getState()).toMatchObject({ game: company, tutorialCompany: null, tour: null });
  expect(useGame.getState().toast?.text).toContain("Could not start practice");
  expect(loadGame()).toMatchObject({ status: "ok", game: company });
});

it("starts an explicitly requested new company outside practice, without resurrecting the old tutorial", () => {
  const company = incident();
  useGame.getState().startTour("campaign");
  useGame.getState().endSession();
  useGame.getState().newRun({ seed: 12 });
  const replacement = useGame.getState().game;
  expect(replacement.campaign!.runId).not.toBe(company.campaign!.runId);
  expect(useGame.getState()).toMatchObject({ tutorialCompany: null, tour: null });
  expect(loadGame()).toMatchObject({ status: "ok", game: replacement });
  useGame.setState(useGame.getInitialState(), true); start();
  expect(useGame.getState()).toMatchObject({ game: replacement, tutorialCompany: null, tour: null });
});

it.each(["{", "null", '{"companyRunId":"another-company"}'])("ignores corrupt or unrelated practice saves: %s", raw => {
  const company = incident();
  localStorage.setItem("nn.campaign.tutorial.v1", raw);
  useGame.setState(useGame.getInitialState(), true); start();
  expect(useGame.getState()).toMatchObject({ game: company, tutorialCompany: null, tour: null });
});

it("resumes practice saved by the 21-lesson walkthrough at the matching lesson, and rejects corrupt indices", () => {
  const company = incident();
  const game = newGame(1, "old-practice");
  const practice = { game, remainderMs: 0, measurement: beginSession(emptyMeasurement(), game, "old-session", "2026-10-01T00:00:00Z") };
  expect(saveTutorialPractice(company.campaign!.runId, practice, 3, 3)).toBe(true);
  // An older build stored no version; lesson 7 of the old list was the Cancel exercise.
  const stored = JSON.parse(localStorage.getItem("nn.campaign.tutorial.v1")!);
  localStorage.setItem("nn.campaign.tutorial.v1", JSON.stringify({ ...stored, version: undefined, step: 7, furthest: 15 }));
  expect(loadTutorialPractice(company.campaign!.runId)).toMatchObject({ step: RUN_LESSON + 2, furthest: WALKTHROUGH_LESSONS - 1 });
  localStorage.setItem("nn.campaign.tutorial.v1", JSON.stringify({ ...stored, step: WALKTHROUGH_LESSONS, furthest: WALKTHROUGH_LESSONS }));
  expect(loadTutorialPractice(company.campaign!.runId)).toBeNull();
});
