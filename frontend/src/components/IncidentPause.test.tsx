import InspectionReveal from "./InspectionReveal";
import { inspectionAction, enterHighlightedInspection } from "./inspectionTestUtils";
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGame } from "@/game/store";
import { newGame } from "@/sim";
import { act as decide, tick } from "@/sim/__tests__/spikeFixtures";
import { pauseTransition } from "@/sim/__tests__/pauseFixture";
import { CampaignAttentionHost } from "./CampaignAttention";
import { CampaignHeader, CampaignPanel, CampaignControls, CampaignOverlays } from "./CampaignUI";

// Construct engine-heavy companies once outside each UI interaction deadline.
// Every test still receives isolated snapshots and exercises the real store/host.
const transitions = new Map([1, 2, 3, 4, 5, 6].map(chapter => [chapter, pauseTransition(chapter)]));
const transition = (chapter: number) => structuredClone(transitions.get(chapter)!);
const pointerLockDescriptor = Object.getOwnPropertyDescriptor(document, "pointerLockElement");

beforeEach(() => {
  localStorage.clear(); useGame.setState(useGame.getInitialState(), true);
  // jsdom does not implement native pointer capture; model only this browser boundary.
  Object.defineProperty(document, "pointerLockElement", { configurable: true, get: () => null });
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 10, y: 10, top: 10, left: 10, right: 54, bottom: 54, width: 44, height: 44, toJSON: () => ({}) });
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
});
afterEach(() => {
  cleanup(); vi.useRealTimers(); vi.restoreAllMocks();
  if (pointerLockDescriptor) Object.defineProperty(document, "pointerLockElement", pointerLockDescriptor);
  else Reflect.deleteProperty(document, "pointerLockElement");
});
function show(game = transition(3).before) {
  useGame.setState({ game, ready: true, started: true, running: false, onboarding: false, tour: null });
  render(<StrictMode><CampaignAttentionHost><CampaignHeader /><CampaignPanel /><InspectionReveal /><CampaignControls /><CampaignOverlays /></CampaignAttentionHost></StrictMode>);
}
const gold = () => document.querySelectorAll(".campaign-gold-attention");
function startIncident() {
  fireEvent.click(screen.getByRole("button", { name: "Run" }));
  act(() => useGame.getState().tick(1));
}
it.each([1, 2, 3, 4, 5, 6])("gives the running Chapter %i transition immediate sole Pause attention without stopping time", chapter => {
  const { before, incident } = transition(chapter); show(before); startIncident();
  expect(useGame.getState().game.campaign!.incident!.id).toBe(incident.campaign!.incident!.id);
  expect(useGame.getState().running).toBe(true); expect(gold()).toHaveLength(1);
  expect(gold()[0].getAttribute("aria-label")).toBe("Pause");
  act(() => useGame.getState().tick(1)); expect(useGame.getState().running).toBe(true);
  expect(gold()).toHaveLength(1); expect(gold()[0].getAttribute("aria-label")).toBe("Pause");
});
it("preserves the actual first-incident automatic stop and does not nag on resuming an existing incident", () => {
  show(tick(newGame(), 5)); startIncident();
  expect(useGame.getState().game.phase).toBe("incident"); expect(useGame.getState().running).toBe(false);
  expect(gold()).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Run" })); expect(gold()).toHaveLength(0);
});
it("Pause leads to a fresh ten-second Hint, accepted action, immediate Confirm and eventual Run", () => {
  show(transition(1).before); startIncident();
  fireEvent.click(screen.getByRole("button", { name: "Pause" })); expect(gold()).toHaveLength(0);
  expect(useGame.getState().running).toBe(false);
  act(() => vi.advanceTimersByTime(9999)); expect(gold()).toHaveLength(0);
  act(() => vi.advanceTimersByTime(1)); expect(gold()).toHaveLength(1); expect(gold()[0].getAttribute("aria-label")).toBe("Hint");
  fireEvent.click(screen.getByRole("button", { name: "Hint" }));
  fireEvent.click(screen.getByRole("button", { name: "Got it" })); enterHighlightedInspection();
  expect(gold()).toHaveLength(1); expect(gold()[0].textContent).toContain("Upgrade database");
  fireEvent.click(gold()[0]); expect(gold()).toHaveLength(1); expect(gold()[0].textContent).toBe("Confirm");
  fireEvent.click(gold()[0]); expect(gold()).toHaveLength(0); expect(useGame.getState().running).toBe(false);
  act(() => vi.advanceTimersByTime(10000)); expect(gold()).toHaveLength(1); expect(gold()[0].getAttribute("aria-label")).toBe("Run");
  fireEvent.click(gold()[0]); expect(gold()).toHaveLength(0);
  for (let i = 0; i < 30 && useGame.getState().game.phase !== "review"; i++) act(() => useGame.getState().tick(1));
  expect(useGame.getState().game.phase).toBe("review"); expect(useGame.getState().running).toBe(false); expect(gold()).toHaveLength(0);
  expect(screen.getByRole("dialog", { name: "System Recovered!" })).toBeTruthy();
});
it("dismisses on deliberate activity, never rearming the same incident on ticks or rerenders", () => {
  show(); startIncident(); expect(gold()).toHaveLength(1);
  fireEvent.keyDown(document, { key: "Shift" }); fireEvent.keyUp(document, { key: "Shift" }); expect(gold()).toHaveLength(0);
  act(() => useGame.getState().tick(1));
  act(() => useGame.setState({ game: structuredClone(useGame.getState().game) })); expect(gold()).toHaveLength(0);
  act(() => vi.advanceTimersByTime(10000)); expect(gold()).toHaveLength(1); expect(gold()[0].getAttribute("aria-label")).toBe("Hint");
});
it("does not arm on paused arrival or initial mount into a saved incident", () => {
  const { before, incident } = transition(3); show(before);
  act(() => useGame.setState({ game: incident })); expect(gold()).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Run" })); expect(gold()).toHaveLength(0);
});
it("does not nag while a relevant accepted change and qualifying observations require time", () => {
  const pair = transition(1); show(decide(pair.before, { type: "start_db_upgrade" }));
  startIncident(); expect(useGame.getState().running).toBe(true); expect(gold()).toHaveLength(0);
  for (let i = 0; i < 30 && useGame.getState().game.phase !== "review"; i++) {
    act(() => useGame.getState().tick(1)); expect(gold()).toHaveLength(0);
  }
});
it("preserves a still-valid accepted investigation when its new incident opens", () => {
  show(transition(3).before);
  fireEvent.click(screen.getByRole("button", { name: "Run" }));
  // The observed overload already exists before the third qualifying overloaded second opens the incident.
  fireEvent.click(screen.getByRole("button", { name: "Hint" }));
  fireEvent.click(screen.getByRole("button", { name: "Got it" })); enterHighlightedInspection();
  const target = gold()[0]; expect(target.textContent).toContain("Upgrade database");
  act(() => useGame.getState().tick(1)); expect(gold()).toHaveLength(1); expect(gold()[0]).toBe(target);
});
it("a modal consumes the one-time offer rather than deferring it until the modal closes", async () => {
  show(); startIncident(); const modal = document.createElement("div"); modal.className = "modal-backdrop";
  await act(async () => { document.body.append(modal); }); expect(gold()).toHaveLength(0);
  await act(async () => { modal.remove(); }); act(() => useGame.getState().tick(1)); expect(gold()).toHaveLength(0);
});
it("chapter tutorial ownership suppresses the new offer", () => {
  const { before } = transition(3); show(before);
  act(() => useGame.setState({ tour: { track: "data", step: 0 } })); startIncident(); expect(gold()).toHaveLength(0);
});
it("a valid purchase Confirm wins immediately and consumes the Pause invitation", () => {
  show(transition(1).before); startIncident(); expect(gold()).toHaveLength(1);
  fireEvent.click(inspectionAction(/^Upgrade database/));
  expect(gold()).toHaveLength(1); expect(gold()[0].textContent).toBe("Confirm");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" })); expect(gold()).toHaveLength(0);
  act(() => useGame.getState().tick(1)); expect(gold()).toHaveLength(0);
});
it("leaves practice incident controls alone", () => {
  const { before, incident } = transition(3); show(before);
  act(() => useGame.setState({ game: incident, running: true,
    tutorialCompany: { game: before, remainderMs: 0, measurement: useGame.getState().measurement } }));
  expect(gold()).toHaveLength(0); expect(screen.queryByRole("button", { name: "Hint" })).toBeNull();
});
it("offers Pause for a later distinct incident in the same company after a free recovery strategy", () => {
  show(pauseTransition(1, "pause-repeat").before); startIncident();
  const first = useGame.getState().game.campaign!.incident!.id;
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  fireEvent.click(inspectionAction(/^Limit to 500/));
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  fireEvent.click(screen.getByRole("button", { name: "Run" }));
  for (let i = 0; i < 40 && useGame.getState().game.phase !== "review"; i++) act(() => useGame.getState().tick(1));
  expect(useGame.getState().game.phase).toBe("review"); expect(gold()).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "View Incident Report" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue company" }));
  fireEvent.click(inspectionAction(/^Remove traffic limit/));
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  fireEvent.click(screen.getByRole("button", { name: "Run" }));
  for (let i = 0; i < 10 && !useGame.getState().game.campaign!.incident; i++) act(() => useGame.getState().tick(1));
  expect(useGame.getState().game.campaign!.incident!.id).not.toBe(first);
  expect(useGame.getState().running).toBe(true); expect(gold()).toHaveLength(1); expect(gold()[0].getAttribute("aria-label")).toBe("Pause");
});
it("does not defer a background incident invitation until focus returns", () => {
  show(); fireEvent.click(screen.getByRole("button", { name: "Run" }));
  fireEvent(window, new Event("blur")); act(() => useGame.getState().tick(1)); expect(gold()).toHaveLength(0);
  fireEvent(window, new Event("focus")); expect(gold()).toHaveLength(0);
});

it.each([1, 2, 3, 4, 5, 6])("marks a running Chapter %i incident with the mouse captured, and keeps it through Escape", chapter => {
  show(transition(chapter).before); const canvas = document.createElement("canvas"); document.body.append(canvas);
  const lock = vi.spyOn(document, "pointerLockElement", "get").mockReturnValue(canvas);
  fireEvent(document, new Event("pointerlockchange"));
  startIncident(); expect(gold()).toHaveLength(1); expect(gold()[0].getAttribute("aria-label")).toBe("Pause");
  fireEvent.keyDown(document, { key: "Escape" });
  lock.mockReturnValue(null); fireEvent(document, new Event("pointerlockchange"));
  expect(gold()).toHaveLength(1); expect(gold()[0].getAttribute("aria-label")).toBe("Pause");
  fireEvent.click(gold()[0]); expect(gold()).toHaveLength(0); expect(useGame.getState().running).toBe(false);
  canvas.remove();
});

it("does not treat repeated held movement as acknowledgement of a new incident", () => {
  show(); startIncident(); expect(gold()).toHaveLength(1);
  fireEvent.keyDown(document, { key: "w", repeat: true });
  expect(gold()).toHaveLength(1); expect(gold()[0].getAttribute("aria-label")).toBe("Pause");
  fireEvent.keyDown(document, { key: "w", repeat: false }); expect(gold()).toHaveLength(0);
});
it("still gives a real modal priority while the room owns the pointer", async () => {
  show(); const canvas = document.createElement("canvas"); document.body.append(canvas);
  vi.spyOn(document, "pointerLockElement", "get").mockReturnValue(canvas);
  fireEvent(document, new Event("pointerlockchange"));
  const modal = document.createElement("div"); modal.className = "modal-backdrop";
  await act(async () => { document.body.append(modal); });
  startIncident(); expect(useGame.getState().running).toBe(true); expect(gold()).toHaveLength(0);
  await act(async () => { modal.remove(); canvas.remove(); });
  expect(gold()).toHaveLength(0);
});
it("does not offer Pause during accepted recovery work with the mouse captured", () => {
  show(decide(transition(1).before, { type: "start_db_upgrade" }));
  const canvas = document.createElement("canvas"); document.body.append(canvas);
  vi.spyOn(document, "pointerLockElement", "get").mockReturnValue(canvas);
  fireEvent(document, new Event("pointerlockchange"));
  startIncident(); expect(useGame.getState().running).toBe(true); expect(gold()).toHaveLength(0);
  canvas.remove();
});

/** Purchases live on the panel's Actions tab. */
