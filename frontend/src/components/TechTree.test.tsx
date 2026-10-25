import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGame } from "@/game/store";
import { newGame, type GameState, type TechId } from "@/sim";
import { reliabilityCompany } from "@/sim/__tests__/reliabilityFixture";
import TechTree from "./TechTree";

beforeEach(() => {
  localStorage.clear();
  useGame.setState(useGame.getInitialState(), true);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function show(game: GameState, techFocus: TechId) {
  useGame.setState({ game, techFocus, view: "tech", ready: true, started: true, onboarding: false, tour: null });
  render(<TechTree />);
}

function detail() {
  const panel = document.querySelector<HTMLElement>(".tree-detail");
  if (!panel) throw Error("Missing technology detail");
  return within(panel);
}

it("shows the actual Launch Week database upgrade and opens its measured inspector without advancing time", () => {
  show(newGame(0, "tech-handoff", 2), "larger_database");
  expect(screen.getByRole("button", { name: "Larger Database: Equipment upgrade" })).toBeTruthy();
  const facts = detail();
  expect(facts.getByText("400 operations/s")).toBeTruthy();
  expect(facts.getByText("2,600 operations/s")).toBeTruthy();
  expect(facts.getByText("$3,000")).toBeTruthy();
  const before = useGame.getState().game.campaign!.step;
  fireEvent.click(screen.getByRole("button", { name: "Inspect Database" }));
  const state = useGame.getState();
  expect(state.view).toBeNull();
  expect(state.selected).toBe("db");
  expect(state.roomInspection?.equipment).toBe("db");
  expect(state.game.campaign!.step).toBe(before);
  expect(state.game.campaign!.trace.at(-1)).toMatchObject({ type: "inspection", data: { component: "db" } });
});

it("keeps stage-locked cache inspection unavailable instead of closing the tree into a dead end", () => {
  show(newGame(), "caching");
  const inspect = screen.getByRole("button", { name: "Inspect Cache" });
  expect(inspect.hasAttribute("disabled")).toBe(true);
  fireEvent.click(inspect);
  expect(useGame.getState().view).toBe("tech");
  expect(useGame.getState().roomInspection).toBeNull();
});

it("separates a research unlock from deployment and sends Health Checks to Monitoring", () => {
  show(reliabilityCompany(), "health_checks");
  expect(screen.getByRole("button", { name: "Health Checks: Research available" })).toBeTruthy();
  expect(detail().getByText("Research available")).toBeTruthy();
  expect(detail().getByText("Not deployed")).toBeTruthy();
  expect(detail().getByText("Unlock cost").parentElement?.textContent).toBe("Unlock cost1 research point");
  expect(detail().getByText("$500")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Inspect Monitoring" }));
  expect(useGame.getState().roomInspection?.equipment).toBe("monitoring");
  expect(useGame.getState().game.campaign!.reliabilityStage!.checksStep).toBeNull();
});

it("disables horizontal navigation when the map fits and updates it after resizing", () => {
  const width = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1200);
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(900);
  show(newGame(), "larger_database");
  const earlier = screen.getByRole("button", { name: "Earlier technologies" });
  const later = screen.getByRole("button", { name: "Later technologies" });
  expect(earlier.hasAttribute("disabled")).toBe(true);
  expect(later.hasAttribute("disabled")).toBe(true);
  width.mockReturnValue(400);
  fireEvent.resize(window);
  expect(later.hasAttribute("disabled")).toBe(false);
  width.mockReturnValue(1200);
  fireEvent.resize(window);
  expect(later.hasAttribute("disabled")).toBe(true);
});
