import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { DEFAULT_META, saveMeta } from "@/game/persist";
import { FULL_SCOPE, PHONE_SCOPE } from "@/game/scope";
import { useGame } from "@/game/store";
import { finishingScaling } from "@/sim/__tests__/dataFixture";
import { setEditionForTests } from "./edition";
import { PHONE_MENU_TABS } from "./PhoneMenu";

vi.mock("@/components/scene/Facility", () => ({ default: () => <div data-testid="facility" /> }));

beforeEach(() => {
  localStorage.clear();
  useGame.setState(useGame.getInitialState(), true);
  setEditionForTests("phone");
});
afterEach(() => {
  cleanup();
  setEditionForTests();
});

/** The phone shell loads in its own chunk, so its home screen appears once that has arrived. */
async function renderPhone() {
  render(<StrictMode><App /></StrictMode>);
  return screen.findByRole("region", { name: "Choose how you want to play" }, { timeout: 5000 });
}
function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Menu" }));
  return screen.getByRole("dialog", { name: "Menu" });
}
const desktopOnly = /sign in|account|your avatar|give feedback|playtest|saves/i;

describe("phone edition", () => {
  it("boots with the phone scope, marks the page and keeps the home screen to the modes and the analytics notice", async () => {
    const choices = await renderPhone();
    expect(useGame.getState().scope).toBe(PHONE_SCOPE);
    expect(document.documentElement.dataset.edition).toBe("phone");
    expect(document.querySelector('.app[data-edition="phone"]')).not.toBeNull();
    expect(screen.getByText("For the full experience, play on a laptop.")).toBeTruthy();

    const guided = within(choices).getByRole("region", { name: "Guided Mode" });
    expect(guided.textContent).toContain("Launch Week and 2 guided chapters");
    const challenge = within(choices).getByRole("region", { name: "Challenge Mode" });
    expect(challenge.textContent).toContain("Complete Scaling & Routing in Guided Mode to unlock.");
    expect(within(challenge).getByRole("button", { name: "Finish both guided chapters to unlock" })).toHaveProperty("disabled", true);

    const consent = screen.getByRole("region", { name: /Help improve/ });
    expect(within(consent).getByRole("button", { name: "OK" })).toBeTruthy();
    expect(within(consent).getByRole("button", { name: "Opt out" })).toBeTruthy();
    expect(screen.queryAllByRole("button", { name: desktopOnly })).toEqual([]);
  });

  it("offers only Sound and Graphics settings in the menu, with Resume and the mode switch", async () => {
    await renderPhone();
    fireEvent.click(screen.getByRole("button", { name: "Start Guided Mode" }));
    const menu = openMenu();
    expect(within(menu).getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Run", "Sound", "Graphics"]);
    expect(PHONE_MENU_TABS).toEqual(["run", "sound", "graphics"]);
    expect(within(menu).getByRole("button", { name: "Resume" })).toBeTruthy();
    expect(within(menu).queryByRole("button", { name: "Save now" })).toBeNull();
    expect(within(menu).queryAllByRole("button", { name: desktopOnly })).toEqual([]);
    const mode = within(menu).getByRole("region", { name: "Game mode" });
    expect(mode.textContent).toContain(PHONE_SCOPE.challengeLocked);

    fireEvent.click(within(menu).getByRole("tab", { name: "Sound" }));
    expect(within(menu).getByRole("tabpanel").textContent).toMatch(/Music/);
    fireEvent.click(within(menu).getByRole("tab", { name: "Graphics" }));
    expect(within(menu).getByRole("tabpanel").textContent).toMatch(/Quality/i);

    fireEvent.click(within(menu).getByRole("tab", { name: "Run" }));
    fireEvent.click(within(menu).getByRole("button", { name: "Resume" }));
    expect(screen.queryByRole("dialog", { name: "Menu" })).toBeNull();
  });

  it("ends Guided Mode after Scaling & Routing with the phone's own completion and opens Challenge Mode", async () => {
    await renderPhone();
    act(() => useGame.setState({ game: finishingScaling(), hasRun: true, started: true, onboarding: false, running: true, meta: { ...useGame.getState().meta, tutorialDone: true } }));
    act(() => useGame.getState().advance());
    const done = screen.getByRole("dialog", { name: "Phone campaign complete" });
    expect(done.textContent).toContain(PHONE_SCOPE.endOfGuided);
    expect(screen.queryByRole("dialog", { name: "Scaling & Routing complete" })).toBeNull();

    // Staying in the company offers no way into Data Strategy.
    fireEvent.click(within(done).getByRole("button", { name: "Keep operating" }));
    expect(screen.queryByRole("button", { name: /^Next:/ })).toBeNull();

    const menu = openMenu();
    expect(within(menu).getByText("Phone campaign complete")).toBeTruthy();
    fireEvent.click(within(within(menu).getByRole("region", { name: "Game mode" })).getByRole("button", { name: "Switch to Challenge Mode" }));
    expect(useGame.getState().mode).toBe("classic");
  });

  it("describes a finished phone company on the home screen and lets it start Challenge Mode", async () => {
    saveMeta({ ...DEFAULT_META, tutorialDone: true, challengeUnlocked: true });
    const choices = await renderPhone();
    act(() => useGame.setState({ game: finishingScaling(), hasRun: true }));
    act(() => { useGame.setState({ started: true }); useGame.getState().advance(); useGame.getState().endSession(); });
    expect(within(choices).getByRole("region", { name: "Guided Mode" }).textContent).toContain("Phone campaign complete");
    fireEvent.click(within(choices).getByRole("button", { name: "Start Challenge Mode" }));
    expect(useGame.getState().mode).toBe("classic");
    expect(useGame.getState().started).toBe(true);
  });
});

describe("desktop edition", () => {
  it("keeps the desktop shell, scope and home screen", () => {
    setEditionForTests("desktop");
    render(<App />);
    expect(useGame.getState().scope).toBe(FULL_SCOPE);
    expect(document.documentElement.dataset.edition).toBeUndefined();
    expect(document.querySelector("[data-edition]")).toBeNull();
    expect(screen.getByRole("region", { name: "Choose how you want to play" }).textContent).toContain("Unlocks after Chapter 5: Stay Online.");
    // The same check that finds nothing on the phone finds the desktop's account, avatar and feedback controls.
    expect(screen.queryAllByRole("button", { name: desktopOnly }).length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText(/play on a laptop/)).toBeNull();
  });
});
