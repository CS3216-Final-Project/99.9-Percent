import InspectionReveal from "./InspectionReveal";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGame, WALKTHROUGH_STEPS } from "@/game/store";
import { CampaignHeader, CampaignPanel, CampaignControls, CampaignOverlays } from "./CampaignUI";
import Tutorial, { BASICS_STEPS } from "./Tutorial";
import { reliabilityCompany } from "@/sim/__tests__/reliabilityFixture";
import { dataCompany } from "@/sim/__tests__/dataFixture";
import { saveGame, saveMeta, DEFAULT_META } from "@/game/persist";
import { newGame } from "@/sim";
import { advanceSteps } from "@/sim/step";
import { DockMenu } from "./DockMenu";
import { ViewTabs, type ViewTab } from "./ViewSheet";

// Only timeouts are faked; the spotlight keeps measuring with real intervals.
beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
function start() { useGame.getState().boot(); useGame.getState().play(); }
function renderCompany() { return render(<><CampaignHeader /><CampaignPanel /><InspectionReveal /><CampaignControls /><CampaignOverlays /><Tutorial /></>); }
it("opens a new company on the safe component introduction", () => {
  start(); renderCompany();
  expect(useGame.getState().tour).toBeNull();
  expect(screen.queryByRole("dialog", { name: "Launch week" })).toBeNull();
  expect(screen.getByRole("region", { name: "Introduction Progress" }).textContent).toContain("0/4");
  expect(screen.getByRole("button", { name: "Complete Introduction" })).toHaveProperty("disabled",true);
  expect(screen.queryByRole("button", { name: /^Upgrade database/ })).toBeNull();
  act(() => { useGame.getState().setRunning(true); useGame.getState().tick(100); });
  expect(useGame.getState().game.campaign!.step).toBe(0);
  expect(useGame.getState().game.campaign!.incident).toBeNull();
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
  // Practice uses the same safe introduction as a fresh company.
  act(() => { useGame.getState().setRunning(true); useGame.getState().tick(3); });
  expect(useGame.getState().game.campaign!.step).toBe(0);
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
  fireEvent.click(screen.getByRole("button", { name: "Database" }));
  fireEvent.click(screen.getByRole("button", { name: /^Upgrade database/ }));
  expect(screen.getByRole("button", { name: "Confirm" })).toHaveProperty("disabled", false);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  act(() => { useGame.getState().setRunning(true); useGame.getState().tick(1); });
  expect(useGame.getState().game.campaign!.step).toBe(7);
});

it("walks Stay Online through unlocking Health Checks in Tech and deploying it from Monitoring, one box per click", { timeout: 30_000 }, async () => {
  useGame.setState({ game: reliabilityCompany(), ready: true, hasRun: true, started: true, onboarding: false, tour: { track: "reliability", step: 0 } });
  renderCompany();
  const guide = (step: number) => screen.getByRole("dialog", { name: `Chapter guide, step ${step} of 9` });
  const boxes = () => [...document.querySelectorAll(".tour-dots i")].map(i => i.className === "is-done" ? "done" : i.className === "is-now" ? "now" : "next");
  expect(screen.queryByRole("tablist")).toBeNull();
  expect(boxes()).toEqual(["now", ...Array(8).fill("next")]);
  fireEvent.click(within(guide(1)).getByRole("button", { name: "Got it" }));
  expect(guide(2).textContent).toContain("Unlock Health Checks");
  expect(guide(2).textContent).toContain("Open Tech.");
  // Interactive: it moves on only once the capability is actually unlocked.
  expect(within(guide(2)).queryByRole("button", { name: "Next" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Tech" }));
  expect(guide(3).textContent).toContain("Click Health Checks.");
  expect(boxes()).toEqual(["done", "done", "now", ...Array(6).fill("next")]);
  fireEvent.click(screen.getByRole("button", { name: /^Health Checks:/ }));
  expect(guide(4).textContent).toContain("Press Unlock Health Checks.");
  fireEvent.click(screen.getByRole("button", { name: /Unlock Health Checks/ }));
  expect(useGame.getState().game.campaign!.reliabilityStage!.owned).toContain("health_checks");
  expect(guide(5).textContent).toContain("Close Tech.");
  fireEvent.click(screen.getByRole("button", { name: "Tech" }));
  expect(guide(6).textContent).toContain("Click Monitoring.");
  fireEvent.click(screen.getByRole("button", { name: "Monitoring" }));
  const monitoring = screen.getByRole("dialog", { name: "Monitoring" });
  // The inspection holds the step's control, so the guide stays up over it.
  expect(guide(7).textContent).toContain("Press the Monitoring disc to inspect details.");
  fireEvent.click(within(monitoring).getByRole("button", { name: "Inspect details" }));
  await vi.waitFor(() => expect(guide(8).textContent).toContain("Press Deploy Health Checks."));
  fireEvent.click(within(monitoring).getByRole("button", { name: /^Deploy Health Checks/ }));
  expect(guide(9).textContent).toContain("Press Confirm.");
  expect(boxes()).toEqual([...Array(8).fill("done"), "now"]);
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  expect(useGame.getState().tour).toBeNull();
});

it("moves the box back when the player undoes a click, such as closing Tech before unlocking", () => {
  useGame.setState({ game: reliabilityCompany(), ready: true, hasRun: true, started: true, onboarding: false, view: "tech", tour: { track: "reliability", step: 1 } });
  renderCompany();
  expect(screen.getByRole("dialog", { name: "Chapter guide, step 3 of 9" }).textContent).toContain("Click Health Checks.");
  fireEvent.click(screen.getByRole("button", { name: "Tech" }));
  expect(screen.getByRole("dialog", { name: "Chapter guide, step 2 of 9" }).textContent).toContain("Open Tech.");
});

it("points at a closed dock menu that holds the step's control and names it, but not at other disclosures", async () => {
  // Deploy Health Checks with Tech open: its control is the Tech tab, folded into a phone's Views menu.
  useGame.setState({ game: reliabilityCompany(), ready: true, hasRun: true, started: true, onboarding: false, view: "tech", tour: { track: "reliability", step: 2 } });
  const tech: ViewTab[] = [{ id: "tech", label: "Tech", icon: "tree", badge: null }];
  const prompt = () => screen.getByRole("dialog", { name: "Chapter guide, step 5 of 9" }).querySelector(".tour-prompt")!.textContent;
  const docked = render(<><div className="controls-dock"><DockMenu name="Views" label="Views"><ViewTabs tabs={tech} /></DockMenu></div><Tutorial /></>);
  expect(prompt()).toBe("Open Views, then close Tech.");
  // Once the menu is open the tab itself is the target again.
  act(() => { document.querySelector("details")!.open = true; });
  await vi.waitFor(() => expect(prompt()).toBe("Close Tech."));
  docked.unmount();
  render(<><details><summary>More</summary><ViewTabs tabs={tech} /></details><Tutorial /></>);
  expect(prompt()).toBe("Close Tech.");
});

it("keeps the Deploy Health Checks step on its own action when the player buys something else first", { timeout: 30_000 }, async () => {
  useGame.setState({ game: reliabilityCompany(), ready: true, hasRun: true, started: true, onboarding: false, tour: { track: "reliability", step: 1 } });
  renderCompany();
  act(() => useGame.getState().act({ type: "unlock_reliability", tech: "health_checks" }));
  const guide = () => screen.getByRole("dialog", { name: /^Chapter guide, step [5-9] of 9$/ });
  expect(guide().textContent).toContain("Click Monitoring.");
  fireEvent.click(screen.getByRole("button", { name: "App Server" }));
  fireEvent.click(within(document.querySelector<HTMLElement>(".component-inspection-app")!).getByRole("button", { name: /^Add server/ }));
  expect(guide().textContent).not.toContain("Press Confirm.");
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  fireEvent.click(screen.getByRole("button", { name: "Monitoring" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Monitoring" })).getByRole("button", { name: "Inspect details" }));
  expect(screen.getByRole("button", { name: /^Deploy Health Checks/ })).toHaveProperty("disabled", true);
  await vi.waitFor(() => expect(guide().textContent).toContain("Run until the current install finishes, then press Deploy Health Checks."));
});

it("shows a chapter's guide on the controls the chapter adds", () => {
  useGame.setState({ game: newGame(1, "chapter-guide"), ready: true, hasRun: true, started: true, onboarding: false, tour: { track: "scaling", step: 0 } });
  renderCompany();
  const guide = screen.getByRole("dialog", { name: "Chapter guide, step 1 of 1" });
  expect(guide.textContent).toContain("Scale and route");
  fireEvent.click(within(guide).getByRole("button", { name: "Got it" }));
  expect(useGame.getState().tour).toBeNull();
});

it.each([
  ["Scale and route", "scaling" as const, () => newGame(1, "chapter-guide-inspect")],
  ["Data strategy", "data" as const, () => dataCompany()],
])("closes the %s guide and its spotlight once the player opens equipment", (title, track, game) => {
  useGame.setState({ game: game(), ready: true, hasRun: true, started: true, onboarding: false, tour: { track, step: 0 } });
  renderCompany();
  expect(screen.getByRole("dialog", { name: "Chapter guide, step 1 of 1" }).textContent).toContain(title);
  // Any equipment counts, not only the one the guide points at.
  fireEvent.click(screen.getByRole("button", { name: "Database" }));
  expect(useGame.getState().tour).toBeNull();
  expect(screen.queryByRole("dialog", { name: /^Chapter guide/ })).toBeNull();
  expect(document.querySelector(".tour")).toBeNull();
  expect(screen.getByRole("dialog", { name: "Database" })).toBeTruthy();
});

it("keeps a chapter guide up when an inspection was already open as it began", () => {
  useGame.setState({ game: newGame(1, "chapter-guide-open"), ready: true, hasRun: true, started: true, onboarding: false });
  renderCompany();
  fireEvent.click(screen.getByRole("button", { name: "Database" }));
  act(() => useGame.setState({ tour: { track: "scaling", step: 0 } }));
  expect(screen.getByRole("dialog", { name: "Chapter guide, step 1 of 1" })).toBeTruthy();
});

it("explains the first settled week with a one-card tip on Cash", () => {
  useGame.setState({ game: newGame(1, "settle-tip"), ready: true, hasRun: true, started: true, onboarding: false, tour: { track: "settlement", step: 0 } });
  renderCompany();
  const tip = screen.getByRole("dialog", { name: "Tip, step 1 of 1" });
  expect(tip.textContent).toContain("Your first week settled");
  fireEvent.click(within(tip).getByRole("button", { name: "Got it" }));
  expect(useGame.getState().tour).toBeNull();
});

it("hands the introduction to the Opening without stopping for a Hint tip", () => {
  start(); renderCompany();
  for (const equipment of ["gateway", "app", "db", "monitoring"] as const) {
    act(() => useGame.getState().act({ type: "incident_inspect", equipment }));
    act(() => useGame.getState().act({ type: "acknowledge_introduction", equipment }));
  }
  act(() => useGame.getState().act({ type: "complete_introduction" }));
  // Hint is explained when it first has advice (CampaignAttention), not before the first Run.
  expect(screen.queryByRole("dialog", { name: "Tip, step 1 of 1" })).toBeNull();
  expect(useGame.getState().tour).toBeNull();
  expect(useGame.getState().meta.tipsSeen).not.toContain("hint");
});
