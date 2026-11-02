import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { advanceTurn, newLegacyGame, type GameState } from "@/sim";
import { useGame } from "@/game/store";
import MachineAlerts from "./MachineAlerts";
import SidePanel from "./SidePanel";
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
  const cards = () => region.querySelectorAll(".machine-alert");
  expect(cards()).toHaveLength(0);
  act(() => { useGame.setState({ game: kill(kill(useGame.getState().game, "app"), "db") }); });
  expect(cards()).toHaveLength(2);
  expect(screen.getByText("Database machine is dead")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Server 1 is dead/ }));
  expect(useGame.getState().selected).toBe("app");
  // Replacing the machine clears its alert.
  act(() => { useGame.setState({ game: newLegacyGame(1) }); });
  expect(cards()).toHaveLength(0);
});

/** A company whose dead server has opened an incident. */
function incidentGame(): GameState {
  let game = newLegacyGame(1);
  for (let i = 0; i < 40 && game.phase !== "incident"; i++) game = advanceTurn(kill(game, "app"));
  expect(game.phase).toBe("incident");
  return game;
}

it("during an incident reports the dead machine without starting an investigation", () => {
  useGame.setState({ game: incidentGame() });
  render(<MachineAlerts />);
  expect(screen.queryByRole("button", { name: /Server \d+ is dead/ })).toBeNull();
  expect(screen.getByRole("status").textContent).toContain("Find the cause in the incident panel");
  expect(useGame.getState().game.incident!.inspecting).toBeFalsy();
});

it("hides the equipment picker during an incident, leaving Find the cause in charge", () => {
  render(<SidePanel />);
  expect(screen.getByRole("button", { name: "Inspect Servers" })).toBeTruthy();
  act(() => { useGame.setState({ game: incidentGame() }); });
  expect(screen.queryByRole("button", { name: "Inspect Servers" })).toBeNull();
  expect(screen.getByText("Find the cause")).toBeTruthy();
});

it("lists the week's warnings in a card that folds away and stays folded", () => {
  const game = structuredClone(useGame.getState().game);
  game.upcomingSurge = { turn: game.turn + 1, mult: 1.5, label: "A newsletter mention" } as GameState["upcomingSurge"];
  act(() => { useGame.setState({ game }); });
  render(<MachineAlerts />);
  const card = document.querySelector<HTMLDetailsElement>(".machine-warnings")!;
  expect(card.open).toBe(true);
  expect(card.textContent).toContain("Traffic surge");
  act(() => { card.open = false; card.dispatchEvent(new Event("toggle")); });
  act(() => { useGame.setState({ game: structuredClone(game) }); });
  expect(document.querySelector<HTMLDetailsElement>(".machine-warnings")!.open).toBe(false);
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
