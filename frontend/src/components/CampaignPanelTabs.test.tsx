import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, onTestFinished, vi } from "vitest";
import { CampaignAttentionHost } from "./CampaignAttention";
import { CampaignHeader, CampaignControls, CampaignPanel } from "./CampaignUI";
import { inspectOrSelect, useGame } from "@/game/store";
import { newGame, type GameState } from "@/sim";
import { advanceSteps } from "@/sim/step";
import { setConfirming } from "./actionConfirmation";

beforeEach(() => {
  localStorage.clear(); useGame.setState(useGame.getInitialState(), true);
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 10, y: 10, top: 10, left: 10, right: 54, bottom: 54, width: 44, height: 44, toJSON: () => ({}) });
});
afterEach(() => { cleanup(); setConfirming(null); vi.restoreAllMocks(); });
function show(game: GameState = newGame()) {
  useGame.setState({ game, ready: true, started: true, running: false, onboarding: false, tour: null });
  render(<StrictMode><CampaignAttentionHost><CampaignHeader /><CampaignPanel /><CampaignControls /></CampaignAttentionHost></StrictMode>);
}
const tab = (name: string) => screen.getByRole("tab", { name: new RegExp(`^${name}`) });
const gold = () => document.querySelectorAll(".campaign-gold-attention");

it("opens on Analysis, with guidance pinned above both tabs", () => {
  show();
  expect(tab("Analysis").getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("heading", { name: "Inspect equipment" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Add server/ })).toBeNull();
  fireEvent.click(tab("Actions"));
  expect(screen.getByRole("button", { name: /Add server/ })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Inspect equipment" })).toBeNull();
  expect(screen.getByRole("region", { name: "Guided Mode guidance" })).toBeTruthy();
});

it("counts what is still activating on the Actions tab", () => {
  show(); fireEvent.click(tab("Actions"));
  expect(tab("Actions").textContent).toBe("Actions");
  fireEvent.click(screen.getByRole("button", { name: /Add server/ }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  expect(tab("Actions").textContent).toBe("Actions1, 1 activating");
});

it("moves between tabs with the arrow keys", () => {
  show(); act(() => tab("Analysis").focus());
  fireEvent.keyDown(tab("Analysis"), { key: "ArrowRight" });
  expect(useGame.getState().panelTab).toBe("actions"); expect(document.activeElement).toBe(tab("Actions"));
  fireEvent.keyDown(tab("Actions"), { key: "Home" });
  expect(useGame.getState().panelTab).toBe("analysis");
});

it("choosing equipment brings its readings forward", () => {
  show(); fireEvent.click(tab("Actions"));
  act(() => inspectOrSelect("db"));
  expect(useGame.getState().panelTab).toBe("analysis");
  expect(screen.getByRole("region", { name: "Database readings" })).toBeTruthy();
});

it("an open quote stays open while the player reads Analysis", () => {
  // The quote opens over the room, outside the panel.
  const room = document.body.appendChild(Object.assign(document.createElement("main"), { className: "stage" }));
  onTestFinished(() => room.remove());
  show(); fireEvent.click(tab("Actions"));
  fireEvent.click(screen.getByRole("button", { name: /Add server/ }));
  fireEvent.click(tab("Analysis"));
  expect(useGame.getState().panelTab).toBe("analysis");
  expect(screen.getByRole("heading", { name: "Inspect equipment" })).toBeTruthy();
  const quote = screen.getByRole("region", { name: "Confirm Add server" });
  fireEvent.click(within(quote).getByRole("button", { name: "Confirm" }));
  expect(useGame.getState().game.campaign!.pending.some(a => a.type === "add-app")).toBe(true);
});

it("closing a quote from Analysis leaves focus on the selected tab, not the page", () => {
  const room = document.body.appendChild(Object.assign(document.createElement("main"), { className: "stage" }));
  onTestFinished(() => room.remove());
  show(); fireEvent.click(tab("Actions"));
  fireEvent.click(screen.getByRole("button", { name: /Add server/ }));
  fireEvent.click(tab("Analysis"));
  const cancel = within(screen.getByRole("region", { name: "Confirm Add server" })).getByRole("button", { name: "Cancel" });
  act(() => cancel.focus());
  fireEvent.click(cancel);
  expect(screen.queryByRole("region", { name: "Confirm Add server" })).toBeNull();
  expect(document.activeElement).toBe(tab("Analysis"));
});

it("an accepted hint opens the tab of its purchase once, then leaves the choice of tab to the player", () => {
  show(advanceSteps(newGame(), 6).state);
  fireEvent.click(screen.getByRole("button", { name: "Hint" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Hint" })).getByRole("button", { name: "Got it" }));
  expect(useGame.getState().panelTab).toBe("actions");
  expect(gold()).toHaveLength(1); expect(gold()[0].textContent).toContain("Upgrade database");
  fireEvent.click(tab("Analysis"));
  expect(useGame.getState().panelTab).toBe("analysis");
  // The purchase is out of sight now, so its tab carries the spotlight instead.
  expect(gold()).toHaveLength(1); expect(gold()[0]).toBe(tab("Actions"));
});

it("accepting the same hint again opens its tab again", () => {
  show(advanceSteps(newGame(), 6).state);
  const accept = () => {
    fireEvent.click(screen.getByRole("button", { name: "Hint" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Hint" })).getByRole("button", { name: "Got it" }));
  };
  accept(); fireEvent.click(tab("Analysis"));
  accept();
  expect(useGame.getState().panelTab).toBe("actions");
});

it("a new company starts on Analysis", () => {
  show(); fireEvent.click(tab("Actions"));
  act(() => useGame.getState().newRun());
  expect(useGame.getState().panelTab).toBe("analysis");
});
