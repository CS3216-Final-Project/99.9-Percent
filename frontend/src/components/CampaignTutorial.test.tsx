import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGame, WALKTHROUGH_STEPS } from "@/game/store";
import { CampaignHeader, CampaignPanel, CampaignControls, CampaignOverlays } from "./CampaignUI";
import Tutorial, { BASICS_STEPS, CAMPAIGN_STEPS } from "./Tutorial";
import { reliabilityCompany } from "@/sim/__tests__/reliabilityFixture";

beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function start() { useGame.getState().boot(); useGame.getState().play(); }
function renderCompany() {
  return render(<><CampaignHeader /><CampaignPanel /><CampaignControls /><CampaignOverlays /><Tutorial /></>);
}
const card = (step: number) => screen.getByRole("dialog", { name: `Tutorial, step ${step} of ${CAMPAIGN_STEPS}` });
const evidence = () => within(screen.getByRole("complementary", { name: "System metrics" }));
const next = () => fireEvent.click(within(screen.getByRole("dialog", { name: /^Tutorial/ })).getByRole("button", { name: "Next" }));

it("walks a first company from its system and evidence to its first purchase, without buying it", () => {
  start(); renderCompany();
  const before = structuredClone(useGame.getState().game.campaign!);
  expect(card(1).textContent).toContain("Customers send 300 requests a second");
  expect(card(1).textContent).toContain("Click Servers.");
  // Interactive steps finish when the player does what they ask, through the real controls.
  expect(within(card(1)).queryByRole("button", { name: "Next" })).toBeNull();
  fireEvent.click(evidence().getByRole("button", { name: "App Server" }));
  expect(card(2).textContent).toContain("Click Database.");
  fireEvent.click(evidence().getByRole("button", { name: "Database" }));
  expect(card(3).textContent).toContain("The Database is doing 300 of the 600 operations a second it can.");
  next();
  expect(card(4).textContent).toContain("Over 500 ms or 1% errors, customers are failing.");
  next();
  expect(card(5).textContent).toContain("Each successful request earns $0.20. It becomes cash every 60 steps.");
  next();
  expect(card(6).textContent).toContain("Pause (P) to think");
  next();
  expect(card(7).textContent).toContain("Click an action to see its costs.");
  fireEvent.click(screen.getByRole("button", { name: /Upgrade database/ }));
  expect(screen.getByRole("region", { name: "Confirm Upgrade database" })).toBeTruthy();
  expect(card(8).textContent).toContain("No need to buy yet.");
  fireEvent.click(within(card(8)).getByRole("button", { name: "Got it" }));

  expect(screen.queryByRole("dialog", { name: /^Tutorial/ })).toBeNull();
  expect(useGame.getState().meta.tutorialDone).toBe(true);
  expect(screen.getByRole("region", { name: "Guided Mode chapters" }).textContent).toContain("Getting started");
  // Inspection is free and the walkthrough never bought or advanced anything.
  const c = useGame.getState().game.campaign!;
  expect([c.step, c.cashCents, c.pending, c.actions]).toEqual([before.step, before.cashCents, before.pending, before.actions]);
  expect(useGame.getState().running).toBe(false);
});

it("finishes each walkthrough on the step the store counts as its last", () => {
  expect(WALKTHROUGH_STEPS).toEqual({ basics: BASICS_STEPS, campaign: CAMPAIGN_STEPS });
});

it("skips at any step, stays skipped after a reload, and replays from the menu on the same company", () => {
  start(); renderCompany();
  fireEvent.click(evidence().getByRole("button", { name: "App Server" }));
  fireEvent.click(within(card(2)).getByRole("button", { name: "Skip" }));
  expect(screen.queryByRole("dialog", { name: /^Tutorial/ })).toBeNull();
  cleanup(); useGame.setState(useGame.getInitialState(), true); start(); renderCompany();
  expect(screen.queryByRole("dialog", { name: /^Tutorial/ })).toBeNull();

  const before = structuredClone(useGame.getState().game);
  fireEvent.click(screen.getByRole("button", { name: "Menu" }));
  fireEvent.click(screen.getByRole("button", { name: /How to play/ }));
  expect(screen.queryByRole("dialog", { name: "Menu" })).toBeNull();
  expect(card(1)).toBeTruthy();
  expect(useGame.getState().game).toEqual(before);
});

it("waits behind a dialog that covers the room and comes back when it closes", async () => {
  start(); renderCompany();
  expect(card(1)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "View chapters" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: /^Tutorial/ })).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Back to company" }));
  await waitFor(() => expect(card(1)).toBeTruthy());
});

it("waits through an incident and its review, then resumes where the player left off", () => {
  start(); renderCompany();
  fireEvent.click(evidence().getByRole("button", { name: "App Server" }));
  act(() => { useGame.getState().setRunning(true); useGame.getState().tick(30); });
  expect(useGame.getState().game.phase).toBe("incident");
  expect(screen.queryByRole("dialog", { name: /^Tutorial/ })).toBeNull();
  expect(useGame.getState().tour).toEqual({ track: "campaign", step: 1 });
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
  expect(guide(3).textContent).toContain("Press Deploy Health Checks, then Confirm.");
  fireEvent.click(screen.getByRole("button", { name: /^Deploy Health Checks/ }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  expect(useGame.getState().tour).toBeNull();
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
