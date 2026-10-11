import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import App from "./App";
import { useGame } from "./game/store";
vi.mock("./components/scene/Facility", () => ({ default: () => <div data-testid="facility" /> }));
beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe("opening UI", () => {
  it("starts paused with immediate evidence and no later progression controls", async () => {
    render(<StrictMode><App /></StrictMode>); expect(await screen.findByTestId("facility")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try Prototype" })); fireEvent.click(screen.getByRole("button", { name: "Skip introduction" }));
    expect(screen.getByRole("complementary", { name: "System metrics" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tech" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Monitoring" }));
    expect(useGame.getState().game.campaign!.step).toBe(0);
    expect(useGame.getState().meta.runsStarted).toBe(1);
  });
  it("advances once and cleans up the shared clock on pause/unmount", () => {
    vi.useFakeTimers(); const view = render(<StrictMode><App /></StrictMode>);
    fireEvent.click(screen.getByRole("button", { name: "Try Prototype" })); fireEvent.click(screen.getByRole("button", { name: "Skip introduction" }));
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    act(() => vi.advanceTimersByTime(1000)); expect(useGame.getState().game.campaign!.step).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    act(() => vi.advanceTimersByTime(5000)); expect(useGame.getState().game.campaign!.step).toBe(1);
    view.unmount(); act(() => vi.advanceTimersByTime(5000)); expect(useGame.getState().game.campaign!.step).toBe(1);
  });
  it("visible interventions lead to review and the same company", () => {
    vi.useFakeTimers(); render(<StrictMode><App /></StrictMode>); fireEvent.click(screen.getByRole("button", { name: "Try Prototype" })); fireEvent.click(screen.getByRole("button", { name: "Skip introduction" }));
    for (let i = 0; i < 6; i++)fireEvent.click(screen.getByRole("button", { name: "Advance step" }));
    const id = useGame.getState().game.campaign!.runId;
    expect(screen.getByText(/Stable steps: 0\/5/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Upgrade database/ }));
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    act(() => vi.advanceTimersByTime(8000));
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
    render(<App />); fireEvent.click(screen.getByRole("button", { name: "Try Prototype" })); fireEvent.click(screen.getByRole("button", { name: "Skip introduction" })); fireEvent.click(screen.getByRole("button", { name: "Run" }));
    Object.defineProperty(document, "hidden", { configurable: true, value: true }); fireEvent(document, new Event("visibilitychange"));
    expect(useGame.getState().running).toBe(false);
    Object.defineProperty(document, "hidden", { configurable: true, value: false }); fireEvent(document, new Event("visibilitychange"));
    expect(useGame.getState().running).toBe(false);
  });
});

it("offers the same mute control beside the menu in both modes", () => {
  render(<App />); fireEvent.click(screen.getByRole("button", { name: "Try Prototype" })); fireEvent.click(screen.getByRole("button", { name: "Skip introduction" }));
  const mute = screen.getByRole("button", { name: "Mute sound" });
  expect(mute.getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(mute); expect(mute.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Menu" }));
  fireEvent.click(screen.getByRole("tab", { name: "Sound" }));
  // The menu's mute is the same setting.
  expect(screen.getByRole("button", { name: "Mute all" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("tab", { name: "Run" }));
  fireEvent.click(screen.getByRole("button", { name: "Switch to Classic" }));
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
  render(<StrictMode><App /></StrictMode>); fireEvent.click(screen.getByRole("button", { name: "Try Prototype" })); fireEvent.click(screen.getByRole("button", { name: "Skip introduction" }));
  const campaignMenu = openMenu();
  const labels = (menu: HTMLElement) => within(within(menu).getByRole("tablist", { name: "Menu sections" })).getAllByRole("tab").map((t) => t.textContent);
  expect(labels(campaignMenu)).toEqual(["Run", "Sound", "Graphics", "Saves", "Playtest"]);
  // The paused notice stays above the tabs; the Run tab opens first and shows only its own sections.
  expect(within(campaignMenu).getByText("Time is paused")).toBeTruthy();
  expect(within(campaignMenu).getByRole("tab", { name: "Run" }).getAttribute("aria-selected")).toBe("true");
  expectButtons(campaignMenu, ["Save now", "Replay introduction", "Save and exit to title", "Switch to Classic"]);
  expect(within(campaignMenu).queryByRole("button", { name: "Import save" })).toBeNull();
  openTab(campaignMenu, "Sound");
  fireEvent.change(within(campaignMenu).getByRole("slider", { name: "Music" }), { target: { value: "25" } });
  expect(useGame.getState().audio.music).toBe(25);
  openTab(campaignMenu, "Graphics");
  fireEvent.click(within(campaignMenu).getByRole("radio", { name: "Low" }));
  expect(useGame.getState().graphics.quality).toBe("low");
  openTab(campaignMenu, "Saves");
  expectButtons(campaignMenu, ["New company", "Export current company", "Export original stored save", "Import save"]);
  openTab(campaignMenu, "Playtest");
  expectButtons(campaignMenu, ["Export playtest record"]);
  openTab(campaignMenu, "Run");
  fireEvent.click(within(campaignMenu).getByRole("button", { name: "Switch to Classic" }));

  const classicMenu = openMenu();
  expect(labels(classicMenu)).toEqual(["Run", "Sound", "Graphics", "Saves", "Playtest"]);
  // The run summary and Resume stay above the tabs whichever one is open.
  for (const tab of ["Run", "Sound", "Graphics", "Saves", "Playtest"]) {
    openTab(classicMenu, tab);
    expect(within(classicMenu).getByRole("region", { name: "This run" })).toBeTruthy();
    expect(within(classicMenu).getByRole("button", { name: "Resume" })).toBeTruthy();
  }
  openTab(classicMenu, "Run");
  expectButtons(classicMenu, ["Save now", "How to play", "Tutorial", "Switch to Campaign"]);
  expect(within(classicMenu).getByRole("region", { name: "Game mode" })).toBeTruthy();
  openTab(classicMenu, "Sound");
  expect(within(classicMenu).getByRole("slider", { name: "Music" }).getAttribute("aria-valuetext")).toBe("25%");
  expect(within(classicMenu).getByRole("region", { name: "Sound" })).toBeTruthy();
  // Graphics is shared between modes too.
  openTab(classicMenu, "Graphics");
  expect(within(classicMenu).getByRole("radio", { name: "Low" })).toHaveProperty("checked", true);
  openTab(classicMenu, "Saves");
  expectButtons(classicMenu, ["New game", "Reset to first run", "Export current run", "Import save"]);
  for (const region of ["Save files", "Start over"]) expect(within(classicMenu).getByRole("region", { name: region })).toBeTruthy();
  expect(within(classicMenu).getAllByRole("textbox")).toHaveLength(1);
  openTab(classicMenu, "Playtest");
  expect(within(classicMenu).getByRole("region", { name: "Playtest data" })).toBeTruthy();
});

it("lands the bankrupt company's menu on Saves, where Export and New company are", () => {
  render(<App />); fireEvent.click(screen.getByRole("button", { name: "Try Prototype" })); fireEvent.click(screen.getByRole("button", { name: "Skip introduction" }));
  act(() => useGame.setState((s) => ({ game: { ...s.game, phase: "ended" } })));
  fireEvent.click(screen.getByRole("button", { name: "Export or start a new company" }));
  const menu = screen.getByRole("dialog", { name: "Menu" });
  expect(within(menu).getByRole("tab", { name: "Saves" }).getAttribute("aria-selected")).toBe("true");
  expectButtons(menu, ["Export current company", "New company"]);
});

it("forgets a pending Start over confirmation when the player leaves its tab", () => {
  render(<App />); fireEvent.click(screen.getByRole("button", { name: "Try Prototype" })); fireEvent.click(screen.getByRole("button", { name: "Skip introduction" }));
  fireEvent.click(within(openMenu()).getByRole("button", { name: "Switch to Classic" }));
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
