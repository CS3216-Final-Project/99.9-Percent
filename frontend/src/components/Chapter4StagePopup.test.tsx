import InspectionReveal from "./InspectionReveal";
import { enterHighlightedInspection } from "./inspectionTestUtils";
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Chapter4StagePopup } from "./Chapter4StagePopup";
import { chapter4Stage } from "@/game/chapter4Guidance";
import { act as decide, tick, spikeCompany, untilOffset } from "@/sim/__tests__/spikeFixtures";
import { CampaignAttentionHost } from "./CampaignAttention";
import { CampaignHeader, CampaignPanel, CampaignControls } from "./CampaignUI";
import { useGame } from "@/game/store";
import { setConfirming } from "./actionConfirmation";

const initial = spikeCompany(false);
const limited = decide(initial, { type: "set_traffic_limit", enabled: true });
beforeEach(() => {
  localStorage.clear(); useGame.setState(useGame.getInitialState(), true); vi.spyOn(document, "hasFocus").mockReturnValue(true);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 10, y: 10, top: 10, left: 10, right: 54, bottom: 54, width: 44, height: 44, toJSON: () => ({}) });
});
afterEach(() => { cleanup(); setConfirming(null); vi.restoreAllMocks(); });
const popup = () => screen.queryByRole("dialog", { name: /^Chapter 4:/ });
const show = (offset = 0) => chapter4Stage(offset ? untilOffset(limited, offset) : initial)!;

it.each([[0, "Prepare", "prepare"], [8, "Spike 1", "pressure"], [28, "Between spikes", "recovery"], [48, "Spike 2", "pressure"], [68, "Recover", "recovery"]] as const)("renders the small nonmodal %s cue once", (offset, title, tone) => {
  const model = show(offset);
  render(<StrictMode><Chapter4StagePopup model={model} /></StrictMode>);
  expect(popup()?.getAttribute("aria-modal")).toBe("false");
  expect(popup()?.getAttribute("aria-label")).toBe(`Chapter 4: ${title}`);
  expect(popup()?.getAttribute("data-tone")).toBe(tone);
  expect(document.querySelector(".modal-backdrop")).toBeNull();
  fireEvent.click(within(popup()!).getByRole("button", { name: "Got it" })); expect(popup()).toBeNull();
  cleanup(); render(<Chapter4StagePopup model={model} />); expect(popup()).toBeNull();
});
it("sequences Spike 1 then Respond only while overloaded, and deduplicates both", () => {
  const model = chapter4Stage(untilOffset(initial, 8))!;
  render(<Chapter4StagePopup model={model} />);
  fireEvent.click(within(popup()!).getByRole("button", { name: "Got it" }));
  expect(popup()?.textContent).toContain("Pause and inspect");
  expect(popup()?.getAttribute("data-tone")).toBe("pressure");
  fireEvent.click(within(popup()!).getByRole("button", { name: "Dismiss chapter guidance" }));
  expect(popup()).toBeNull(); cleanup(); render(<Chapter4StagePopup model={model} />); expect(popup()).toBeNull();
});
it("does not repeat a displayed cue on remount even before explicit dismissal", () => {
  const model = show(); render(<StrictMode><Chapter4StagePopup model={model} /></StrictMode>);
  expect(popup()).not.toBeNull(); cleanup(); render(<Chapter4StagePopup model={model} />); expect(popup()).toBeNull();
});
it("does not replay earlier stages when loading in the middle of the chapter", () => {
  render(<Chapter4StagePopup model={show(48)} />);
  expect(popup()?.getAttribute("aria-label")).toBe("Chapter 4: Spike 2");
});
it("allows Escape without running the company or trapping focus", () => {
  const button = document.createElement("button"); document.body.append(button); button.focus();
  render(<Chapter4StagePopup model={show()} />); expect(document.activeElement).toBe(button);
  fireEvent.keyDown(popup()!, { key: "Escape" }); expect(popup()).toBeNull(); button.remove();
});
it("retains an in-memory receipt when browser storage is unavailable", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw Error("Unavailable"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("Unavailable"); });
  const model = { ...show(), key: "blocked-storage-company" };
  render(<Chapter4StagePopup model={model} />); expect(popup()).not.toBeNull();
  cleanup(); render(<Chapter4StagePopup model={model} />); expect(popup()).toBeNull();
});
it("preserves pause/resume, manual Hint ownership and confirmation priority without changing the company", () => {
  useGame.setState({ game: initial, ready: true, started: true, running: false, onboarding: false, tour: null });
  render(<CampaignAttentionHost><CampaignHeader /><CampaignPanel /><InspectionReveal /><CampaignControls /></CampaignAttentionHost>);
  const before = useGame.getState().game;
  fireEvent.click(within(screen.getByRole("dialog", { name: "Company Message" })).getByRole("button", { name: "Dismiss company message" }));
  expect(popup()).not.toBeNull(); act(() => useGame.getState().setRunning(true)); expect(popup()).not.toBeNull();
  act(() => useGame.getState().setRunning(false)); expect(popup()).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Hint" })); expect(popup()).toBeNull();
  expect(screen.queryByRole("dialog", { name: "Hint" })).not.toBeNull();
  act(() => setConfirming("Add server")); expect(popup()).toBeNull();
  expect(useGame.getState().game).toBe(before);
});
it("never overlays an active incident or its immediate Pause control", () => {
  const game = untilOffset(initial, 10);
  expect(game.phase).toBe("incident");
  useGame.setState({ game, ready: true, started: true, running: true, onboarding: false, tour: null });
  render(<CampaignAttentionHost><CampaignHeader /><CampaignPanel /><InspectionReveal /><CampaignControls /></CampaignAttentionHost>);
  expect(popup()).toBeNull(); expect(screen.getByRole("button", { name: "Pause" })).not.toBeNull();
});
it("transfers Hint to the small server's real Scale up, immediate Confirm, and accepted-install Run", async () => {
  const game = tick(decide(untilOffset(initial, 8), { type: "add_server" }), 2);
  useGame.setState({ game, ready: true, started: true, running: false, onboarding: false, tour: null, selected: "app", selectedAppId: "app-3", panelOpen: true });
  render(<CampaignAttentionHost><CampaignHeader /><CampaignPanel /><InspectionReveal /><CampaignControls /></CampaignAttentionHost>);
  const gold = () => document.querySelectorAll(".campaign-gold-attention");
  fireEvent.click(screen.getByRole("button", { name: "Hint" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Hint" })).getByRole("button", { name: "Got it" })); enterHighlightedInspection();
  await act(async()=>{});enterHighlightedInspection();
  expect(gold()).toHaveLength(1); expect(gold()[0].textContent).toContain("Scale up App 3");
  fireEvent.click(gold()[0]); expect(gold()).toHaveLength(1); expect(gold()[0].textContent).toBe("Confirm");
  expect(useGame.getState().game.campaign!.step).toBe(game.campaign!.step);
  expect(useGame.getState().game.campaign!.cashCents).toBe(game.campaign!.cashCents);
  fireEvent.click(gold()[0]); expect(useGame.getState().game.campaign!.pending.some(a => a.type === "scale-up")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Hint" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Hint" })).getByRole("button", { name: "Got it" })); enterHighlightedInspection();
  expect(gold()).toHaveLength(1); expect(gold()[0].getAttribute("aria-label")).toBe("Run");
});

it("escapes stale About Network advice with protective Run when the open inspector predates the pulse", () => {
  const game = untilOffset(decide(limited, { type: "incident_inspect", equipment: "gateway" }), 8);
  useGame.setState({ game, ready: true, started: true, running: false, onboarding: false, tour: null, selected: "gateway", panelOpen: true });
  render(<CampaignAttentionHost><CampaignHeader /><CampaignPanel /><InspectionReveal /><CampaignControls /></CampaignAttentionHost>);
  fireEvent.click(screen.getByRole("button", { name: "Hint" }));
  const hint = screen.getByRole("dialog", { name: "Hint" });
  expect(hint.textContent).toContain("Keep the limit"); expect(hint.textContent).not.toContain("About Network");
  fireEvent.click(within(hint).getByRole("button", { name: "Got it" })); enterHighlightedInspection();
  const gold = document.querySelectorAll(".campaign-gold-attention");
  expect(gold).toHaveLength(1); expect(gold[0].getAttribute("aria-label")).toBe("Run");
  expect(useGame.getState().game).toBe(game);
});

it("targets Remove traffic limit in an already-open Network panel, yields to Confirm, and recovers after Cancel", () => {
  let game = tick(decide(initial, { type: "add_server" }), 2);
  game = tick(decide(game, { type: "scale_up", appId: "app-3" }), 3);
  game = tick(decide(game, { type: "set_routing", mode: "balanced", targets: ["app-1", "app-2", "app-3"] }));
  game = untilOffset(tick(decide(game, { type: "set_traffic_limit", enabled: true })), 8);
  useGame.setState({ game, ready: true, started: true, running: false, onboarding: false, tour: null, selected: "gateway", panelOpen: true });
  render(<CampaignAttentionHost><CampaignHeader /><CampaignPanel /><InspectionReveal /><CampaignControls /></CampaignAttentionHost>);
  const gold = () => document.querySelectorAll<HTMLElement>(".campaign-gold-attention");
  const accept = () => {
    fireEvent.click(screen.getByRole("button", { name: "Hint" }));
    const hint = screen.getByRole("dialog", { name: "Hint" }); expect(hint.textContent).not.toContain("About Network");
    fireEvent.click(within(hint).getByRole("button", { name: "Got it" })); enterHighlightedInspection();
    expect(gold()).toHaveLength(1);
  };
  accept(); const inspected=useGame.getState().game;expect(gold()[0].textContent).toContain("Remove traffic limit"); fireEvent.click(gold()[0]);
  expect(gold()).toHaveLength(1); expect(gold()[0].textContent).toBe("Confirm");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(gold()).toHaveLength(0); expect(useGame.getState().game).toBe(inspected);
  accept(); fireEvent.click(gold()[0]); fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  expect(useGame.getState().game.campaign!.pending.some(p => p.type === "unlimit")).toBe(true);
  accept(); expect(gold()[0].getAttribute("aria-label")).toBe("Run");
});
