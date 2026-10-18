import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { advanceTurn, newGame, newLegacyGame } from "@/sim";
import { advanceSteps } from "@/sim/step";
import { DEFAULT_META, loadClassicGame, loadGame, readAnalytics, saveClassicGame, saveGame, saveMeta, saveMode } from "@/game/persist";
import { decodeSave } from "@/game/saveEnvelope";
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

it("replays Guided Mode's walkthrough on a fresh practice company, preserving the saved company", () => {
  saveGame(advanceSteps(newGame(4, "replay-company"), 3).state, 0, true);
  let choices = boot("campaign");
  expect(within(card(choices, "Guided Mode")).queryByRole("button", { name: "Replay the tutorial" })).toBeNull();
  cleanup();
  useGame.setState(useGame.getInitialState(), true);
  saveMeta({ ...DEFAULT_META, tutorialDone: true });
  choices = boot("campaign");
  fireEvent.click(within(card(choices, "Guided Mode")).getByRole("button", { name: "Replay the tutorial" }));
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
  fireEvent.click(within(card(choices, "Guided Mode")).getByRole("button", { name: "Replay the tutorial" }));
  expect(useGame.getState()).toMatchObject({ mode: "campaign", started: true, tour: { track: "campaign", step: 0 } });
  expect(useGame.getState().tutorialCompany!.game.campaign!.runId).toBe("waiting-company");
  expect(useGame.getState().game.campaign!.step).toBe(0);
  expect(loadGame()).toMatchObject({ status: "ok", game: { campaign: { runId: "waiting-company", step: 3 } } });
  const kept = loadClassicGame();
  expect(kept.status === "ok" && kept.game.turn).toBe(2);
});

it("offers no Guided Mode walkthrough for a closed company, only playing again or reviewing it", () => {
  saveMeta({ ...DEFAULT_META, tutorialDone: true });
  saveMode("campaign");
  useGame.getState().boot();
  useGame.setState({ hasRun: true, game: { ...newGame(4, "closed-company"), phase: "ended", outcome: "bankrupt" } });
  render(<StrictMode><HomeScreen /></StrictMode>);
  const guided = card(screen.getByRole("region", { name: "Choose how you want to play" }), "Guided Mode");
  expect(guided.textContent).toContain("Company closed");
  expect(within(guided).queryByRole("button", { name: "Replay the tutorial" })).toBeNull();
  expect(within(guided).getAllByRole("button").map((b) => b.textContent)).toEqual(["Play again", "Review company"]);
});

describe("restarting Guided Mode", () => {
  const CLASSIC = "nn.classic.save.v1", CAMPAIGN = "nn.campaign.save.v1";
  /** A company played for a few steps and left with Save and exit, beside a Challenge Mode run. */
  function leftCompany(mode: "campaign" | "classic") {
    saveMeta({ ...DEFAULT_META, challengeUnlocked: true, tutorialDone: true });
    saveClassicGame(advanceTurn(newLegacyGame(2)));
    useGame.getState().boot(); useGame.getState().play();
    for (let i = 0; i < 3; i++) useGame.getState().advance();
    useGame.getState().endSession();
    const runId = useGame.getState().game.campaign!.runId;
    if (mode === "classic") { saveMode("classic"); useGame.setState(useGame.getInitialState(), true); useGame.getState().boot(); }
    render(<StrictMode><HomeScreen /></StrictMode>);
    return { runId, guided: card(screen.getByRole("region", { name: "Choose how you want to play" }), "Guided Mode") };
  }
  const press = (guided: HTMLElement, name: string) => fireEvent.click(within(guided).getByRole("button", { name }));
  const ARMED = "Lose this company? Press again";
  /** Makes the Challenge Mode slot refuse writes, as a full or blocked storage would. */
  const blockClassicSaves = () => {
    const setItem = Storage.prototype.setItem;
    return vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === CLASSIC) throw new Error("QuotaExceededError");
      setItem.call(this, key, value);
    });
  };

  it("offers no restart before there is a company", () => {
    const guided = card(boot("campaign"), "Guided Mode");
    expect(within(guided).getAllByRole("button").map((b) => b.textContent)).toEqual(["Start Guided Mode"]);
  });

  it("asks once, then replaces only the Guided Mode company and archives the old one", () => {
    const { runId, guided } = leftCompany("campaign");
    const classic = localStorage.getItem(CLASSIC);
    press(guided, "New company");
    // The first press only asks.
    expect(useGame.getState()).toMatchObject({ started: false, game: { campaign: { runId, step: 3 } } });
    expect(within(guided).getByText("Are you sure?")).toBeTruthy();
    // Screen readers hear the warning as soon as the button asks.
    expect(within(guided).getByRole("alert").textContent).toMatch(/replaces only your Guided Mode save/);
    expect(within(guided).getByRole("button", { name: ARMED }).textContent).toBe("Press again");
    press(guided, ARMED);
    const next = useGame.getState().game.campaign!;
    expect(useGame.getState()).toMatchObject({ mode: "campaign", started: true, hasRun: true });
    expect(next.runId).not.toBe(runId);
    expect(next.step).toBe(0);
    const saved = loadGame();
    expect(saved.status === "ok" && saved.game.campaign!.runId).toBe(next.runId);
    expect(localStorage.getItem(CLASSIC)).toBe(classic);
    expect(readAnalytics().find((e) => e.name === "run_reset")).toMatchObject({ runId, payload: { previousRunId: runId, replacementRunId: next.runId } });
  });

  it("restarts from a Challenge Mode home screen without resuming the old company or touching the Challenge Mode run", () => {
    const { runId, guided } = leftCompany("classic");
    const classic = loadClassicGame();
    press(guided, "New company");
    expect(useGame.getState().mode).toBe("classic");
    press(guided, "Lose this company? Press again");
    expect(useGame.getState()).toMatchObject({ mode: "campaign", started: true });
    expect(useGame.getState().game.campaign!.runId).not.toBe(runId);
    // Switching saves the departing run as it always does; its game is unchanged.
    expect(loadClassicGame()).toEqual(classic);
    expect(readAnalytics().find((e) => e.name === "run_reset")).toMatchObject({ runId, payload: { previousRunId: runId } });
  });

  it("keeps the question when the replacement is refused, so the next press tries again", () => {
    const { runId, guided } = leftCompany("campaign");
    const newRun = vi.fn(() => false);
    act(() => useGame.setState({ newRun }));
    press(guided, "New company");
    press(guided, ARMED);
    expect(newRun).toHaveBeenCalledOnce();
    expect(useGame.getState().game.campaign!.runId).toBe(runId);
    expect(within(guided).getByRole("button", { name: ARMED })).toBeTruthy();
    expect(within(guided).getByRole("alert")).toBeTruthy();
  });

  it("asks once more before a restart loses an unsaved Challenge Mode run, and only the restart goes ahead", () => {
    const { runId, guided } = leftCompany("classic");
    const blocked = blockClassicSaves();
    press(guided, "New company");
    press(guided, ARMED);
    expect(useGame.getState()).toMatchObject({ mode: "classic", started: false });
    expect(screen.getByText(/switching now loses it/)).toBeTruthy();
    // The card's main action still only continues; it does not borrow the restart's go-ahead.
    expect(within(guided).getByRole("button", { name: "Continue company" }).className).toContain("btn-primary");
    press(guided, ARMED);
    blocked.mockRestore();
    expect(useGame.getState()).toMatchObject({ mode: "campaign", started: true });
    expect(useGame.getState().game.campaign!.runId).not.toBe(runId);
  });

  it("does not let Continue inherit an unsaved-run go-ahead the restart asked for", () => {
    const { runId, guided } = leftCompany("classic");
    const blocked = blockClassicSaves();
    press(guided, "New company");
    press(guided, ARMED);
    press(guided, "Continue company");
    // Continuing is a different decision, so it asks for itself and the restart is dropped.
    expect(useGame.getState().mode).toBe("classic");
    expect(within(guided).queryByRole("button", { name: ARMED })).toBeNull();
    press(guided, "Switch and lose this run");
    blocked.mockRestore();
    expect(useGame.getState()).toMatchObject({ mode: "campaign", started: true, game: { campaign: { runId, step: 3 } } });
  });

  it("drops a pending restart when the player continues instead", () => {
    const { runId, guided } = leftCompany("campaign");
    press(guided, "New company");
    press(guided, "Continue company");
    expect(useGame.getState()).toMatchObject({ started: true, game: { campaign: { runId, step: 3 } } });
  });

  it("makes Play again the main action for a finished campaign, beside its review", () => {
    saveMeta({ ...DEFAULT_META, tutorialDone: true });
    useGame.getState().boot();
    const won = { ...newGame(4, "won-company"), phase: "ended" as const, outcome: "won" as const };
    useGame.setState({ hasRun: true, game: won });
    render(<StrictMode><HomeScreen /></StrictMode>);
    const guided = card(screen.getByRole("region", { name: "Choose how you want to play" }), "Guided Mode");
    expect(guided.textContent).toMatch(/Saved game\s*Campaign complete/);
    const [again, review] = within(guided).getAllByRole("button");
    expect([again.textContent, review.textContent]).toEqual(["Play again", "Review company"]);
    expect(again.className).toContain("btn-primary");
    // Focus starts on the safe action, so a held Enter cannot arm and confirm the restart in one go.
    expect(document.activeElement).toBe(review);
    press(guided, "Play again");
    expect(useGame.getState().game.campaign!.runId).toBe("won-company");
    expect(within(guided).getByRole("button", { name: ARMED }).textContent).toBe(ARMED);
    press(guided, ARMED);
    expect(useGame.getState()).toMatchObject({ started: true, game: { phase: "management", outcome: null } });
    expect(useGame.getState().game.campaign!.runId).not.toBe("won-company");
  });

  it("reviews a finished campaign without replacing it", () => {
    saveMeta({ ...DEFAULT_META, tutorialDone: true });
    useGame.getState().boot();
    useGame.setState({ hasRun: true, game: { ...newGame(4, "won-company"), phase: "ended", outcome: "won" } });
    render(<StrictMode><HomeScreen /></StrictMode>);
    press(card(screen.getByRole("region", { name: "Choose how you want to play" }), "Guided Mode"), "Review company");
    expect(useGame.getState()).toMatchObject({ started: true, game: { phase: "ended", campaign: { runId: "won-company" } } });
  });

  describe("export before restarting", () => {
    let files: { name: string; blob: Blob }[];
    beforeEach(() => {
      files = [];
      let blob: Blob | null = null;
      Object.assign(URL, { createObjectURL: (b: Blob) => { blob = b; return "blob:save"; }, revokeObjectURL: () => {} });
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { files.push({ name: this.download, blob: blob! }); });
    });
    afterEach(() => vi.restoreAllMocks());

    it("exports the stored company from a Challenge Mode home screen, and one more press still restarts", async () => {
      const { runId, guided } = leftCompany("classic");
      const stored = localStorage.getItem(CAMPAIGN);
      press(guided, "New company");
      press(guided, "Export company");
      expect(files.map((f) => f.name)).toEqual(["stored-campaign.json"]);
      expect(await files[0].blob.text()).toBe(stored);
      press(guided, "Lose this company? Press again");
      expect(useGame.getState().game.campaign!.runId).not.toBe(runId);
    });

    it("exports the loaded company from a Guided Mode home screen", async () => {
      const { runId, guided } = leftCompany("campaign");
      press(guided, "New company");
      press(guided, "Export company");
      expect(files.map((f) => f.name)).toEqual(["campaign.json"]);
      const exported = decodeSave(await files[0].blob.text());
      expect(exported.status === "ok" && exported.game.campaign).toMatchObject({ runId, step: 3 });
      expect(useGame.getState().started).toBe(false);
    });

    it("exports and replaces the player's company, not a Chapter 0 practice company it was left in", async () => {
      const { runId, guided } = leftCompany("campaign");
      act(() => useGame.getState().startTour("campaign", "home"));
      expect(useGame.getState().tutorialCompany!.game.campaign!.runId).toBe(runId);
      press(guided, "New company");
      press(guided, "Export company");
      const exported = decodeSave(await files[0].blob.text());
      expect(exported.status === "ok" && exported.game.campaign).toMatchObject({ runId, step: 3 });
      press(guided, ARMED);
      expect(useGame.getState().tutorialCompany).toBeNull();
      expect(readAnalytics().find((e) => e.name === "run_reset")).toMatchObject({ payload: { previousRunId: runId } });
    });

    it("says so when the stored company is gone by the time Export is pressed", () => {
      const { guided } = leftCompany("classic");
      press(guided, "New company");
      localStorage.removeItem(CAMPAIGN);
      press(guided, "Export company");
      expect(files).toEqual([]);
      expect(useGame.getState().toast).toMatchObject({ kind: "error", text: "There is no stored Guided Mode company to export." });
      expect(within(guided).getByRole("button", { name: ARMED })).toBeTruthy();
    });
  });
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
