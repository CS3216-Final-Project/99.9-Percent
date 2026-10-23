import { completeTutorialFixture } from "@/testing/tutorial";
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import App from "./App";
import { useGame } from "./game/store";
import { DEFAULT_META, saveMeta } from "./game/persist";
vi.mock("./components/scene/Facility", () => ({ default: () => <div data-testid="facility" /> }));
beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
it("lets new players compare both modes without starting a run for them", () => {
  vi.useFakeTimers();
  render(<StrictMode><App /></StrictMode>);
  const choices = screen.getByRole("region", { name: "Choose how you want to play" });
  const guided = within(choices).getByRole("region", { name: "Guided Mode" });
  const challenge = within(choices).getByRole("region", { name: "Challenge Mode" });
  expect(guided.textContent).toContain("six infrastructure chapters");
  expect(challenge.textContent).toContain("50,000 users in 26 weeks");
  expect(within(choices).getByRole("button", { name: "Start Guided Mode" })).toBeTruthy();
  // Challenge Mode is locked until Chapter 5 is complete, and its teaser has nothing to press.
  expect(challenge.textContent).toContain("Unlocks after Chapter 5: Stay Online.");
  expect(within(challenge).queryAllByRole("button")).toHaveLength(0);
  fireEvent.keyDown(window, { key: "p" });
  act(() => vi.advanceTimersByTime(5000));
  expect(useGame.getState().started).toBe(false);
  expect(useGame.getState().game.campaign!.step).toBe(0);
  expect(localStorage.getItem("nn.campaign.save.v1")).toBeNull();
  expect(localStorage.getItem("nn.classic.save.v1")).toBeNull();
  expect(useGame.getState().mode).toBe("campaign");
  expect(useGame.getState().started).toBe(false);
});

it("lets an unlocked profile start Challenge Mode straight from the title", () => {
  saveMeta({ ...DEFAULT_META, challengeUnlocked: true });
  render(<StrictMode><App /></StrictMode>);
  const choices = screen.getByRole("region", { name: "Choose how you want to play" });
  fireEvent.click(within(choices).getByRole("button", { name: "Start Challenge Mode" }));
  expect(useGame.getState().mode).toBe("classic");
  expect(useGame.getState().started).toBe(true);
  expect(useGame.getState().running).toBe(false);
  expect(useGame.getState().tour?.track).toBe("basics");
  expect(localStorage.getItem("nn.campaign.save.v1")).toBeNull();
  expect(localStorage.getItem("nn.mode.v1")).toBe("classic");
});

it("keeps the mode choice open when switching cannot preserve the stored save", () => {
  saveMeta({ ...DEFAULT_META, challengeUnlocked: true });
  localStorage.setItem("nn.campaign.save.v1", "{");
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Start Challenge Mode" }));
  expect(useGame.getState().started).toBe(false);
  expect(screen.getByRole("button", { name: "Switch and lose this run" })).toBeTruthy();
  expect(localStorage.getItem("nn.campaign.save.v1")).toBe("{");
  expect(localStorage.getItem("nn.classic.save.v1")).toBeNull();
});

it("shows the locked unlock prompt in the menu instead of a switch control", () => {
  render(<App />); fireEvent.click(screen.getByRole("button", { name: "Start Guided Mode" })); act(() => completeTutorialFixture());
  const menu = openMenu();
  const modeSection = within(menu).getByRole("region", { name: "Game mode" });
  expect(modeSection.textContent).toContain("Finish Chapter 5, Stay Online, in Guided Mode to unlock Challenge Mode.");
  const lockedButton = within(modeSection).getByRole("button", { name: "Finish Chapter 5 to unlock" });
  expect(lockedButton).toHaveProperty("disabled", true);
  fireEvent.click(lockedButton);
  expect(useGame.getState().mode).toBe("campaign");
});

it("keeps the pre-update save resumable only once Challenge Mode is unlocked", () => {
  localStorage.setItem("nn.save.v1", "{}");
  render(<App />); fireEvent.click(screen.getByRole("button", { name: "Start Guided Mode" })); act(() => completeTutorialFixture());
  const menu = openMenu();
  openTab(menu, "Saves");
  const legacy = within(menu).getByRole("group", { name: "Pre-update save" });
  expect(legacy.textContent).toContain("Finish Chapter 5, Stay Online, in Guided Mode to unlock Challenge Mode before resuming this save.");
  expect(within(legacy).getByRole("button", { name: "Resume pre-update save" })).toHaveProperty("disabled", true);
  expect(within(legacy).getByRole("button", { name: "Export pre-update save" })).toHaveProperty("disabled", false);
  act(() => saveMeta({ ...useGame.getState().meta, challengeUnlocked: true }));
  act(() => useGame.setState((s) => ({ meta: { ...s.meta, challengeUnlocked: true } })));
  expect(within(legacy).getByRole("button", { name: "Resume pre-update save" })).toHaveProperty("disabled", false);
});

describe("opening UI", () => {
  it("starts paused with immediate evidence and no later progression controls", async () => {
    render(<StrictMode><App /></StrictMode>); expect(await screen.findByTestId("facility")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start Guided Mode" })); act(() => completeTutorialFixture());
    expect(screen.getByRole("complementary", { name: "System metrics" })).toBeTruthy();
    // Tech and History wait in the bottom bar's view tabs, where Classic keeps them; later stage controls do not appear yet.
    expect(within(screen.getByRole("navigation", { name: "Views" })).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Tech", "History"]);
    expect(screen.queryByRole("region", { name: "Scaling controls" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Monitoring" }));
    expect(useGame.getState().game.campaign!.step).toBe(0);
    expect(useGame.getState().meta.runsStarted).toBe(1);
  });
  it("advances once and cleans up the shared clock on pause/unmount", () => {
    vi.useFakeTimers(); const view = render(<StrictMode><App /></StrictMode>);
    fireEvent.click(screen.getByRole("button", { name: "Start Guided Mode" })); act(() => completeTutorialFixture());
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    act(() => vi.advanceTimersByTime(1000)); expect(useGame.getState().game.campaign!.step).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    act(() => vi.advanceTimersByTime(5000)); expect(useGame.getState().game.campaign!.step).toBe(1);
    view.unmount(); act(() => vi.advanceTimersByTime(5000)); expect(useGame.getState().game.campaign!.step).toBe(1);
  });
  it("visible interventions lead to review and the same company", () => {
    vi.useFakeTimers(); render(<StrictMode><App /></StrictMode>); fireEvent.click(screen.getByRole("button", { name: "Start Guided Mode" })); act(() => completeTutorialFixture());
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    act(() => vi.advanceTimersByTime(6000));
    expect(useGame.getState().running).toBe(false);
    const id = useGame.getState().game.campaign!.runId;
    expect(screen.getByRole("heading", { name: "Recovery progress" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Guided Mode requirements" }).textContent).toContain("Chapter requirements");
    const recovery = screen.getByRole("region", { name: "Incident recovery" });
    expect(recovery.textContent).toContain("Latency below 500 ms");
    expect(recovery.textContent).toContain("Service errors below 1%");
    expect(recovery.textContent).toContain("Traffic is being accepted and requests are completing");
    fireEvent.click(screen.getByRole("button", { name: /Upgrade database/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    act(() => vi.advanceTimersByTime(8000));
    expect(screen.getByRole("dialog", { name: "System Recovered!" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "View Incident Report" }));
    expect(screen.getByRole("dialog", { name: "Incident postmortem" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continue company" })); fireEvent.click(screen.getByRole("button", { name: "Continue operating" }));
    expect(useGame.getState().game.phase).toBe("management"); expect(useGame.getState().running).toBe(false);
    expect(useGame.getState().game.campaign!.runId).toBe(id);
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    act(() => vi.advanceTimersByTime(46000));
    const c = useGame.getState().game.campaign!;
    expect(c.step).toBe(60); expect(c.settlements).toHaveLength(1);
    expect(c.trace.filter(e => e.type === "action-activated")).toHaveLength(1);
    expect(c.investedCents).toBe(300000);

  });
  it("hidden-page pause does not resume or catch up", () => {
    render(<App />); fireEvent.click(screen.getByRole("button", { name: "Start Guided Mode" })); act(() => completeTutorialFixture()); fireEvent.click(screen.getByRole("button", { name: "Run" }));
    Object.defineProperty(document, "hidden", { configurable: true, value: true }); fireEvent(document, new Event("visibilitychange"));
    expect(useGame.getState().running).toBe(false);
    Object.defineProperty(document, "hidden", { configurable: true, value: false }); fireEvent(document, new Event("visibilitychange"));
    expect(useGame.getState().running).toBe(false);
  });
});

it("offers the same mute control beside the menu in both modes", () => {
  saveMeta({ ...DEFAULT_META, challengeUnlocked: true });
  render(<App />); fireEvent.click(screen.getByRole("button", { name: "Start Guided Mode" })); act(() => completeTutorialFixture());
  const mute = screen.getByRole("button", { name: "Mute sound" });
  expect(mute.getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(mute); expect(mute.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Menu" }));
  fireEvent.click(screen.getByRole("tab", { name: "Sound" }));
  // The menu's mute is the same setting.
  expect(screen.getByRole("button", { name: "Mute all" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("tab", { name: "Run" }));
  fireEvent.click(screen.getByRole("button", { name: "Switch to Challenge Mode" }));
  const classicMute = screen.getByRole("button", { name: "Mute sound" });
  expect(classicMute.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(classicMute); expect(useGame.getState().audio.muted).toBe(false);
});

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Menu" }));
  return screen.getByRole("dialog", { name: "Menu" });
}
const openTab = (menu: HTMLElement, name: string) => fireEvent.click(within(menu).getByRole("tab", { name }));
const expectButtons = (menu: HTMLElement, names: string[]) => { for (const name of names) expect(within(menu).getByRole("button", { name })).toBeTruthy(); };

it("splits both menus into the same tabs and keeps every earlier control on one of them", () => {
  saveMeta({ ...DEFAULT_META, challengeUnlocked: true });
  render(<StrictMode><App /></StrictMode>); fireEvent.click(screen.getByRole("button", { name: "Start Guided Mode" })); act(() => completeTutorialFixture());
  const campaignMenu = openMenu();
  const labels = (menu: HTMLElement) => within(within(menu).getByRole("tablist", { name: "Menu sections" })).getAllByRole("tab").map((t) => t.textContent);
  expect(labels(campaignMenu)).toEqual(["Run", "Map", "Sound", "Graphics", "Controls", "Avatar", "Saves", "Account", "Playtest"]);
  // The summary stays above the tabs; matching action buttons live in Run.
  expect(within(campaignMenu).getByRole("tab", { name: "Run" }).getAttribute("aria-selected")).toBe("true");
  for (const tab of ["Run", "Map", "Sound", "Graphics", "Controls", "Avatar", "Saves", "Account", "Playtest"]) {
    openTab(campaignMenu, tab);
    expect(within(campaignMenu).getByRole("region", { name: "At a glance" })).toBeTruthy();
    expect(within(campaignMenu).queryByText(/Time is paused/)).toBeNull();
    expect(within(campaignMenu).queryByRole("button", { name: "Resume" }) !== null).toBe(tab === "Run");
  }
  openTab(campaignMenu, "Run");
  expectButtons(campaignMenu, ["Resume", "Save now", "How to play", "Exit", "Switch to Challenge Mode"]);
  expect(within(campaignMenu).queryByRole("button", { name: "Import save" })).toBeNull();
  openTab(campaignMenu, "Sound");
  fireEvent.change(within(campaignMenu).getByRole("slider", { name: "Music" }), { target: { value: "25" } });
  expect(useGame.getState().audio.music).toBe(25);
  openTab(campaignMenu, "Graphics");
  fireEvent.click(within(campaignMenu).getByRole("radio", { name: "Low" }));
  expect(useGame.getState().graphics.quality).toBe("low");
  openTab(campaignMenu, "Controls");
  fireEvent.change(within(campaignMenu).getByRole("slider", { name: "Look speed" }), { target: { value: "0.6" } });
  expect(useGame.getState().controls.lookSpeed).toBe(0.6);
  openTab(campaignMenu, "Saves");
  expectButtons(campaignMenu, ["New company", "Export current company", "Export original stored save", "Import save"]);
  // Cloud saves live in Saves; the Account tab keeps only sign-in and profile.
  expect(within(campaignMenu).getByRole("region", { name: "Cloud saves" })).toBeTruthy();
  openTab(campaignMenu, "Account");
  expect(within(campaignMenu).getByRole("region", { name: "Account" })).toBeTruthy();
  expect(within(campaignMenu).queryByRole("region", { name: "Cloud saves" })).toBeNull();
  openTab(campaignMenu, "Playtest");
  expectButtons(campaignMenu, ["Export playtest record"]);
  openTab(campaignMenu, "Run");
  fireEvent.click(within(campaignMenu).getByRole("button", { name: "Switch to Challenge Mode" }));

  const classicMenu = openMenu();
  expect(labels(classicMenu)).toEqual(["Run", "Map", "Sound", "Graphics", "Controls", "Avatar", "Saves", "Account", "Playtest"]);
  // The run summary stays above the tabs whichever one is open.
  for (const tab of ["Run", "Map", "Sound", "Graphics", "Controls", "Avatar", "Saves", "Account", "Playtest"]) {
    openTab(classicMenu, tab);
    expect(within(classicMenu).getByRole("region", { name: "At a glance" })).toBeTruthy();
    expect(within(classicMenu).queryByRole("button", { name: "Resume" }) !== null).toBe(tab === "Run");
  }
  openTab(classicMenu, "Run");
  expectButtons(classicMenu, ["Save now", "How to play", "Tutorial", "Switch to Guided Mode"]);
  fireEvent.click(within(classicMenu).getByRole("button", { name: "Save now" }));
  expect(screen.getByText("Saved", { exact: true })).toBeTruthy();
  expect(within(classicMenu).getByRole("region", { name: "Game mode" })).toBeTruthy();
  openTab(classicMenu, "Sound");
  expect(within(classicMenu).getByRole("slider", { name: "Music" }).getAttribute("aria-valuetext")).toBe("25%");
  expect(within(classicMenu).getByRole("region", { name: "Sound" })).toBeTruthy();
  // The look controls are shared between modes, like the sound.
  openTab(classicMenu, "Controls");
  expect(within(classicMenu).getByRole("slider", { name: "Look speed" }).getAttribute("aria-valuetext")).toBe("60 per cent");
  // Graphics is shared between modes too.
  openTab(classicMenu, "Graphics");
  expect(within(classicMenu).getByRole("radio", { name: "Low" })).toHaveProperty("checked", true);
  openTab(classicMenu, "Saves");
  expectButtons(classicMenu, ["New game", "Reset to first run", "Export current run", "Import save"]);
  for (const region of ["Save files", "Start over", "Cloud saves"]) expect(within(classicMenu).getByRole("region", { name: region })).toBeTruthy();
  expect(within(classicMenu).getAllByRole("textbox")).toHaveLength(1);
  openTab(classicMenu, "Account");
  expect(within(classicMenu).getByRole("region", { name: "Account" })).toBeTruthy();
  expect(within(classicMenu).queryByRole("region", { name: "Cloud saves" })).toBeNull();
  openTab(classicMenu, "Playtest");
  expect(within(classicMenu).getByRole("region", { name: "Playtest data" })).toBeTruthy();
});

it("lands the bankrupt company's menu on Saves, where Export and New company are", () => {
  render(<App />); fireEvent.click(screen.getByRole("button", { name: "Start Guided Mode" })); act(() => completeTutorialFixture());
  act(() => useGame.setState((s) => ({ game: { ...s.game, phase: "ended" } })));
  fireEvent.click(screen.getByRole("button", { name: "Export or start a new company" }));
  const menu = screen.getByRole("dialog", { name: "Menu" });
  expect(within(menu).getByRole("tab", { name: "Saves" }).getAttribute("aria-selected")).toBe("true");
  expectButtons(menu, ["Export current company", "New company"]);
});

it("forgets a pending Start over confirmation when the player leaves its tab", () => {
  saveMeta({ ...DEFAULT_META, challengeUnlocked: true });
  render(<App />); fireEvent.click(screen.getByRole("button", { name: "Start Guided Mode" })); act(() => completeTutorialFixture());
  fireEvent.click(within(openMenu()).getByRole("button", { name: "Switch to Challenge Mode" }));
  act(() => useGame.getState().advance());
  expect(useGame.getState().game.totals.weeks).toBeGreaterThan(0);
  const menu = openMenu();
  openTab(menu, "Saves");
  fireEvent.click(within(menu).getByRole("button", { name: "New game" }));
  // The run is under way, so the first press only asks.
  expect(within(menu).getByRole("button", { name: "Lose this run? Press again" })).toBeTruthy();
  expect(within(menu).getByText("Are you sure?")).toBeTruthy();
  const seed = useGame.getState().game.seed;
  openTab(menu, "Sound");
  openTab(menu, "Saves");
  expect(within(menu).queryByText("Are you sure?")).toBeNull();
  expect(within(menu).getByRole("button", { name: "New game" })).toBeTruthy();
  expect(useGame.getState().game.seed).toBe(seed);
});

it("opens Campaign's Tech and History in Classic's sheet from the bottom bar", () => {
  render(<App />); fireEvent.click(screen.getByRole("button", { name: "Start Guided Mode" })); act(() => completeTutorialFixture());
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole("button", { name: "Run" }));
  act(() => vi.advanceTimersByTime(1000));
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  const views = screen.getByRole("navigation", { name: "Views" });
  fireEvent.click(within(views).getByRole("button", { name: "History" }));
  const history = screen.getByRole("region", { name: "History" });
  expect(within(history).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Charts", "Events", "Incidents (0)"]);
  fireEvent.click(within(history).getByRole("tab", { name: "Events" }));
  expect(history.textContent).toMatch(/Game second \d+/);
  // Esc closes the sheet back to the room, as in Classic.
  fireEvent.keyDown(document.body, { key: "Escape" });
  expect(screen.queryByRole("region", { name: "History" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Run" }));
  fireEvent.click(within(views).getByRole("button", { name: "Tech" }));
  expect(screen.getByRole("region", { name: "Tech tree" }).querySelectorAll("[data-tech]")).toHaveLength(9);
  expect(within(views).getByRole("button", { name: "Tech" }).getAttribute("aria-pressed")).toBe("true");
  expect(useGame.getState().running).toBe(false);
});

it("asks once before New company replaces the campaign, as Classic's Start over does", () => {
  render(<App />); fireEvent.click(screen.getByRole("button", { name: "Start Guided Mode" })); act(() => completeTutorialFixture());
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole("button", { name: "Run" }));
  act(() => vi.advanceTimersByTime(1000));
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  const runId = useGame.getState().game.campaign!.runId;
  const menu = openMenu();
  openTab(menu, "Saves");
  fireEvent.click(within(menu).getByRole("button", { name: "New company" }));
  // The first press only asks.
  expect(useGame.getState().game.campaign!.step).toBe(1);
  expect(within(menu).getByText("Are you sure?")).toBeTruthy();
  fireEvent.click(within(menu).getByRole("button", { name: "Lose this company? Press again" }));
  expect(useGame.getState().game.campaign!.step).toBe(0);
  expect(useGame.getState().game.campaign!.runId).not.toBe(runId);
});


it("exits directly after saving the current progress and shows four matching Run actions", () => {
  render(<StrictMode><App /></StrictMode>);
  fireEvent.click(screen.getByRole("button", { name: "Start Guided Mode" }));
  act(() => completeTutorialFixture());
  const menu = openMenu();
  expect(within(within(menu).getByRole("group", { name: "Run" })).getAllByRole("button").map(button => button.textContent)).toEqual(["Resume", "Save now", "How to play", "Exit"]);
  fireEvent.click(within(menu).getByRole("button", { name: "Exit" }));
  expect(useGame.getState().started).toBe(false);
  expect(localStorage.getItem("nn.campaign.save.v1")).not.toBeNull();
  expect(screen.queryByRole("dialog", { name: "Exit without saving?" })).toBeNull();
});

it("keeps an unsaved run open through cancellation and failed save retries, then saves before exiting", () => {
  render(<StrictMode><App /></StrictMode>);
  fireEvent.click(screen.getByRole("button", { name: "Start Guided Mode" }));
  act(() => completeTutorialFixture());
  const menu = openMenu();
  const raw = localStorage.getItem("nn.campaign.save.v1");
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
  try {
    fireEvent.click(within(menu).getByRole("button", { name: "Exit" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(useGame.getState().started).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    const exit = screen.getByRole("button", { name: "Exit" });
    expect(document.activeElement).toBe(exit);
    expect(screen.getByText("Not saved", { exact: true })).toBeTruthy();
    fireEvent.click(exit);
    fireEvent.click(screen.getByRole("button", { name: "Save and exit" }));
    expect(screen.getByRole("dialog", { name: "Exit without saving?" })).toBeTruthy();
    expect(useGame.getState().started).toBe(true);
    expect(localStorage.getItem("nn.campaign.save.v1")).toBe(raw);
  } finally { write.mockRestore(); }
  fireEvent.click(screen.getByRole("button", { name: "Save and exit" }));
  expect(useGame.getState().started).toBe(false);
  expect(useGame.getState().saveStatus).toBe("saved");
});

it("requires explicit exit confirmation for a blocked save and preserves its original bytes", () => {
  localStorage.setItem("nn.campaign.save.v1", "{");
  render(<StrictMode><App /></StrictMode>);
  fireEvent.click(screen.getByRole("button", { name: "Start Guided Mode" }));
  act(() => completeTutorialFixture());
  const menu = openMenu();
  fireEvent.click(within(menu).getByRole("button", { name: "Exit" }));
  expect(useGame.getState().started).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Exit without saving" }));
  expect(useGame.getState().started).toBe(false);
  expect(localStorage.getItem("nn.campaign.save.v1")).toBe("{");
});


it("wraps the week clock without losing the total elapsed counter", () => {
  render(<App />);
  act(() => { useGame.getState().play(); completeTutorialFixture(); });
  act(() => {
    const game = structuredClone(useGame.getState().game);
    game.campaign!.step = 65; game.turn = 2;
    useGame.setState({ game, running: false });
  });
  expect(document.querySelector(".dock-second")?.textContent).toBe("5 / 60 s");
  expect(screen.getByTestId("physical-step").textContent).toBe("65");
  expect(screen.getByRole("progressbar", { name: "Operating week progress" }).getAttribute("aria-valuenow")).toBe("8");
  expect(document.querySelector(".week")?.textContent).toContain("Week 2");
});
