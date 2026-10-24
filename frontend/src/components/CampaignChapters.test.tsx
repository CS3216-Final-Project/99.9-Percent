import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { useGame } from "@/game/store";
import { applyAction, newGame, type Action, type GameState } from "@/sim";
import { advanceSteps } from "@/sim/step";
import { DEFAULT_META, saveGame, saveMeta } from "@/game/persist";
import { dataCompany } from "@/sim/__tests__/dataFixture";
import { preparedReliability } from "@/sim/__tests__/reliabilityFixture";
import { spikeCompany } from "@/sim/__tests__/spikeFixtures";
import { CampaignChapters } from "./CampaignChapters";

beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); });
afterEach(cleanup);

it.each([
  ["Opening", 1, () => newGame()],
  ["Scaling & Routing", 2, () => dataCompany("read-heavy", false)],
  ["Data Strategy", 3, () => dataCompany()],
  ["Traffic Spikes & Autoscaling", 4, () => spikeCompany(false)],
  ["Stay Online", 5, () => preparedReliability()],
] as const)("shows %s prominently at chapter %i", { timeout: 30_000 }, (name, number, company) => {
  useGame.setState({ game: company(), started: true, ready: true });
  render(<CampaignChapters />);
  const bar = screen.getByRole("region", { name: "Guided Mode chapters" });
  expect(within(bar).getByLabelText("Current chapter").textContent).toBe(name);
  expect(bar.textContent).toContain(`Chapter ${number} of 6`);
  expect(within(bar).queryByRole("list", { name: "Chapter progress" })).toBeNull();
  expect(within(bar).getByLabelText("Current objective").textContent).not.toBe("");
  expect(within(bar).getAllByRole("button", { name: "View chapters" })).toHaveLength(1);
});

/** A Launch Week company that has just continued from its score card into Scaling & Routing. */
function afterLaunchWeek(): GameState {
  const act = (g: GameState, a: Action) => { const r = applyAction(g, a); if (!r.ok) throw new Error(r.message); return r.state; };
  const until = (g: GameState, done: (g: GameState) => boolean) => { for (let i = 0; i < 200 && !done(g); i++) g = g.phase === "review" ? act(g, { type: "acknowledge_review" }) : advanceSteps(g, 1).state; return g; };
  let g = act(until(newGame(7, "lw", 2), x => !!x.campaign!.incident), { type: "start_db_upgrade" });
  g = act(until(g, x => !!x.campaign!.launchWeek!.researchEarned && x.phase === "management"), { type: "pick_launch_tech", tech: "caching" });
  g = until(g, x => x.campaign!.launchWeek!.completedStep !== null && x.phase === "management");
  return act(g, { type: "acknowledge_milestone", enterScaling: true });
}

it("numbers the chapters after Launch Week from 1, as the score card promised", { timeout: 30_000 }, () => {
  useGame.setState({ game: afterLaunchWeek(), started: true, ready: true });
  render(<CampaignChapters />);
  const bar = screen.getByRole("region", { name: "Guided Mode chapters" });
  expect(within(bar).getByLabelText("Current chapter").textContent).toBe("Scaling & Routing");
  expect(bar.textContent).toContain("Chapter 1 of 5");
  fireEvent.click(within(bar).getByRole("button", { name: "View chapters" }));
  const overview = screen.getByRole("dialog", { name: "Guided Mode chapters" });
  expect(overview.textContent).toContain("then play five chapters");
  expect(within(overview).getAllByRole("heading", { level: 3 }).map(h => h.textContent)).toEqual(["Launch Week", "Scaling & Routing", "Data Strategy", "Traffic Spikes & Autoscaling", "Stay Online", "Grow the Company"]);
});

it("keeps Next absent before eligibility, then advances through the existing paused action", () => {
  useGame.setState({ game: newGame(), started: true, ready: true });
  const view = render(<CampaignChapters />);
  expect(screen.queryByRole("button", { name: /^Next:/ })).toBeNull();
  view.unmount();
  const game = dataCompany("read-heavy", false);
  useGame.setState({ game, running: true });
  render(<CampaignChapters />);
  fireEvent.click(screen.getByRole("button", { name: "Next: Continue to Data Strategy" }));
  expect(useGame.getState().game.campaign!.dataStage).toBeTruthy();
  expect(useGame.getState().game.campaign!.runId).toBe(game.campaign!.runId);
  expect(useGame.getState().running).toBe(false);
});

it("explains a disabled Next without changing its engine gate", () => {
  const game = spikeCompany(false);
  game.campaign!.spikeStage!.acknowledged = true;
  useGame.setState({ game, started: true, ready: true });
  render(<CampaignChapters />);
  const next = screen.getByRole("button", { name: "Next: Continue to Stay Online" });
  expect(next.hasAttribute("disabled")).toBe(true);
  const reason = document.getElementById(next.getAttribute("aria-describedby")!)!;
  expect(reason.textContent).toContain("Stay Online opens once Traffic Spikes is finished.");
  expect(reason.tabIndex).toBe(0);
  fireEvent.click(next);
  expect(useGame.getState().game).toBe(game);
});

it("opens Chapter 0 and the six gameplay chapters without advancing the company and stays paused on close", () => {
  const game = newGame();
  useGame.setState({ game, started: true, ready: true, running: true });
  render(<CampaignChapters />);
  fireEvent.click(screen.getByRole("button", { name: "View chapters" }));
  expect(useGame.getState().running).toBe(false);
  expect(useGame.getState().game).toBe(game);
  const dialog = screen.getByRole("dialog", { name: "Guided Mode chapters" });
  expect(within(dialog).getAllByRole("listitem")).toHaveLength(7);
  expect(dialog.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
  expect(within(dialog).getByRole("heading", { name: "Stay Online" }).closest("li")!.textContent).toContain("Locked");
  fireEvent.click(within(dialog).getByRole("button", { name: "Back to company" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(useGame.getState().running).toBe(false);
});

it("marks a practice company as Practice with its own objective", () => {
  const game = newGame();
  useGame.setState({ game, started: true, ready: true, tutorialCompany: { game, remainderMs: 0, measurement: useGame.getState().measurement } });
  render(<CampaignChapters />);
  expect(screen.getByRole("region", { name: "Guided Mode chapters" }).textContent).toContain("Practice");
  expect(screen.getByRole("region", { name: "Guided Mode chapters" }).textContent).toContain("Replay Launch Week");
});

it("marks practice in progress without a completed checkmark and restores the saved incident", () => {
  const game = advanceSteps(newGame(1, "hidden-replay"), 6).state;
  saveGame(game); saveMeta({ ...DEFAULT_META, tutorialDone: true });
  useGame.getState().boot(); useGame.getState().play(); useGame.getState().startTour("campaign");
  render(<CampaignChapters />);
  fireEvent.click(screen.getByRole("button", { name: "View chapters" }));
  const dialog = screen.getByRole("dialog", { name: "Guided Mode chapters" });
  const chapter = within(dialog).getByRole("heading", { name: "Launch Week" }).closest("li")!;
  expect(chapter.textContent).toContain("Current");
  expect(chapter.textContent).toContain("Practice is in progress");
  fireEvent.click(within(dialog).getByRole("button", { name: "Exit practice" }));
  expect(screen.getByLabelText("Current chapter").textContent).toBe("Opening");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(useGame.getState()).toMatchObject({ tour: null, running: false, meta: { walkthroughStep: null } });
  expect(useGame.getState().game.campaign).toEqual(game.campaign);
});
