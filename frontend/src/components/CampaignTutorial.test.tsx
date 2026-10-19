import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGame, WALKTHROUGH_STEPS } from "@/game/store";
import { WALKTHROUGH_LESSON_IDS, type LessonId } from "@/game/walkthrough";
import { CampaignHeader, CampaignPanel, CampaignControls, CampaignOverlays } from "./CampaignUI";
import Tutorial, { BASICS_STEPS, CAMPAIGN_STEPS } from "./Tutorial";
import { reliabilityCompany } from "@/sim/__tests__/reliabilityFixture";
import { saveGame, saveMeta, DEFAULT_META } from "@/game/persist";
import { newGame } from "@/sim";
import { advanceSteps } from "@/sim/step";

// Only timeouts are faked; the spotlight keeps measuring with real intervals.
beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
function start() { useGame.getState().boot(); useGame.getState().play(); }
function renderCompany() { return render(<><CampaignHeader /><CampaignPanel /><CampaignControls /><CampaignOverlays /><Tutorial /></>); }
/** A lesson's 1-based position, as the guide announces it. */
const at = (id: LessonId) => WALKTHROUGH_LESSON_IDS.indexOf(id) + 1;
const card = (step: number) => screen.getByRole("dialog", { name: `Walkthrough, step ${step} of ${CAMPAIGN_STEPS}` });
const current = () => within(screen.getByRole("dialog", { name: /^Walkthrough/ }));
const next = () => fireEvent.click(current().getByRole("button", { name: "Next" }));
/** Let pending timeouts play out. */
const settle = () => act(() => { vi.advanceTimersByTime(1000); });
const lessonId = () => WALKTHROUGH_LESSON_IDS[useGame.getState().tour!.step];
const EXERCISES = new Set<LessonId>(["inspect-app", "inspect-db", "run", "quote", "cancel", "speed"]);
function exercise() {
  const id = lessonId();
  const panel = within(screen.getByRole("complementary", { name: "System metrics" }));
  if (id === "inspect-app") fireEvent.click(panel.getByRole("button", { name: "App Server" }));
  if (id === "inspect-db") fireEvent.click(panel.getByRole("button", { name: "Database" }));
  if (id === "run") { fireEvent.click(screen.getByRole("button", { name: "Run" })); act(() => useGame.getState().tick(20)); }
  if (id === "quote") fireEvent.click(panel.getByRole("button", { name: /^Add server/ }));
  if (id === "cancel") fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  if (id === "speed") {
    fireEvent.click(document.querySelector(".time-menu > summary")!);
    fireEvent.click(within(screen.getByRole("group", { name: "Game speed" })).getByRole("button", { name: useGame.getState().speed === 2 ? "1×" : "2×" }));
    fireEvent.click(document.querySelector(".time-menu > summary")!);
  }
}
/** Walk forward to the 1-based lesson `step`: most exercises move on by themselves; inspections and reading lessons use Next. */
function reach(step: number) {
  let attempts = 0;
  while (useGame.getState().tour!.step < step - 1) {
    if (++attempts > 30) throw new Error("Tutorial did not advance");
    const id = lessonId();
    if (EXERCISES.has(id)) { exercise(); settle(); if (lessonId() === id) next(); } else next();
  }
}

it("starts with the goal, then requires inspection through real game controls and lets focus leave the nonmodal guide", () => {
  start(); renderCompany();
  expect(card(1).getAttribute("aria-modal")).toBe("false");
  expect(card(1).dataset.lessonId).toBe("goal");
  expect(current().queryByRole("button", { name: "Skip" })).toBeNull();
  expect(current().queryByRole("button", { name: "Return to game" })).toBeNull();
  expect(current().getByRole("button", { name: "Back" })).toHaveProperty("disabled", true);
  next();
  expect(card(at("inspect-app"))).toBeTruthy();
  expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", true);
  fireEvent.keyDown(current().getByRole("heading", { name: "Look at the App Server" }), { key: "Tab" });
  expect(document.activeElement).toBe(within(screen.getByRole("complementary", { name: "System metrics" })).getByRole("button", { name: "App Server" }));
  exercise();
  expect(useGame.getState().selected).toBe("app");
  // An inspection stays open so its readings can be read; Next continues.
  settle();
  expect(card(at("inspect-app")).textContent).toContain("Read its demand and capacity, then press Next.");
  expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", false);
  next();
  expect(card(at("inspect-db"))).toBeTruthy();
  expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", true);
  exercise(); expect(useGame.getState().selected).toBe("db");
  expect(card(at("inspect-db"))).toBeTruthy();
  expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", false);
});

it("opens the next lesson as soon as an action exercise is done", () => {
  start(); renderCompany(); reach(at("quote")); exercise();
  expect(card(at("cancel"))).toBeTruthy();
  expect(screen.queryByText(/Moving on|Completed earlier/)).toBeNull();
});

it("compares both live components without advancing time", () => {
  start(); renderCompany(); reach(at("inspect-db"));
  const before = structuredClone(useGame.getState().game.campaign!);
  fireEvent.click(within(screen.getByRole("complementary", { name: "System metrics" })).getByRole("button", { name: "Database" }));
  const rows = current().getByRole("figure").querySelectorAll(".lesson-load");
  expect([...rows].map(row => row.querySelector("dt")!.textContent)).toEqual(["App Server", "Database"]);
  const c = before.snapshot;
  expect(rows[0].textContent).toContain(`${c.app.demand.toLocaleString("en-US")} / ${c.app.capacity.toLocaleString("en-US")}`);
  const after = useGame.getState().game.campaign!;
  expect([after.step, after.cashCents, after.snapshot, after.pending]).toEqual([before.step, before.cashCents, before.snapshot, before.pending]);
});

it("does not auto-advance a lesson revisited with Back, which keeps its Next", () => {
  start(); renderCompany(); reach(at("ready"));
  fireEvent.click(current().getByRole("button", { name: "Back" }));
  expect(card(at("speed"))).toBeTruthy();
  expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", false);
  exercise(); settle();
  expect(card(at("speed"))).toBeTruthy();
  next(); expect(card(at("ready"))).toBeTruthy();
});

it("waits behind an open Menu instead of advancing and closing it", () => {
  start(); renderCompany(); reach(at("speed"));
  fireEvent.click(screen.getByRole("button", { name: "Menu" }));
  act(() => useGame.getState().setSpeed(useGame.getState().speed === 2 ? 1 : 2));
  settle();
  expect(useGame.getState()).toMatchObject({ view: "menu", tour: { step: at("speed") - 1 } });
  fireEvent.click(within(screen.getByRole("dialog", { name: "Menu" })).getByRole("button", { name: "Resume" }));
  settle();
  expect(card(at("ready"))).toBeTruthy();
});

it("runs exactly one real second even with a large tick, and cancels the real company's quote without spending", () => {
  start(); renderCompany(); const before = structuredClone(useGame.getState().game.campaign!);
  reach(at("run")); exercise();
  expect(useGame.getState()).toMatchObject({ running: false, game: { campaign: { step: 1 } } });
  act(() => { useGame.getState().setRunning(true); useGame.getState().tick(20); });
  expect(useGame.getState().game.campaign!.step).toBe(1);
  settle(); expect(card(at("quote"))).toBeTruthy();
  expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", true);
  exercise(); expect(screen.getByRole("region", { name: "Confirm Add server" })).toBeTruthy();
  settle(); expect(card(at("cancel"))).toBeTruthy(); expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", true);
  exercise(); expect(screen.queryByRole("region", { name: "Confirm Add server" })).toBeNull();
  const c = useGame.getState().game.campaign!;
  expect([c.cashCents, c.apps, c.actions, c.pending]).toEqual([before.cashCents, before.apps, before.actions, before.pending]);
});

it("keeps the quote open until the Cancel lesson and never permits a tutorial purchase", () => {
  start(); renderCompany(); reach(at("quote")); exercise();
  const cash = useGame.getState().game.campaign!.cashCents;
  // Opening the quote is the exercise: the Cancel lesson opens at once over the same quote.
  expect(card(at("cancel"))).toBeTruthy();
  expect(screen.getByRole("button", { name: "Confirm" })).toHaveProperty("disabled", true);
  fireEvent.keyDown(screen.getByRole("region", { name: "Confirm Add server" }), { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "Menu" }));
  expect(screen.getByRole("region", { name: "Confirm Add server" })).toBeTruthy();
  expect(useGame.getState().view).toBe("menu");
  fireEvent.click(within(screen.getByRole("dialog", { name: "Menu" })).getByRole("button", { name: "Resume" }));
  expect(useGame.getState().view).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Confirm" })); settle();
  expect(card(at("cancel"))).toBeTruthy();
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveProperty("disabled", false);
  expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", true);
  fireEvent.click(screen.getByRole("button", { name: /^Limit to 500/ }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(card(at("money"))).toBeTruthy();
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
  saveMeta({ ...DEFAULT_META, walkthroughStep: at("cancel") - 1, walkthroughFurthestStep: at("cancel") - 1 });
  start(); act(() => useGame.getState().goToFloor("office", "menu")); renderCompany();
  expect(card(at("cancel"))).toBeTruthy();
  expect(screen.getByRole("region", { name: "Confirm Add server" })).toBeTruthy();
  expect(useGame.getState().floor).toBe("servers");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  settle(); expect(card(at("money"))).toBeTruthy();
});

it("resumes a player saved mid-way through the 21-lesson walkthrough at the matching lesson", () => {
  // The earlier walkthrough's 16th lesson taught saving, which the final lesson now covers.
  localStorage.setItem("nn.campaign.meta.v1", JSON.stringify({ walkthroughStep: 15, walkthroughFurthestStep: 15 }));
  start(); renderCompany();
  expect(card(at("ready"))).toBeTruthy();
  fireEvent.click(current().getByRole("button", { name: "Finish walkthrough" }));
  expect(useGame.getState().meta.tutorialDone).toBe(true);
});

it("goes Back without forcing completed interactions again and preserves the lesson on reload", () => {
  start(); renderCompany(); reach(at("inspect-db")); fireEvent.click(current().getByRole("button", { name: "Back" }));
  expect(card(at("inspect-app"))).toBeTruthy(); expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", false);
  cleanup(); useGame.setState(useGame.getInitialState(), true); start(); renderCompany();
  expect(card(at("inspect-app"))).toBeTruthy(); expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", false);
});

it("How to play clears previous exercise completion", () => {
  start(); renderCompany(); reach(at("inspect-db"));
  const before = structuredClone(useGame.getState().game.campaign!);
  // Restart through the store to isolate exercise acknowledgement from the Menu controls.
  act(() => useGame.getState().startTour("campaign"));
  expect(card(1)).toBeTruthy();
  expect(useGame.getState().meta.walkthroughFurthestStep).toBe(0);
  expect(useGame.getState().game.campaign).toEqual(before);
  next();
  expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", true);
  cleanup(); useGame.setState(useGame.getInitialState(), true); start(); renderCompany();
  expect(card(at("inspect-app"))).toBeTruthy();
  expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", true);
});

it("cannot skip or finish early, holds the clock outside its Run lesson, and completes only on Finish", () => {
  start(); renderCompany();
  act(() => { useGame.getState().endTour(false); useGame.getState().endTour(true); useGame.getState().setRunning(true); useGame.getState().tick(20); });
  expect(card(1)).toBeTruthy(); expect(useGame.getState().game.campaign!.step).toBe(0);
  reach(CAMPAIGN_STEPS);
  act(() => { useGame.getState().setRunning(true); useGame.getState().advance(); });
  expect(useGame.getState()).toMatchObject({ running: false, meta: { tutorialDone: false }, game: { campaign: { step: 1 } } });
  fireEvent.click(current().getByRole("button", { name: "Finish walkthrough" }));
  expect(useGame.getState().meta.tutorialDone).toBe(true);
});

it("saves and exits unfinished and resumes the same company at its saved lesson", () => {
  start(); renderCompany(); reach(at("money")); const runId = useGame.getState().game.campaign!.runId;
  expect(current().queryByRole("button", { name: "Save and exit" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Menu" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Menu" })).getByRole("button", { name: "Exit" }));
  expect(useGame.getState().meta.tutorialDone).toBe(false);
  cleanup(); useGame.setState(useGame.getInitialState(), true); start(); renderCompany();
  expect(card(at("money"))).toBeTruthy(); expect(useGame.getState().game.campaign!.runId).toBe(runId);
});

it("preserves existing completed profiles", () => {
  saveMeta({ ...DEFAULT_META, tutorialDone: true }); start(); renderCompany();
  expect(screen.queryByRole("dialog", { name: /^Walkthrough/ })).toBeNull();
});

it("exits a completed player's replay without finishing the lessons or buying the practice quote", () => {
  saveMeta({ ...DEFAULT_META, tutorialDone: true }); start();
  const company = structuredClone(useGame.getState().game.campaign!);
  useGame.getState().startTour("campaign"); renderCompany(); reach(at("quote")); exercise();
  fireEvent.click(current().getByRole("button", { name: "Return to game" }));
  settle();
  expect(screen.queryByRole("dialog", { name: /^Walkthrough/ })).toBeNull();
  expect(screen.queryByRole("region", { name: "Confirm Add server" })).toBeNull();
  expect(screen.getByRole("button", { name: "Run" })).toHaveProperty("disabled", false);
  expect(useGame.getState()).toMatchObject({ running: false, meta: { tutorialDone: true, walkthroughStep: null } });
  expect(useGame.getState().game.campaign).toEqual(company);
  cleanup(); useGame.setState(useGame.getInitialState(), true); start(); renderCompany();
  expect(screen.queryByRole("dialog", { name: /^Walkthrough/ })).toBeNull();
});

it("returns from practice through Menu after reload without changing the saved company", () => {
  const game = advanceSteps(newGame(1, "return-from-menu"), 6).state;
  saveGame(game);
  saveMeta({ ...DEFAULT_META, tutorialDone: true }); start();
  const company = structuredClone(useGame.getState().game.campaign!);
  useGame.getState().startTour("campaign"); renderCompany(); reach(at("money"));
  cleanup(); useGame.setState(useGame.getInitialState(), true); start(); renderCompany();
  expect(card(at("money"))).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Menu" }));
  const menu = within(screen.getByRole("dialog", { name: "Menu" }));
  expect(menu.getByRole("region", { name: "Walkthrough practice" })).toBeTruthy();
  fireEvent.click(menu.getByRole("tab", { name: "Graphics" }));
  fireEvent.click(menu.getByRole("button", { name: "Return to game" }));
  expect(useGame.getState()).toMatchObject({ running: false, tour: null, tutorialCompany: null, view: null });
  expect(useGame.getState().game.campaign).toEqual(company);
  expect(screen.queryByRole("dialog", { name: /^Walkthrough/ })).toBeNull();
  expect(screen.queryByRole("region", { name: "Confirm Add server" })).toBeNull();
  expect(localStorage.getItem("nn.campaign.tutorial.v1")).toBeNull();
  cleanup(); useGame.setState(useGame.getInitialState(), true); start(); renderCompany();
  expect(useGame.getState().game.campaign).toEqual(company);
  expect(screen.queryByRole("dialog", { name: /^Walkthrough/ })).toBeNull();
});

it("restores completed replay exercises after Back and reload, and resets them on an explicit restart", () => {
  saveMeta({ ...DEFAULT_META, tutorialDone: true }); start();
  useGame.getState().startTour("campaign"); renderCompany(); reach(at("inspect-db"));
  fireEvent.click(current().getByRole("button", { name: "Back" }));
  cleanup(); useGame.setState(useGame.getInitialState(), true); start(); renderCompany();
  expect(card(at("inspect-app"))).toBeTruthy();
  expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", false);
  act(() => useGame.getState().startTour("campaign"));
  next();
  expect(current().getByRole("button", { name: "Next" })).toHaveProperty("disabled", true);
  expect(useGame.getState().meta.tutorialDone).toBe(true);
});

it("finishes each walkthrough on the step the store counts as its last", () => {
  expect(WALKTHROUGH_STEPS).toEqual({ basics: BASICS_STEPS, campaign: CAMPAIGN_STEPS });
});

it("waits through an incident on a resumed company without holding its clock", () => {
  saveGame(advanceSteps(newGame(1, "resumed-incident"), 6).state);
  saveMeta({ ...DEFAULT_META, walkthroughStep: at("quote") - 1, walkthroughFurthestStep: at("quote") - 1 });
  start(); renderCompany();
  expect(screen.queryByRole("dialog", { name: /^Walkthrough/ })).toBeNull();
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
  start(); renderCompany(); reach(at("speed"));
  const guide = within(card(at("speed")));
  const trigger = document.querySelector<HTMLElement>(".time-menu > summary")!;
  expect(guide.getByRole("button", { name: "Next" })).toHaveProperty("disabled", true);
  fireEvent.keyDown(guide.getByRole("heading", { name: "Speed and floors" }), { key: "Tab" });
  expect(document.activeElement).toBe(trigger);
  expect(trigger.getAttribute("aria-disabled")).not.toBe("true");
  fireEvent.click(trigger);
  fireEvent.click(within(screen.getByRole("group", { name: "Game speed" })).getByRole("button", { name: "2×" }));
  expect(useGame.getState().speed).toBe(2);
  settle(); expect(card(at("ready"))).toBeTruthy();
});

it("explains the first settled week with a one-card tip on Cash", () => {
  start(); renderCompany();
  act(() => { useGame.getState().endTour(true); useGame.setState({ tour: { track: "settlement", step: 0 } }); });
  const tip = screen.getByRole("dialog", { name: "Tip, step 1 of 1" });
  expect(tip.textContent).toContain("Your first week settled");
  fireEvent.click(within(tip).getByRole("button", { name: "Got it" }));
  expect(useGame.getState().tour).toBeNull();
});
