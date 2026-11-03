import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "@/App";
import { BALANCE, type GameState } from "@/sim";
import { balanced, runBot } from "@/sim/__tests__/bots";
import { DEFAULT_META, loadClassicGame, readAnalytics, saveClassicGame, saveMeta, saveMode } from "@/game/persist";
import { useGame } from "@/game/store";

vi.mock("@/components/scene/Facility", () => ({ default: () => <div data-testid="facility" /> }));

let won: GameState;
beforeEach(() => {
  localStorage.clear();
  useGame.setState(useGame.getInitialState(), true);
  won ??= runBot(BALANCE.introSeed, balanced, "expert").state;
  saveMeta({ ...DEFAULT_META, challengeUnlocked: true });
  saveMeta({ ...DEFAULT_META, tutorialDone: true, onboarded: true, runsStarted: 1, runsFinished: 1 }, "classic");
  saveMode("classic");
  saveClassicGame(won);
});
afterEach(cleanup);

const home = () => within(screen.getByRole("region", { name: "Choose how you want to play" })).getByRole("region", { name: "Challenge Mode" });
const reload = () => {
  cleanup();
  useGame.setState(useGame.getInitialState(), true);
  render(<StrictMode><App /></StrictMode>);
};

it("reopens a run that secured its Series A on its report, and keeps the same company going with no deadline", () => {
  expect(won).toMatchObject({ phase: "ended", outcome: "won" });
  render(<StrictMode><App /></StrictMode>);
  expect(home().textContent).toMatch(/Saved game\s*Series A secured/);
  fireEvent.click(within(home()).getByRole("button", { name: "See your results" }));

  const report = screen.getByRole("dialog", { name: "Series A secured" });
  const keep = within(report).getByRole("button", { name: "Keep playing" });
  expect(document.activeElement).toBe(keep);
  fireEvent.click(keep);

  expect(screen.queryByRole("dialog", { name: "Series A secured" })).toBeNull();
  expect(useGame.getState().game).toMatchObject({ phase: "management", outcome: null, seriesAWeek: won.totals.weeks, users: won.users });
  const clock = screen.getByRole("group", { name: "Time" });
  expect(clock.textContent).toContain(`Week ${won.turn}`);
  expect(clock.textContent).not.toContain(`/${BALANCE.maxTurns}`);
  expect(within(clock).getByRole("button", { name: /Next week/ })).toHaveProperty("disabled", false);
  expect(readAnalytics().filter((e) => e.name === "endless_started")).toHaveLength(1);
  expect(useGame.getState().meta.runsFinished).toBe(1);

  // The growing company outgrows its database in its first week past the Series A: play goes on as normal.
  fireEvent.click(within(clock).getByRole("button", { name: /Next week/ }));
  const after = useGame.getState().game;
  expect(after).toMatchObject({ phase: "incident", incident: { type: "db_saturation" }, seriesAWeek: won.totals.weeks });
  expect(loadClassicGame()).toMatchObject({ status: "ok", game: { phase: "incident", seriesAWeek: won.totals.weeks } });

  reload();
  expect(home().textContent).toContain(`Week ${after.turn}: Series A secured`);
  fireEvent.click(within(home()).getByRole("button", { name: `Continue week ${after.turn}` }));
  expect(useGame.getState()).toMatchObject({ running: false, game: { phase: "incident", seriesAWeek: won.totals.weeks } });
  expect(screen.queryByRole("dialog", { name: "Series A secured" })).toBeNull();
});

it("still lets a winner start over instead, and offers nothing to a bankrupt run", () => {
  render(<StrictMode><App /></StrictMode>);
  fireEvent.click(within(home()).getByRole("button", { name: "See your results" }));
  const report = screen.getByRole("dialog", { name: "Series A secured" });
  fireEvent.click(within(report).getByRole("button", { name: "Play again" }));
  expect(useGame.getState().game).toMatchObject({ phase: "management", outcome: null, turn: 1 });
  expect(useGame.getState().game.seriesAWeek).toBeUndefined();
  expect(readAnalytics().filter((e) => e.name === "endless_started")).toHaveLength(0);

  saveClassicGame({ ...won, outcome: "bankrupt" });
  reload();
  expect(home().textContent).toContain("Last company closed");
});

it("rejects a corrupt Series A week in a stored save", () => {
  saveClassicGame({ ...won, outcome: null, phase: "management", seriesAWeek: -3 });
  expect(loadClassicGame().status).toBe("corrupt");
  saveClassicGame({ ...won, outcome: "won", seriesAWeek: won.totals.weeks });
  expect(loadClassicGame().status).toBe("corrupt");
});
