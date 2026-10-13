import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { advanceTurn, newGame, newLegacyGame } from "@/sim";
import { DEFAULT_META, loadClassicGame, loadGame, saveClassicGame, saveGame, saveMeta, saveMode } from "@/game/persist";
import { ANALYTICS_CONSENT_KEY } from "@/lib/analytics";
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

const unlock = () => saveMeta({ ...DEFAULT_META, challengeUnlocked: true });
function boot(mode: "campaign" | "classic") {
  if (mode === "classic") unlock();
  saveMode(mode);
  useGame.getState().boot();
  render(<StrictMode><HomeScreen /></StrictMode>);
  return screen.getByRole("region", { name: "Choose how you want to play" });
}
const card = (choices: HTMLElement, name: "Guided Mode" | "Challenge Mode") => within(choices).getByRole("region", { name });

it("shows Guided Mode first with Challenge Mode locked until the chapters are done", () => {
  const choices = boot("campaign");
  const guided = card(choices, "Guided Mode"), challenge = card(choices, "Challenge Mode");
  expect(choices.compareDocumentPosition(guided) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(guided.textContent).toContain("Continuous play · Six guided chapters");
  expect(challenge.textContent).toContain("Complete the first five Guided Mode chapters to unlock.");
  // The locked card's only action is disabled and cannot switch modes.
  const lockedButton = within(challenge).getByRole("button", { name: "Complete Guided Mode to unlock" });
  expect(lockedButton).toHaveProperty("disabled", true);
  expect(within(challenge).queryByRole("button", { name: /Start Challenge Mode|Continue week/ })).toBeNull();
  fireEvent.click(lockedButton);
  expect(useGame.getState().mode).toBe("campaign");
  expect(choices.textContent).not.toContain("switch between them at any time");
});

it("shows a Guided Mode run in progress beside Challenge Mode, and switches without losing the company", () => {
  unlock();
  saveGame(newGame(4, "campaign-in-progress"), 0, true);
  const choices = boot("campaign");
  const campaign = card(choices, "Guided Mode"), classic = card(choices, "Challenge Mode");
  expect(campaign.textContent).toContain("Last played");
  expect(campaign.textContent).toMatch(/Saved game\s*Chapter 1 of 6: Opening/);
  expect(within(campaign).getByRole("button", { name: "Continue company" })).toBeTruthy();
  expect(classic.textContent).toContain("No saved game");
  // Reading the other mode for its card must not write a Classic save.
  expect(localStorage.getItem("nn.classic.save.v1")).toBeNull();
  fireEvent.click(within(classic).getByRole("button", { name: "Start Challenge Mode" }));
  expect(useGame.getState()).toMatchObject({ mode: "classic", started: true });
  const kept = loadGame();
  expect(kept.status === "ok" && kept.game.campaign!.runId).toBe("campaign-in-progress");
});

it("shows a Challenge Mode run in progress beside Guided Mode, with the same card layout, and switches to the Guided Mode save", () => {
  saveGame(newGame(4, "waiting-campaign"), 0, true);
  saveClassicGame(advanceTurn(newLegacyGame(2)));
  const choices = boot("classic");
  const campaign = card(choices, "Guided Mode"), classic = card(choices, "Challenge Mode");
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

it("starts a new Challenge Mode game from a Guided Mode home screen when asked", () => {
  unlock();
  saveClassicGame(advanceTurn(newLegacyGame(2)));
  const choices = boot("campaign");
  const classic = card(choices, "Challenge Mode");
  expect(within(classic).getByRole("button", { name: "Continue week 2" })).toBeTruthy();
  fireEvent.click(within(classic).getByRole("button", { name: "New game" }));
  expect(useGame.getState()).toMatchObject({ mode: "classic", started: true });
  expect(useGame.getState().game.turn).toBe(1);
});

it("asks before switching away from a game that cannot be saved", () => {
  unlock();
  localStorage.setItem("nn.campaign.save.v1", "{");
  const choices = boot("campaign");
  fireEvent.click(within(card(choices, "Challenge Mode")).getByRole("button", { name: "Start Challenge Mode" }));
  expect(useGame.getState()).toMatchObject({ mode: "campaign", started: false });
  expect(screen.getByText(/switching now loses it/)).toBeTruthy();
  fireEvent.click(within(card(choices, "Challenge Mode")).getByRole("button", { name: "Switch and lose this run" }));
  expect(useGame.getState()).toMatchObject({ mode: "classic", started: true });
  expect(localStorage.getItem("nn.campaign.save.v1")).toBe("{");
});

describe("analytics consent", () => {
  it("offers the opt-in only until the player decides, persisting either way", () => {
    boot("campaign");
    const panel = screen.getByRole("region", { name: "Help improve 99.99%" });
    expect(panel.textContent).toContain("We never send account details, URLs, or saved games.");
    fireEvent.click(within(panel).getByRole("button", { name: "Allow anonymous analytics" }));
    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe("accepted");
    expect(screen.queryByRole("region", { name: "Help improve 99.99%" })).toBeNull();
    cleanup();
    boot("campaign");
    expect(screen.queryByRole("region", { name: "Help improve 99.99%" })).toBeNull();
  });

  it("remembers a decline too", () => {
    boot("campaign");
    fireEvent.click(screen.getByRole("button", { name: "No thanks" }));
    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe("declined");
    expect(screen.queryByRole("region", { name: "Help improve 99.99%" })).toBeNull();
  });
});
