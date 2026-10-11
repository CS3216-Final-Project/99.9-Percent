import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { newLegacyGame } from "@/sim";
import { useGame } from "@/game/store";
import WorkTracker from "./WorkTracker";

beforeEach(() => {
  localStorage.clear();
  useGame.setState({ ...useGame.getInitialState(), game: newLegacyGame(1), mode: "classic", ready: true, started: true });
});
afterEach(cleanup);

it("tracks real weekly work, staffing changes, cancellation and completion", () => {
  render(<WorkTracker />);
  expect(screen.getByText(/No active work/)).toBeTruthy();
  act(() => { useGame.getState().act({ type: "start_debt_paydown" }); });
  expect(screen.getByText("3 wk left")).toBeTruthy();
  const taskId = useGame.getState().game.tasks[0].id;
  act(() => { useGame.getState().act({ type: "assign_engineers", taskId, count: 0 }); });
  expect(screen.getByText("Needs engineers")).toBeTruthy();
  expect(screen.queryByText(/wk left/)).toBeNull();
  act(() => { useGame.getState().advance(); });
  expect(useGame.getState().game.tasks[0].progress).toBe(0);
  act(() => { useGame.getState().act({ type: "assign_engineers", taskId, count: 3 }); });
  expect(screen.getByText("1 wk left")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Pay down technical debt:.*Open Team/ }));
  expect(useGame.getState().view).toBe("engineers");
  act(() => { useGame.getState().advance(); });
  expect(screen.getByText(/No active work/)).toBeTruthy();
  act(() => { useGame.getState().act({ type: "start_tech", tech: "load_balancing" }); });
  expect(screen.getByText("Scale Out + Load Balancing")).toBeTruthy();
  act(() => { useGame.getState().act({ type: "cancel_task", taskId: useGame.getState().game.tasks[0].id }); });
  expect(screen.getByText(/No active work/)).toBeTruthy();
});

it("keeps finished upgrades visible and replaces a release with its testing task", () => {
  act(() => { useGame.getState().act({ type: "start_tech", tech: "load_balancing" }); });
  render(<WorkTracker />);
  expect(screen.getByText("2 wk left")).toBeTruthy();
  act(() => { useGame.getState().advance(); });
  expect(screen.getByText("1 wk left")).toBeTruthy();
  act(() => { useGame.getState().advance(); });
  expect(screen.getByText("Ready to ship")).toBeTruthy();
  const releaseId = useGame.getState().game.releases[0].id;
  act(() => { useGame.getState().act({ type: "test_release", releaseId }); });
  expect(screen.queryByText("Ready to ship")).toBeNull();
  expect(screen.getByText("Test: Scale Out + Load Balancing")).toBeTruthy();
  // An incident freezes weekly work and must not offer unavailable staffing controls.
  act(() => { useGame.setState({ game: { ...useGame.getState().game, phase: "incident" } }); });
  expect(screen.getByText("Weekly work paused during incident")).toBeTruthy();
  expect(screen.getByRole("button", { name: /Test:.*Open Team/ }).hasAttribute("disabled")).toBe(true);
});
