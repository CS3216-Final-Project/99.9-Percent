import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { advanceTurn, newGame, newLegacyGame } from "@/sim";
import { loadClassicGame, loadGame, saveClassicGame, saveGame, saveMode } from "@/game/persist";
import { useGame } from "@/game/store";
import { getSession } from "@/lib/api";
import { HomeScreen } from "./HomeScreen";

vi.mock("@/lib/api", async (original) => ({ ...(await original<typeof import("@/lib/api")>()), getSession: vi.fn() }));
beforeEach(() => {
  localStorage.clear();
  useGame.setState(useGame.getInitialState(), true);
  vi.mocked(getSession).mockReturnValue(new Promise(() => {}));
});
afterEach(cleanup);

function boot(mode: "campaign" | "classic") {
  saveMode(mode);
  useGame.getState().boot();
  render(<StrictMode><HomeScreen /></StrictMode>);
  return screen.getByRole("region", { name: "Choose how you want to play" });
}
const card = (choices: HTMLElement, name: "Campaign" | "Classic") => within(choices).getByRole("region", { name });

it("shows a Campaign in progress beside Classic, and switches to Classic without losing the Campaign", () => {
  saveGame(newGame(4, "campaign-in-progress"), 0, true);
  const choices = boot("campaign");
  const campaign = card(choices, "Campaign"), classic = card(choices, "Classic");
  expect(campaign.textContent).toContain("Last played");
  expect(campaign.textContent).toMatch(/Saved game\s*Chapter 1 of 6: Opening/);
  expect(within(campaign).getByRole("button", { name: "Continue company" })).toBeTruthy();
  expect(classic.textContent).toContain("No saved game");
  // Reading the other mode for its card must not write a Classic save.
  expect(localStorage.getItem("nn.classic.save.v1")).toBeNull();
  fireEvent.click(within(classic).getByRole("button", { name: "Play Classic" }));
  expect(useGame.getState()).toMatchObject({ mode: "classic", started: true });
  const kept = loadGame();
  expect(kept.status === "ok" && kept.game.campaign!.runId).toBe("campaign-in-progress");
});

it("shows a Classic in progress beside Campaign, with the same card layout, and switches to the Campaign save", () => {
  saveGame(newGame(4, "waiting-campaign"), 0, true);
  saveClassicGame(advanceTurn(newLegacyGame(2)));
  const choices = boot("classic");
  const campaign = card(choices, "Campaign"), classic = card(choices, "Classic");
  expect(classic.textContent).toContain("Last played");
  expect(classic.textContent).toContain("Week 2 of 26");
  expect(within(classic).getByRole("button", { name: "Continue week 2" })).toBeTruthy();
  expect(within(classic).getByRole("button", { name: "New game" })).toBeTruthy();
  expect(campaign.textContent).toContain("Chapter 1 of 6");
  expect(campaign.textContent).not.toContain("Last played");
  fireEvent.click(within(campaign).getByRole("button", { name: "Continue company" }));
  expect(useGame.getState()).toMatchObject({ mode: "campaign", started: true, hasRun: true });
  expect(useGame.getState().game.campaign!.runId).toBe("waiting-campaign");
  const kept = loadClassicGame();
  expect(kept.status === "ok" && kept.game.turn).toBe(2);
});

it("starts a new Classic game from a Campaign home screen when asked", () => {
  saveClassicGame(advanceTurn(newLegacyGame(2)));
  const choices = boot("campaign");
  const classic = card(choices, "Classic");
  expect(within(classic).getByRole("button", { name: "Continue week 2" })).toBeTruthy();
  fireEvent.click(within(classic).getByRole("button", { name: "New game" }));
  expect(useGame.getState()).toMatchObject({ mode: "classic", started: true });
  expect(useGame.getState().game.turn).toBe(1);
});

it("asks before switching away from a game that cannot be saved", () => {
  localStorage.setItem("nn.campaign.save.v1", "{");
  const choices = boot("campaign");
  fireEvent.click(within(card(choices, "Classic")).getByRole("button", { name: "Play Classic" }));
  expect(useGame.getState()).toMatchObject({ mode: "campaign", started: false });
  expect(screen.getByText(/switching now loses it/)).toBeTruthy();
  fireEvent.click(within(card(choices, "Classic")).getByRole("button", { name: "Switch and lose this run" }));
  expect(useGame.getState()).toMatchObject({ mode: "classic", started: true });
  expect(localStorage.getItem("nn.campaign.save.v1")).toBe("{");
});
