import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGame, WALKTHROUGH_STEPS } from "@/game/store";
import { CampaignHeader, CampaignPanel, CampaignControls, CampaignOverlays } from "./CampaignUI";
import Tutorial, { BASICS_STEPS } from "./Tutorial";
import { reliabilityCompany } from "@/sim/__tests__/reliabilityFixture";
import { saveGame, saveMeta, DEFAULT_META } from "@/game/persist";
import { newGame } from "@/sim";
import { advanceSteps } from "@/sim/step";
import { DockMenu } from "./DockMenu";
import { ViewTabs, type ViewTab } from "./ViewSheet";

// Only timeouts are faked; the spotlight keeps measuring with real intervals.
beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
function start() { useGame.getState().boot(); useGame.getState().play(); }
function renderCompany() { return render(<><CampaignHeader /><CampaignPanel /><CampaignControls /><CampaignOverlays /><Tutorial /></>); }
it("opens a new company on the Launch Week letter, not a lesson walkthrough", () => {
  start(); renderCompany();
  expect(useGame.getState().tour).toBeNull();
  const letter = screen.getByRole("dialog", { name: "Launch week" });
  expect(letter.textContent).toContain("database");
  fireEvent.click(within(letter).getByRole("button", { name: "Open the doors" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  // The clock is free to run from the first second.
  act(() => { useGame.getState().setRunning(true); useGame.getState().tick(1); });
  expect(useGame.getState().game.campaign!.step).toBe(1);
  expect(useGame.getState().game.campaign!.launchWeek).not.toBeNull();
});

it("replays Launch Week on a practice company and returns to the paused original", () => {
  saveGame(advanceSteps(newGame(1, "paused-company"), 6).state);
  saveMeta({ ...DEFAULT_META, tutorialDone: true });
  start();
  const saved = useGame.getState().game;
  act(() => useGame.getState().startTour("campaign", "menu"));
  const state = useGame.getState();
  // The practice company is a fresh Launch Week run; the original is parked, unchanged.
  expect(state.tutorialCompany?.game.campaign).toEqual(saved.campaign);
  expect(state.game.campaign!.launchWeek).not.toBeNull();
  expect(state.game.campaign!.step).toBe(0);
  expect(state.tour).toBeNull();
  expect(state.meta.walkthroughStep).toBe(0);
  renderCompany();
  // Nothing holds the practice company's clock.
  act(() => { useGame.getState().setRunning(true); useGame.getState().tick(3); });
  expect(useGame.getState().game.campaign!.step).toBe(3);
  act(() => useGame.getState().endTour(false));
  expect(useGame.getState().game.campaign).toEqual(saved.campaign);
  expect(useGame.getState().tutorialCompany).toBeNull();
  expect(useGame.getState().meta.walkthroughStep).toBeNull();
});

it("resumes practice after reload and still restores the saved company on exit", () => {
  const company = advanceSteps(newGame(1, "practice-reload"), 6).state;
  saveGame(company);
  saveMeta({ ...DEFAULT_META, tutorialDone: true });
  start();
  act(() => useGame.getState().startTour("campaign", "menu"));
  act(() => { useGame.getState().setRunning(true); useGame.getState().tick(3); });
  // Booting again lands back on the practice company; exiting returns the original.
  useGame.getState().boot(); useGame.getState().play();
  expect(useGame.getState().tutorialCompany).not.toBeNull();
  expect(useGame.getState().game.campaign!.launchWeek).not.toBeNull();
  act(() => useGame.getState().endTour(false));
  expect(useGame.getState().game.campaign).toEqual(company.campaign);
  expect(useGame.getState().meta.walkthroughStep).toBeNull();
});

it("marks lesson-era profiles done so version-1 companies keep their chapter state", () => {
  saveGame(advanceSteps(newGame(1, "lesson-era"), 6).state);
  saveMeta({ ...DEFAULT_META, walkthroughStep: 3, walkthroughFurthestStep: 4, walkthroughVersion: 2 });
  start(); renderCompany();
  expect(useGame.getState().meta.tutorialDone).toBe(true);
  expect(useGame.getState().meta.walkthroughStep).toBeNull();
  expect(useGame.getState().tour).toBeNull();
  expect(screen.getByLabelText("Current chapter").textContent).toBe("Opening");
});

it("finishes the remaining walkthrough on the step the store counts as its last", () => {
  expect(WALKTHROUGH_STEPS).toEqual({ basics: BASICS_STEPS });
});

it("waits through an incident on a resumed company without holding its clock", () => {
  saveGame(advanceSteps(newGame(1, "resumed-incident"), 6).state);
  saveMeta({ ...DEFAULT_META, tutorialDone: true });
  start(); renderCompany();
  openActions(); fireEvent.click(screen.getByRole("button", { name: /^Upgrade database/ }));
  expect(screen.getByRole("button", { name: "Confirm" })).toHaveProperty("disabled", false);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  act(() => { useGame.getState().setRunning(true); useGame.getState().tick(1); });
  expect(useGame.getState().game.campaign!.step).toBe(7);
});

it("walks Stay Online through unlocking Health Checks in Tech and deploying it", { timeout: 30_000 }, () => {
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

it("points at a closed dock menu that holds the step's control and names it, but not at other disclosures", async () => {
  // Deploy Health Checks with Tech open: its control is the Tech tab, folded into a phone's Views menu.
  useGame.setState({ game: reliabilityCompany(), ready: true, hasRun: true, started: true, onboarding: false, view: "tech", tour: { track: "reliability", step: 2 } });
  const tech: ViewTab[] = [{ id: "tech", label: "Tech", icon: "tree", badge: null }];
  const prompt = () => screen.getByRole("dialog", { name: "Chapter guide, step 3 of 3" }).querySelector(".tour-prompt")!.textContent;
  const docked = render(<><div className="controls-dock"><DockMenu name="Views" label="Views"><ViewTabs tabs={tech} /></DockMenu></div><Tutorial /></>);
  expect(prompt()).toBe("Open Views, then close Tech.");
  // Once the menu is open the tab itself is the target again.
  act(() => { document.querySelector("details")!.open = true; });
  await vi.waitFor(() => expect(prompt()).toBe("Close Tech."));
  docked.unmount();
  render(<><details><summary>More</summary><ViewTabs tabs={tech} /></details><Tutorial /></>);
  expect(prompt()).toBe("Close Tech.");
});

it("keeps the Deploy Health Checks step on its own action when the player buys something else first", { timeout: 30_000 }, () => {
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

it("points the Deploy Health Checks step back to Actions when the player reads Analysis", () => {
  useGame.setState({ game: reliabilityCompany(), ready: true, hasRun: true, started: true, onboarding: false, tour: { track: "reliability", step: 1 } });
  renderCompany();
  act(() => useGame.getState().act({ type: "unlock_reliability", tech: "health_checks" }));
  const guide = () => screen.getByRole("dialog", { name: "Chapter guide, step 3 of 3" });
  expect(useGame.getState().panelTab).toBe("actions");
  fireEvent.click(screen.getByRole("tab", { name: "Analysis" }));
  expect(guide().textContent).toContain("Open Actions.");
  fireEvent.click(screen.getByRole("tab", { name: /^Actions/ }));
  expect(guide().textContent).toContain("Press Deploy Health Checks.");
});

it("shows a chapter's guide on the controls the chapter adds", () => {
  useGame.setState({ game: newGame(1, "chapter-guide"), ready: true, hasRun: true, started: true, onboarding: false, tour: { track: "scaling", step: 0 } });
  renderCompany();
  const guide = screen.getByRole("dialog", { name: "Chapter guide, step 1 of 1" });
  expect(guide.textContent).toContain("Scale and route");
  fireEvent.click(within(guide).getByRole("button", { name: "Got it" }));
  expect(useGame.getState().tour).toBeNull();
});

it("explains the first settled week with a one-card tip on Cash", () => {
  useGame.setState({ game: newGame(1, "settle-tip"), ready: true, hasRun: true, started: true, onboarding: false, tour: { track: "settlement", step: 0 } });
  renderCompany();
  const tip = screen.getByRole("dialog", { name: "Tip, step 1 of 1" });
  expect(tip.textContent).toContain("Your first week settled");
  fireEvent.click(within(tip).getByRole("button", { name: "Got it" }));
  expect(useGame.getState().tour).toBeNull();
});

/** Purchases live on the panel's Actions tab. */
function openActions() { fireEvent.click(screen.getByRole("tab", { name: /^Actions/ })); }
