import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { newLegacyGame, type GameState } from "@/sim";
import { useGame } from "@/game/store";
import MachineAlerts from "./MachineAlerts";
import { TaskRow } from "./ui";

beforeEach(() => {
  localStorage.clear();
  useGame.setState({ ...useGame.getInitialState(), game: newLegacyGame(1), mode: "classic", ready: true, started: true });
});
afterEach(cleanup);

const kill = (game: GameState, role: "app" | "db"): GameState => {
  const next = structuredClone(game);
  if (role === "db") next.infra.dbHost.status = "failed";
  else next.infra.appHosts[0].status = "failed";
  return next;
};

it("shows one red alert per dead machine and inspects it when pressed", () => {
  render(<MachineAlerts />);
  const region = screen.getByRole("region", { name: "Machine alerts" });
  expect(region.children).toHaveLength(0);
  const appId = useGame.getState().game.infra.appHosts[0].id;
  act(() => { useGame.setState({ game: kill(kill(useGame.getState().game, "app"), "db") }); });
  expect(region.children).toHaveLength(2);
  expect(screen.getByText("Database machine is dead")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`Server ${appId} is dead`) }));
  expect(useGame.getState().selected).toBe("app");
  // Replacing the machine clears its alert.
  act(() => { useGame.setState({ game: newLegacyGame(1) }); });
  expect(region.children).toHaveLength(0);
});

it("stays out of Guided Mode", () => {
  useGame.setState({ started: false });
  const { container } = render(<MachineAlerts />);
  expect(container.innerHTML).toBe("");
});

it("shows a task's progress as a percentage, rounded down, beside the weeks left", () => {
  act(() => { useGame.getState().act({ type: "start_tech", tech: "load_balancing" }); });
  const view = () => render(<TaskRow game={useGame.getState().game} task={useGame.getState().game.tasks[0]} />);
  const first = view();
  expect(screen.getByText("0%")).toBeTruthy();
  expect(screen.getByText("2 wk left")).toBeTruthy();
  first.unmount();
  act(() => { useGame.getState().advance(); });
  view();
  // Two engineers on three engineer-weeks: two thirds done reads 66%, never a rounded-up figure.
  expect(screen.getByText("66%")).toBeTruthy();
  expect(screen.getByText("1 wk left")).toBeTruthy();
});
