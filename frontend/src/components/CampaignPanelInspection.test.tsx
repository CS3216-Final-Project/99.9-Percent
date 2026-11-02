import InspectionReveal from "./InspectionReveal";
import { enterHighlightedInspection } from "./inspectionTestUtils";
import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CampaignAttentionHost } from "./CampaignAttention";
import { CampaignHeader, CampaignControls, CampaignPanel } from "./CampaignUI";
import { useGame } from "@/game/store";
import { newGame, type GameState } from "@/sim";
import { advanceSteps } from "@/sim/step";
import { setConfirming } from "./actionConfirmation";

beforeEach(() => {
  localStorage.clear(); useGame.setState(useGame.getInitialState(), true);
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 10, y: 10, top: 10, left: 10, right: 54, bottom: 54, width: 44, height: 44, toJSON: () => ({}) });
});
afterEach(() => { cleanup(); setConfirming(null); vi.restoreAllMocks(); });
function show(game: GameState = newGame(), state: Partial<ReturnType<typeof useGame.getState>> = {}) {
  useGame.setState({ game, ready: true, started: true, running: false, onboarding: false, tour: null, tutorialCompany: null, ...state });
  render(<StrictMode><CampaignAttentionHost><CampaignHeader /><CampaignPanel /><InspectionReveal /><CampaignControls /></CampaignAttentionHost></StrictMode>);
}
const panel = () => screen.getByRole("complementary", { name: "System metrics" });
const gold = () => document.querySelectorAll(".campaign-gold-attention");

it.each([
  ["a chapter guide", { tour: { track: "scaling" as const, step: 0 } }],
  ["a historical practice company", { tutorialCompany: { game: newGame(1, "original"), remainderMs: 0, measurement: useGame.getInitialState().measurement } }],
])("keeps the panel without tabs and opens equipment in its inspection during %s", (_, state) => {
  show(newGame(), state);
  expect(within(panel()).queryByRole("tablist")).toBeNull();
  expect(within(panel()).queryByRole("button", { name: /^Add server/ })).toBeNull();
  fireEvent.click(within(panel()).getByRole("button", { name: "App Server" }));
  expect(within(screen.getByRole("dialog", { name: "App Servers" })).getByRole("button", { name: /^Add server/ })).toBeTruthy();
});

it("an accepted hint guides the player through the component to its purchase", () => {
  show(advanceSteps(newGame(), 6).state);
  expect(screen.queryByRole("tab")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Hint" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Hint" })).getByRole("button", { name: "Got it" }));
  expect(gold()).toHaveLength(1); expect(gold()[0].textContent).toContain("Database");
  enterHighlightedInspection();
  expect(gold()).toHaveLength(1); expect(gold()[0].textContent).toContain("Upgrade database");
});

it("accepting the same hint again restores component guidance after inspection dismissal", () => {
  show(advanceSteps(newGame(), 6).state);
  const accept = () => {
    fireEvent.click(screen.getByRole("button", { name: "Hint" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Hint" })).getByRole("button", { name: "Got it" }));
  };
  accept(); enterHighlightedInspection();
  fireEvent.click(within(screen.getByRole("dialog", { name: "Database" })).getByRole("button", { name: "Close" }));
  accept();
  expect(gold()).toHaveLength(1); expect(gold()[0].textContent).toContain("Database");
});
