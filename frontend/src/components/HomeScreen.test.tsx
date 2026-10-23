import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { advanceTurn, newGame, newLegacyGame } from "@/sim";
import { advanceSteps } from "@/sim/step";
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
  expect(guided.textContent).toContain("six infrastructure chapters");
  // The locked teaser names the goal in words and has nothing to press.
  expect(challenge.textContent).toContain("Grow to 50,000 users in 26 weeks on your own.");
  expect(challenge.textContent).toContain("Unlocks after Chapter 5: Stay Online.");
  expect(challenge.textContent).not.toContain("You are on Chapter");
  expect(within(challenge).queryAllByRole("button")).toHaveLength(0);
  expect(useGame.getState().mode).toBe("campaign");
  expect(choices.textContent).not.toContain("switch between them at any time");
});

it("shows a Guided Mode run in progress beside Challenge Mode, and switches without losing the company", () => {
  saveMeta({ ...DEFAULT_META, challengeUnlocked: true, tutorialDone: true });
  saveGame(newGame(4, "campaign-in-progress"), 0, true);
  const choices = boot("campaign");
  const campaign = card(choices, "Guided Mode"), classic = card(choices, "Challenge Mode");
  expect(campaign.textContent).toContain("Last played");
  expect(campaign.textContent).toMatch(/Saved game\s*Chapter 1 of 6: Opening/);
  expect(campaign.textContent).toContain("Work through six infrastructure chapters at your own pace.");
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
  // The walkthrough has not finished, so the company is still in Chapter 0.
  expect(campaign.textContent).toMatch(/Saved game\s*Walkthrough in progress/);
  expect(campaign.textContent).toContain("Finish the walkthrough");
  expect(campaign.textContent).not.toContain("Last played");
  fireEvent.click(within(campaign).getByRole("button", { name: "Continue company" }));
  expect(useGame.getState()).toMatchObject({ mode: "campaign", started: true, hasRun: true });
  expect(useGame.getState().game.campaign!.runId).toBe("waiting-campaign");
  const kept = loadClassicGame();
  expect(kept.status === "ok" && kept.game.turn).toBe(2);
});

it("names the chapter that unlocks Challenge Mode and how far the Guided Mode company has come", () => {
  saveMeta({ ...DEFAULT_META, tutorialDone: true });
  saveGame(newGame(4, "campaign-locked"), 0, true);
  const challenge = card(boot("campaign"), "Challenge Mode");
  expect(challenge.textContent).toContain("Unlocks after Chapter 5: Stay Online. You are on Chapter 1 of 6.");
  expect(within(challenge).queryAllByRole("button")).toHaveLength(0);
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

it("replays Guided Mode's walkthrough on a fresh practice company, preserving the saved company", () => {
  saveGame(advanceSteps(newGame(4, "replay-company"), 3).state, 0, true);
  let choices = boot("campaign");
  expect(within(card(choices, "Guided Mode")).queryByRole("button", { name: "Replay walkthrough" })).toBeNull();
  cleanup();
  useGame.setState(useGame.getInitialState(), true);
  saveMeta({ ...DEFAULT_META, tutorialDone: true });
  choices = boot("campaign");
  fireEvent.click(within(card(choices, "Guided Mode")).getByRole("button", { name: "Replay walkthrough" }));
  expect(useGame.getState()).toMatchObject({ mode: "campaign", started: true, tour: { track: "campaign", step: 0 } });
  expect(useGame.getState().game.campaign!.step).toBe(0);
  expect(useGame.getState().tutorialCompany!.game.campaign).toMatchObject({ runId: "replay-company", step: 3 });
  expect(loadGame()).toMatchObject({ status: "ok", game: { campaign: { runId: "replay-company", step: 3 } } });
});

it("replays Guided Mode's walkthrough from a Challenge Mode home screen, keeping both saves", () => {
  saveMeta({ ...DEFAULT_META, challengeUnlocked: true, tutorialDone: true });
  saveGame(advanceSteps(newGame(4, "waiting-company"), 3).state, 0, true);
  saveClassicGame(advanceTurn(newLegacyGame(2)));
  saveMode("classic");
  useGame.getState().boot();
  render(<StrictMode><HomeScreen /></StrictMode>);
  const choices = screen.getByRole("region", { name: "Choose how you want to play" });
  fireEvent.click(within(card(choices, "Guided Mode")).getByRole("button", { name: "Replay walkthrough" }));
  expect(useGame.getState()).toMatchObject({ mode: "campaign", started: true, tour: { track: "campaign", step: 0 } });
  expect(useGame.getState().tutorialCompany!.game.campaign!.runId).toBe("waiting-company");
  expect(useGame.getState().game.campaign!.step).toBe(0);
  expect(loadGame()).toMatchObject({ status: "ok", game: { campaign: { runId: "waiting-company", step: 3 } } });
  const kept = loadClassicGame();
  expect(kept.status === "ok" && kept.game.turn).toBe(2);
});

it("offers no Guided Mode walkthrough for a closed company", () => {
  saveMeta({ ...DEFAULT_META, tutorialDone: true });
  saveMode("campaign");
  useGame.getState().boot();
  useGame.setState({ hasRun: true, game: { ...newGame(4, "closed-company"), phase: "ended", outcome: "bankrupt" } });
  render(<StrictMode><HomeScreen /></StrictMode>);
  const guided = card(screen.getByRole("region", { name: "Choose how you want to play" }), "Guided Mode");
  expect(guided.textContent).toContain("Company closed");
  expect(within(guided).queryByRole("button", { name: "Replay walkthrough" })).toBeNull();
  // A closed company has nothing to continue: it can show its final report or make way for a new company.
  expect(within(guided).queryByRole("button", { name: "Continue company" })).toBeNull();
  expect(within(guided).getByRole("button", { name: "See how it ended" })).toBeTruthy();
  fireEvent.click(within(guided).getByRole("button", { name: "New company" }));
  expect(useGame.getState().game).toMatchObject({ phase: expect.not.stringMatching("ended") });
  expect(useGame.getState().game.campaign!.runId).not.toBe("closed-company");
});

it("names a finished Guided Mode company as complete, not closed", () => {
  saveMeta({ ...DEFAULT_META, tutorialDone: true });
  saveMode("campaign");
  useGame.getState().boot();
  useGame.setState({ hasRun: true, game: { ...newGame(4, "won-company"), phase: "ended", outcome: "won" } });
  render(<StrictMode><HomeScreen /></StrictMode>);
  const guided = card(screen.getByRole("region", { name: "Choose how you want to play" }), "Guided Mode");
  expect(guided.textContent).toMatch(/Saved game\s*All chapters complete/);
});

it("asks before switching away from a game that cannot be saved", () => {
  unlock();
  localStorage.setItem("nn.campaign.save.v1", "{");
  const choices = boot("campaign");
  fireEvent.click(within(card(choices, "Challenge Mode")).getByRole("button", { name: "Start Challenge Mode" }));
  expect(useGame.getState()).toMatchObject({ mode: "campaign", started: false });
  // The warning sits in the card that asked, and names the button rather than its colour.
  expect(within(card(choices, "Challenge Mode")).getByRole("alert").textContent).toContain('Press "Switch and lose this run" again to switch anyway');
  fireEvent.click(within(card(choices, "Challenge Mode")).getByRole("button", { name: "Switch and lose this run" }));
  expect(useGame.getState()).toMatchObject({ mode: "classic", started: true });
  expect(localStorage.getItem("nn.campaign.save.v1")).toBe("{");
});

describe("analytics consent", () => {
  it("shows the notice only until the player confirms it, persisting the choice", () => {
    boot("campaign");
    const panel = screen.getByRole("region", { name: "Help improve 99.99%" });
    expect(panel.textContent).toContain("We never send account details, URLs, or saved games.");
    expect(panel.textContent).toContain("If you would rather not share, press Opt out.");
    fireEvent.click(within(panel).getByRole("button", { name: "OK" }));
    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe("accepted");
    expect(screen.queryByRole("region", { name: "Help improve 99.99%" })).toBeNull();
    cleanup();
    boot("campaign");
    expect(screen.queryByRole("region", { name: "Help improve 99.99%" })).toBeNull();
  });

  it("remembers an opt-out too", () => {
    boot("campaign");
    fireEvent.click(screen.getByRole("button", { name: "Opt out" }));
    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe("declined");
    expect(screen.queryByRole("region", { name: "Help improve 99.99%" })).toBeNull();
  });
});
