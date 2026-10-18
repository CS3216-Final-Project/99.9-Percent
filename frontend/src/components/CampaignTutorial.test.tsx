import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGame, WALKTHROUGH_STEPS } from "@/game/store";
import { CampaignHeader, CampaignPanel, CampaignControls, CampaignOverlays } from "./CampaignUI";
import Tutorial, { BASICS_STEPS, CAMPAIGN_STEPS } from "./Tutorial";
import { reliabilityCompany } from "@/sim/__tests__/reliabilityFixture";
import { saveGame, saveMeta, DEFAULT_META } from "@/game/persist";
import { newGame } from "@/sim";
import { advanceSteps } from "@/sim/step";

beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function start() { useGame.getState().boot(); useGame.getState().play(); }
function renderCompany() { return render(<><CampaignHeader /><CampaignPanel /><CampaignControls /><CampaignOverlays /><Tutorial /></>); }
const card = (step: number) => screen.getByRole("dialog", { name: `Tutorial, step ${step} of ${CAMPAIGN_STEPS}` });
const current = () => within(screen.getByRole("dialog", { name: /^Tutorial/ }));
const next = () => fireEvent.click(current().getByRole("button", { name: "Next" }));
function exercise() {
  const step = useGame.getState().tour!.step;
  const panel = within(screen.getByRole("complementary", { name: "System metrics" }));
  if (step === 0) fireEvent.click(panel.getByRole("button", { name: "App Server" }));
  if (step === 1) fireEvent.click(panel.getByRole("button", { name: "Database" }));
  if (step === 2) { fireEvent.click(panel.getByRole("button", { name: "App Server" })); fireEvent.click(panel.getByRole("button", { name: "Database" })); }
  if (step === 5) { fireEvent.click(screen.getByRole("button", { name: "Run" })); act(() => useGame.getState().tick(20)); }
  if (step === 6) fireEvent.click(panel.getByRole("button", { name: /^Add server/ }));
  if (step === 7) fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  if (step === 11) {
    fireEvent.click(document.querySelector(".time-menu > summary")!);
    fireEvent.click(within(screen.getByRole("group", { name: "Game speed" })).getByRole("button", { name: useGame.getState().speed === 2 ? "1×" : "2×" }));
    fireEvent.click(document.querySelector(".time-menu > summary")!);
  }
  if (step === 13 || step === 14) {
    fireEvent.click(screen.getByRole("button", { name: step === 13 ? "Tech" : "History" }));
    fireEvent.click(within(screen.getByRole("region", { name: step === 13 ? "Tech tree" : "History" })).getByRole("button", { name: "Close" }));
  }
  if (step === 15) {
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Menu" })).getByRole("button", { name: /Save now/ }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Menu" })).getByRole("button", { name: "Resume" }));
  }
}
function reach(step: number) { let attempts = 0; while (useGame.getState().tour!.step < step - 1) { if (++attempts > 30) throw new Error("Tutorial did not advance"); exercise(); next(); } }

it("requires inspection through real game controls and lets focus leave the nonmodal guide", () => {
  start(); renderCompany();
  expect(card(1).getAttribute("aria-modal")).toBe("false");
  expect(current().queryByRole("button", { name: "Skip" })).toBeNull();
  expect(current().queryByRole("button", { name: "Return to game" })).toBeNull();
  expect(current().queryByRole("button", { name: /Inspect|demo|Preview/ })).toBeNull();
  expect(current().getByRole("button", { name: "Back" })).toHaveProperty("disabled", true);
  expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", true);
  fireEvent.keyDown(current().getByRole("heading", { name: "Meet your system" }), { key: "Tab" });
  expect(document.activeElement).toBe(within(screen.getByRole("complementary", { name: "System metrics" })).getByRole("button", { name: "App Server" }));
  next(); expect(card(1)).toBeTruthy(); exercise();
  expect(useGame.getState().selected).toBe("app");
  expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", false);
  next(); expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", true);
  exercise(); expect(useGame.getState().selected).toBe("db");
});

it("requires a fresh comparison of both live components in lesson three without advancing time", () => {
  start(); renderCompany(); reach(3);
  const before = structuredClone(useGame.getState().game.campaign!);
  const panel = within(screen.getByRole("complementary", { name: "System metrics" }));
  const forward = () => current().getByRole("button", { name: "Next" });
  expect(forward()).toHaveProperty("disabled", true);
  fireEvent.click(panel.getByRole("button", { name: "Database" }));
  expect(forward()).toHaveProperty("disabled", true);
  fireEvent.click(panel.getByRole("button", { name: "App Server" }));
  expect(forward()).toHaveProperty("disabled", true);
  fireEvent.click(panel.getByRole("button", { name: "Database" }));
  expect(forward()).toHaveProperty("disabled", false);
  const rows = current().getByRole("figure").querySelectorAll("dl > div");
  expect(rows).toHaveLength(2);
  expect(rows[0].textContent).toContain("Demand");
  expect(rows[1].textContent).toContain("Capacity");
  const after = useGame.getState().game.campaign!;
  expect([after.step, after.cashCents, after.snapshot, after.pending]).toEqual([before.step, before.cashCents, before.snapshot, before.pending]);
});

it("runs exactly one real second even with a large tick, and cancels the real company's quote without spending", () => {
  start(); renderCompany(); const before = structuredClone(useGame.getState().game.campaign!);
  reach(6); exercise();
  expect(useGame.getState()).toMatchObject({ running: false, game: { campaign: { step: 1 } } });
  act(() => { useGame.getState().setRunning(true); useGame.getState().tick(20); });
  expect(useGame.getState().game.campaign!.step).toBe(1);
  next(); expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", true);
  exercise(); expect(screen.getByRole("region", { name: "Confirm Add server" })).toBeTruthy();
  next(); expect(card(8)).toBeTruthy(); expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", true);
  exercise(); expect(screen.queryByRole("region", { name: "Confirm Add server" })).toBeNull();
  const c = useGame.getState().game.campaign!;
  expect([c.cashCents, c.apps, c.actions, c.pending]).toEqual([before.cashCents, before.apps, before.actions, before.pending]);
});

it("keeps the quote open until the Cancel lesson and never permits a tutorial purchase", () => {
  start(); renderCompany(); reach(7); exercise();
  const cash = useGame.getState().game.campaign!.cashCents;
  expect(screen.getByRole("button", { name: "Confirm" })).toHaveProperty("disabled", true);
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveProperty("disabled", true);
  fireEvent.keyDown(screen.getByRole("region", { name: "Confirm Add server" }), { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "Menu" }));
  expect(screen.getByRole("region", { name: "Confirm Add server" })).toBeTruthy();
  expect(useGame.getState().view).toBe("menu");
  fireEvent.click(within(screen.getByRole("dialog", { name: "Menu" })).getByRole("button", { name: "Resume" }));
  expect(useGame.getState().view).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Confirm" })); next();
  expect(card(8)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveProperty("disabled", false);
  expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", true);
  fireEvent.click(screen.getByRole("button", { name: /^Limit to 500/ }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", false);
  expect(useGame.getState().game.campaign!.cashCents).toBe(cash);
});

it("keeps Menu and its settings usable during inspection while locking unrelated game controls", () => {
  start(); const rendered = renderCompany();
  const menu = screen.getByRole("button", { name: "Menu" });
  const db = within(screen.getByRole("complementary", { name: "System metrics" })).getByRole("button", { name: "Database" });
  expect(menu.getAttribute("aria-disabled")).not.toBe("true");
  expect(menu.getAttribute("tabindex")).not.toBe("-1");
  fireEvent.click(menu);
  const dialog = within(screen.getByRole("dialog", { name: "Menu" }));
  expect(dialog.queryByRole("button", { name: "Return to game" })).toBeNull();
  fireEvent.click(dialog.getByRole("tab", { name: "Sound" }));
  const mute = dialog.getByRole("button", { name: "Mute all" });
  fireEvent.click(mute);
  expect(useGame.getState().audio.muted).toBe(true);
  fireEvent.keyDown(mute, { key: "Escape" });
  fireEvent.click(db);
  expect(useGame.getState()).toMatchObject({ view: null, selected: null });
  expect(db.getAttribute("aria-disabled")).toBe("true");
  expect(db.getAttribute("tabindex")).toBe("-1");
  rendered.unmount();
  expect(db.hasAttribute("aria-disabled")).toBe(false);
  expect(db.hasAttribute("tabindex")).toBe(false);
});

it("restores a real quote when resuming directly into the Cancel lesson", () => {
  saveMeta({ ...DEFAULT_META, walkthroughStep: 7, walkthroughFurthestStep: 7 });
  start(); act(() => useGame.getState().goToFloor("office", "menu")); renderCompany();
  expect(card(8)).toBeTruthy();
  expect(screen.getByRole("region", { name: "Confirm Add server" })).toBeTruthy();
  expect(useGame.getState().floor).toBe("servers");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", false);
});

it("opens and closes real Tech, History and Menu views while keeping guidance visible", () => {
  start(); renderCompany(); reach(14); exercise();
  expect(card(14)).toBeTruthy(); expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", false);
  next(); exercise(); next(); exercise();
  expect(useGame.getState().toast?.text).toBe("Saved");
  expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", false);
});

it("goes Back without forcing completed interactions again and preserves the lesson on reload", () => {
  start(); renderCompany(); reach(3); fireEvent.click(current().getByRole("button", { name: "Back" }));
  expect(card(2)).toBeTruthy(); expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", false);
  cleanup(); useGame.setState(useGame.getInitialState(), true); start(); renderCompany();
  expect(card(2)).toBeTruthy(); expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", false);
});

it("How to play clears previous exercise completion, including a restart on lesson one", () => {
  start(); renderCompany(); reach(3);
  const before = structuredClone(useGame.getState().game.campaign!);
  // Restart is a store action; unrelated Menu controls are locked during an active lesson.
  const replay = () => act(() => useGame.getState().startTour("campaign"));
  replay();
  expect(card(1).textContent).not.toContain("Completed earlier");
  expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", true);
  expect(useGame.getState().meta.walkthroughFurthestStep).toBe(0);
  expect(useGame.getState().game.campaign).toEqual(before);
  exercise(); expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", false);
  replay();
  expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", true);
  expect(card(1).textContent).not.toContain("Completed earlier");
  cleanup(); useGame.setState(useGame.getInitialState(), true); start(); renderCompany();
  expect(card(1)).toBeTruthy();
  expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", true);
});

it.each([false, true])("teaches save failure without trapping a player, practice=%s", practice => {
  if (practice) saveMeta({ ...DEFAULT_META, tutorialDone: true });
  start();
  if (practice) useGame.getState().startTour("campaign");
  renderCompany(); reach(16);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage blocked"); });
  exercise();
  expect(useGame.getState().toast?.text).toBe("Could not save: browser storage is unavailable.");
  expect(card(16).textContent).toContain("Browser storage is unavailable");
  expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", false);
});

it("cannot skip or finish early, holds the clock outside its Run lesson, and completes only on Finish", () => {
  start(); renderCompany();
  act(() => { useGame.getState().endTour(false); useGame.getState().endTour(true); useGame.getState().setRunning(true); useGame.getState().tick(20); });
  expect(card(1)).toBeTruthy(); expect(useGame.getState().game.campaign!.step).toBe(0);
  reach(21);
  act(() => { useGame.getState().setRunning(true); useGame.getState().advance(); });
  expect(useGame.getState()).toMatchObject({ running: false, meta: { tutorialDone: false }, game: { campaign: { step: 1 } } });
  fireEvent.click(current().getByRole("button", { name: "Finish Chapter 0" }));
  expect(useGame.getState().meta.tutorialDone).toBe(true);
});

it("saves and exits unfinished and resumes the same company at its saved lesson", () => {
  start(); renderCompany(); reach(9); const runId = useGame.getState().game.campaign!.runId;
  expect(current().queryByRole("button", { name: "Save and exit" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Menu" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Menu" })).getByRole("button", { name: "Save and exit" }));
  expect(useGame.getState().meta.tutorialDone).toBe(false);
  cleanup(); useGame.setState(useGame.getInitialState(), true); start(); renderCompany();
  expect(card(9)).toBeTruthy(); expect(useGame.getState().game.campaign!.runId).toBe(runId);
});

it("preserves existing completed profiles", () => {
  saveMeta({ ...DEFAULT_META, tutorialDone: true }); start(); renderCompany();
  expect(screen.queryByRole("dialog", { name: /^Tutorial/ })).toBeNull();
});

it("exits a completed player's replay without finishing the lessons or buying the practice quote", () => {
  saveMeta({ ...DEFAULT_META, tutorialDone: true }); start();
  const company = structuredClone(useGame.getState().game.campaign!);
  useGame.getState().startTour("campaign"); renderCompany(); reach(7); exercise();
  fireEvent.click(current().getByRole("button", { name: "Return to game" }));
  expect(screen.queryByRole("dialog", { name: /^Tutorial/ })).toBeNull();
  expect(screen.queryByRole("region", { name: "Confirm Add server" })).toBeNull();
  expect(screen.getByRole("button", { name: "Run" })).toHaveProperty("disabled", false);
  expect(useGame.getState()).toMatchObject({ running: false, meta: { tutorialDone: true, walkthroughStep: null } });
  expect(useGame.getState().game.campaign).toEqual(company);
  cleanup(); useGame.setState(useGame.getInitialState(), true); start(); renderCompany();
  expect(screen.queryByRole("dialog", { name: /^Tutorial/ })).toBeNull();
});

it("returns from practice through Menu after reload without changing the saved company", () => {
  const game = advanceSteps(newGame(1, "return-from-menu"), 6).state;
  saveGame(game);
  saveMeta({ ...DEFAULT_META, tutorialDone: true }); start();
  const company = structuredClone(useGame.getState().game.campaign!);
  useGame.getState().startTour("campaign"); renderCompany(); reach(8);
  cleanup(); useGame.setState(useGame.getInitialState(), true); start(); renderCompany();
  expect(card(8)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Menu" }));
  const menu = within(screen.getByRole("dialog", { name: "Menu" }));
  expect(menu.getByRole("region", { name: "Chapter 0 practice" })).toBeTruthy();
  fireEvent.click(menu.getByRole("tab", { name: "Graphics" }));
  fireEvent.click(menu.getByRole("button", { name: "Return to game" }));
  expect(useGame.getState()).toMatchObject({ running: false, tour: null, tutorialCompany: null, view: null });
  expect(useGame.getState().game.campaign).toEqual(company);
  expect(screen.queryByRole("dialog", { name: /^Tutorial/ })).toBeNull();
  expect(screen.queryByRole("region", { name: "Confirm Add server" })).toBeNull();
  expect(localStorage.getItem("nn.campaign.tutorial.v1")).toBeNull();
  cleanup(); useGame.setState(useGame.getInitialState(), true); start(); renderCompany();
  expect(useGame.getState().game.campaign).toEqual(company);
  expect(screen.queryByRole("dialog", { name: /^Tutorial/ })).toBeNull();
});

it("restores completed replay exercises after Back and reload, and resets them on an explicit restart", () => {
  saveMeta({ ...DEFAULT_META, tutorialDone: true }); start();
  useGame.getState().startTour("campaign"); renderCompany(); reach(3);
  fireEvent.click(current().getByRole("button", { name: "Back" }));
  cleanup(); useGame.setState(useGame.getInitialState(), true); start(); renderCompany();
  expect(card(2)).toBeTruthy();
  expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", false);
  act(() => useGame.getState().startTour("campaign"));
  expect(card(1).textContent).not.toContain("Completed earlier");
  expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", true);
  expect(useGame.getState().meta.tutorialDone).toBe(true);
});

it("finishes each walkthrough on the step the store counts as its last", () => {
  expect(WALKTHROUGH_STEPS).toEqual({ basics: BASICS_STEPS, campaign: CAMPAIGN_STEPS });
});

it("waits through an incident on a resumed company without holding its clock", () => {
  saveGame(advanceSteps(newGame(1, "resumed-incident"), 6).state);
  saveMeta({ ...DEFAULT_META, walkthroughStep: 6, walkthroughFurthestStep: 6 });
  start(); renderCompany();
  expect(screen.queryByRole("dialog", { name: /^Tutorial/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /^Upgrade database/ }));
  expect(screen.getByRole("button", { name: "Confirm" })).toHaveProperty("disabled", false);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  act(() => { useGame.getState().setRunning(true); useGame.getState().tick(1); });
  expect(useGame.getState().game.campaign!.step).toBe(7);
  expect(useGame.getState().meta.tutorialDone).toBe(false);
});

it("walks Stay Online through unlocking Health Checks in Tech and deploying it", () => {
  useGame.setState({ game: reliabilityCompany(), ready: true, hasRun: true, started: true, onboarding: false, tour: { track: "reliability", step: 0 } });
  renderCompany();
  const guide = (step: number) => screen.getByRole("dialog", { name: `Chapter guide, step ${step} of 3` });
  fireEvent.click(within(guide(1)).getByRole("button", { name: "Got it" }));
  expect(guide(2).textContent).toContain("Unlock Health Checks");
  expect(guide(2).textContent).toContain("Open Tech.");
  // Interactive: it moves on only once the capability is actually unlocked.
  expect(within(guide(2)).queryByRole("button", { name: "Next" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Tech" }));
  expect(guide(2).textContent).toContain("Click Health Checks.");
  fireEvent.click(screen.getByRole("button", { name: /^Health Checks:/ }));
  expect(guide(2).textContent).toContain("Press Unlock Health Checks.");
  fireEvent.click(screen.getByRole("button", { name: /Unlock Health Checks/ }));
  expect(useGame.getState().game.campaign!.reliabilityStage!.owned).toContain("health_checks");
  expect(guide(3).textContent).toContain("Close Tech.");
  fireEvent.click(screen.getByRole("button", { name: "Tech" }));
  expect(guide(3).textContent).toContain("Press Deploy Health Checks.");
  fireEvent.click(screen.getByRole("button", { name: /^Deploy Health Checks/ }));
  expect(guide(3).textContent).toContain("Press Confirm.");
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  expect(useGame.getState().tour).toBeNull();
});

it("keeps the Deploy Health Checks step on its own action when the player buys something else first", () => {
  useGame.setState({ game: reliabilityCompany(), ready: true, hasRun: true, started: true, onboarding: false, tour: { track: "reliability", step: 1 } });
  renderCompany();
  act(() => useGame.getState().act({ type: "unlock_reliability", tech: "health_checks" }));
  const guide = () => screen.getByRole("dialog", { name: "Chapter guide, step 3 of 3" });
  expect(guide().textContent).toContain("Press Deploy Health Checks.");
  fireEvent.click(screen.getByRole("button", { name: /^Add server/ }));
  expect(guide().textContent).not.toContain("Press Confirm.");
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  expect(screen.getByRole("button", { name: /^Deploy Health Checks/ })).toHaveProperty("disabled", true);
  expect(guide().textContent).toContain("Run until the current install finishes, then press Deploy Health Checks.");
});

it("shows a chapter's guide on the controls the chapter adds", () => {
  start(); renderCompany();
  act(() => useGame.getState().endTour(false));
  act(() => useGame.setState({ tour: { track: "scaling", step: 0 } }));
  const guide = screen.getByRole("dialog", { name: "Chapter guide, step 1 of 1" });
  expect(guide.textContent).toContain("Scale and route");
  fireEvent.click(within(guide).getByRole("button", { name: "Got it" }));
  expect(useGame.getState().tour).toBeNull();
});

it("reaches the speed lesson through the real dock menu with keyboard focus", () => {
  start(); renderCompany(); reach(12);
  const guide = within(card(12));
  const trigger = document.querySelector<HTMLElement>(".time-menu > summary")!;
  expect(guide.getByRole("button", { name: "Next" })).toHaveProperty("disabled", true);
  fireEvent.keyDown(guide.getByRole("heading", { name: "Pause, run and change speed" }), { key: "Tab" });
  expect(document.activeElement).toBe(trigger);
  expect(trigger.getAttribute("aria-disabled")).not.toBe("true");
  fireEvent.click(trigger);
  fireEvent.click(within(screen.getByRole("group", { name: "Game speed" })).getByRole("button", { name: "2×" }));
  expect(useGame.getState().speed).toBe(2);
  expect(guide.getByRole("button", { name: "Next" })).toHaveProperty("disabled", false);
});
