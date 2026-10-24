import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { newGame } from "@/sim";
import { advanceSteps } from "@/sim/step";
import { DEFAULT_META, loadGame, saveGame, saveMeta } from "./persist";
import { useGame } from "./store";
import { loadTutorialPractice } from "./tutorialPractice";

beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); });
afterEach(() => vi.restoreAllMocks());
function start() { useGame.getState().boot(); useGame.getState().play(); }
function incident() {
  const game = advanceSteps(newGame(1, "paused-company"), 6).state;
  saveGame(game, 400); saveMeta({ ...DEFAULT_META, tutorialDone: true }); start();
  return game;
}

it("replays Launch Week on a fresh practice company and returns the untouched incident", () => {
  const company = incident();
  useGame.getState().startTour("campaign");
  const s = useGame.getState();
  expect(s).toMatchObject({ running: false, tour: null, meta: { walkthroughStep: 0 } });
  expect(s.game.phase).toBe("management");
  expect(s.game.campaign!.launchWeek).not.toBeNull();
  expect(s.game.campaign!.runId).not.toBe(company.campaign!.runId);
  expect(s.game.campaign!.step).toBe(0);
  // Practice freezes the simulation and saves acknowledged component progress.
  useGame.getState().setRunning(true); useGame.getState().tick(30);
  expect(useGame.getState().game.campaign!.step).toBe(0);
  useGame.getState().act({type:"incident_inspect",equipment:"gateway"});
  useGame.getState().act({type:"acknowledge_introduction",equipment:"gateway"});
  expect(loadGame()).toMatchObject({ status: "ok", game: company, remainderMs: 400 });
  useGame.getState().endSession();
  useGame.setState(useGame.getInitialState(), true); start();
  // The flag resumes practice at the next component; exiting returns the saved company.
  expect(useGame.getState().game.campaign!.launchWeek!.introduction!.explored).toEqual(["gateway"]);
  expect(useGame.getState().tutorialCompany).not.toBeNull();
  expect(useGame.getState().game.campaign!.launchWeek).not.toBeNull();
  useGame.getState().endTour(false);
  expect(useGame.getState()).toMatchObject({ game: company, running: false, tour: null, tutorialCompany: null });
  expect(loadTutorialPractice(company.campaign!.runId)).toBeNull();
  useGame.setState(useGame.getInitialState(), true); start();
  expect(useGame.getState()).toMatchObject({ game: company, tour: null });
});

it("resumes a practice company where it was left, mid-incident included, after a reload", () => {
  const company = incident();
  useGame.getState().startTour("campaign");
  const practice = useGame.getState().game.campaign!.runId;
  // A historical saved practice still resumes its real incident; new introductions freeze time.
  useGame.setState({game:advanceSteps(newGame(1,practice,2),20).state});
  const left = useGame.getState().game;
  expect(left.phase).toBe("incident");
  expect(left.campaign!.step).toBeGreaterThan(1);
  useGame.getState().endSession();
  useGame.setState(useGame.getInitialState(), true); start();
  const s = useGame.getState();
  expect(s.tutorialCompany?.game).toEqual(company);
  expect(s.game.campaign!.runId).toBe(practice);
  expect(s.game.campaign!.step).toBe(left.campaign!.step);
  expect(s.game.phase).toBe("incident");
  expect(s.running).toBe(false);
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

it("starts an explicitly requested new company outside practice, without resurrecting an old replay", () => {
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

it.each(["{", "null", '{"companyRunId":"another-company","version":3}', '{"companyRunId":"paused-company","version":2}'])("ignores corrupt or unrelated practice saves: %s", raw => {
  const company = incident();
  localStorage.setItem("nn.campaign.tutorial.v1", raw);
  useGame.setState(useGame.getInitialState(), true); start();
  expect(useGame.getState()).toMatchObject({ game: company, tutorialCompany: null, tour: null });
});
