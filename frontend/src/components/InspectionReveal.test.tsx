import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { useGame, type RoomInspection } from "@/game/store";
import { advanceTurn, newLegacyGame, type GameState } from "@/sim";
import InspectionReveal from "./InspectionReveal";

beforeEach(() => {
  localStorage.clear();
  useGame.setState(useGame.getInitialState(), true);
});
afterEach(cleanup);

const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function show(game: GameState, inspection: RoomInspection | null, over: Partial<ReturnType<typeof useGame.getState>> = {}) {
  useGame.setState({ game, ready: true, started: true, roomInspection: inspection, ...over });
  render(<InspectionReveal />);
}

it("renders nothing without a room inspection", () => {
  show(newLegacyGame(1), null);
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("reads the equipment and returns to the room, keeping the selection", () => {
  show(newLegacyGame(1), { seq: 1, equipment: "monitoring" }, { selected: "monitoring" });
  const dialog = screen.getByRole("dialog", { name: "Monitoring", exact: true });
  expect(dialog.textContent).toContain("Healthy");
  expect(dialog.textContent).toContain("dashboards");
  expect(dialog.textContent).toContain("Shows what the system is doing.");
  fireEvent.click(screen.getByRole("button", { name: "Return to room" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(useGame.getState().roomInspection).toBeNull();
  expect(useGame.getState().selected).toBe("monitoring");
});

it("names the application instance beside the equipment's name", () => {
  show(newLegacyGame(1), { seq: 1, equipment: "app", appId: "app-1" });
  const dialog = screen.getByRole("dialog", { name: "Servers", exact: true });
  expect(dialog.textContent).toContain("App 1");
});

it("calls a Challenge Mode incident inspection an investigation", () => {
  const game = advanceTurn({ ...copy(newLegacyGame(1)), users: 4500 });
  game.incident!.inspecting = { equipment: "app", remaining: 5, total: 8 };
  show(game, { seq: 1, equipment: "app" });
  const dialog = screen.getByRole("dialog", { name: "Servers investigation started" });
  expect(dialog.textContent).toContain("timed investigation");
});
