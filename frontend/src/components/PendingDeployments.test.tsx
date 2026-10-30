import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { beforeEach, afterEach, it, expect } from "vitest";
import { PendingDeployments } from "./PendingDeployments";
import { useGame } from "../game/store";
import { newGame, type GameState } from "../sim";
import { dataCompany } from "../sim/__tests__/dataFixture";
import type { ScheduledAction } from "../sim/campaignTypes";

beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); });
afterEach(cleanup);

function pendingGame(seconds = 30, game = newGame()): GameState {
  const c = game.campaign!;
  const scheduled: ScheduledAction = { id: "action-test", type: "add-app", requestedStep: c.step, activationStep: c.step + seconds, costCents: 0, activatedStep: null, targetId: "app-2" };
  c.pending.push(scheduled);
  c.actions.push({ ...scheduled });
  return game;
}

function show(game: GameState) {
  useGame.setState({ game, ready: true, started: true, onboarding: false });
  render(<PendingDeployments />);
}

it("lists each scheduled deployment with its remaining game seconds", () => {
  show(pendingGame(30));
  const box = screen.getByRole("complementary", { name: "Pending deployments" });
  expect(box.textContent).toContain("Add server (App 2)");
  expect(box.textContent).toContain("in 30 s");
  expect(screen.getByRole("button", { name: /Deploy now/ })).toBeTruthy();
});

it("fills each deployment's progress bar as its activation delay elapses", () => {
  show(pendingGame(10, dataCompany()));
  const name = { name: "Add server (App 2) deployment" };
  const bar = screen.getByRole("progressbar", name);
  expect(bar.getAttribute("aria-valuenow")).toBe("0");
  expect(bar.getAttribute("aria-valuetext")).toBe("in 10 s");
  act(() => { useGame.setState({ running: true }); useGame.getState().tick(1); });
  expect(screen.getByRole("progressbar", name).getAttribute("aria-valuenow")).toBe("10");
});

it("stays hidden when nothing is scheduled", () => {
  show(newGame());
  expect(screen.queryByRole("complementary", { name: "Pending deployments" })).toBeNull();
});

it("fast-forwards until the deployment activates through the normal steps, then keeps running", () => {
  show(pendingGame(10, dataCompany()));
  const before = useGame.getState().game.campaign!.apps.length;
  fireEvent.click(screen.getByRole("button", { name: /Deploy now/ }));
  expect(useGame.getState().deployRush).toBe(true);
  expect(useGame.getState().running).toBe(true);
  act(() => useGame.getState().tick(1));
  const c = useGame.getState().game.campaign!;
  expect(c.pending).toHaveLength(0);
  expect(c.apps.length).toBe(before + 1);
  expect(useGame.getState().deployRush).toBe(false);
  expect(useGame.getState().running).toBe(true);
  expect(screen.queryByRole("complementary", { name: "Pending deployments" })).toBeNull();
});

it("cancels the rush on a second press", () => {
  show(pendingGame(300));
  fireEvent.click(screen.getByRole("button", { name: /Deploy now/ }));
  fireEvent.click(screen.getByRole("button", { name: /Cancel rush/ }));
  expect(useGame.getState().deployRush).toBe(false);
  expect(useGame.getState().game.campaign!.pending).toHaveLength(1);
});

it("disables the rush like every other campaign action", () => {
  const game = pendingGame(30);
  game.phase = "ended";
  show(game);
  expect(screen.getByRole("button", { name: /Deploy now/ }).hasAttribute("disabled")).toBe(true);
});
