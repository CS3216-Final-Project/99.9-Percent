import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Chapter6StagePopup } from "./Chapter4StagePopup";
import { chapter6Stage } from "@/game/chapter6Guidance";
import { act as decide, tick, combinedCompany } from "@/sim/__tests__/combinedFixture";
import { CampaignAttentionHost } from "./CampaignAttention";
import { CampaignHeader, CampaignPanel, CampaignControls } from "./CampaignUI";
import { useGame } from "@/game/store";
import { setConfirming } from "./actionConfirmation";

const initial = tick(decide(combinedCompany(), { type: "set_traffic_limit", enabled: true }));
beforeEach(() => {
  localStorage.clear(); useGame.setState(useGame.getInitialState(), true);
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 10, y: 10, top: 10, left: 10, right: 54, bottom: 54, width: 44, height: 44, toJSON: () => ({}) });
});
afterEach(() => { cleanup(); setConfirming(null); vi.useRealTimers(); vi.restoreAllMocks(); });

it("gives Hint the ten-second idle cue while safe limit removal still needs a decision", () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  useGame.setState({ game: initial, ready: true, started: true, running: false, onboarding: false, tour: null });
  render(<CampaignAttentionHost><CampaignHeader/><CampaignPanel/><CampaignControls/></CampaignAttentionHost>);
  act(() => vi.advanceTimersByTime(9999)); expect(document.querySelectorAll(".campaign-gold-attention")).toHaveLength(0);
  act(() => vi.advanceTimersByTime(1));
  const gold = document.querySelectorAll(".campaign-gold-attention");
  expect(gold).toHaveLength(1); expect(gold[0].getAttribute("aria-label")).toBe("Hint");
});

it("persists the preparation receipt across StrictMode, pause/resume and remount without changing a save", () => {
  const model = chapter6Stage(initial)!;
  const before = JSON.stringify(initial);
  const first = render(<StrictMode><Chapter6StagePopup model={model}/></StrictMode>);
  expect(screen.getByRole("dialog").getAttribute("data-tone")).toBe("prepare");
  first.rerender(<StrictMode><Chapter6StagePopup model={chapter6Stage(structuredClone(initial))!}/></StrictMode>);
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Got it" })); first.unmount();
  render(<Chapter6StagePopup model={model}/>); expect(screen.queryByRole("dialog")).toBeNull();
  expect(JSON.stringify(initial)).toBe(before);
});

it("shares the coloured nonmodal component for wave and recovery milestones", () => {
  const wave = decide(tick(combinedCompany(), 5), { type: "start_growth_wave" });
  const model = chapter6Stage(wave)!;
  const view = render(<Chapter6StagePopup model={model}/>);
  expect(screen.getByRole("dialog").getAttribute("data-tone")).toBe("pressure");
  expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("false");
  fireEvent.click(screen.getByRole("button", { name: "Got it" }));
  view.rerender(<Chapter6StagePopup model={chapter6Stage(tick(wave, 24))!}/>);
  expect(screen.getByRole("dialog").getAttribute("data-tone")).toBe("recovery");
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("transfers selected Network to Remove, immediate Confirm, accepted Run and clears after Cancel", () => {
  useGame.setState({ game: initial, ready: true, started: true, running: false, onboarding: false, tour: null, selected: "gateway", panelOpen: true });
  render(<CampaignAttentionHost><CampaignHeader/><CampaignPanel/><CampaignControls/></CampaignAttentionHost>);
  const gold = () => document.querySelectorAll<HTMLElement>(".campaign-gold-attention");
  const accept = () => {
    fireEvent.click(screen.getByRole("button", { name: "Hint" }));
    const hint = screen.getByRole("dialog", { name: "Hint" });
    expect(hint.textContent).not.toContain("About Network");
    fireEvent.click(within(hint).getByRole("button", { name: "Got it" }));
    expect(gold()).toHaveLength(1);
  };
  accept(); expect(gold()[0].textContent).toContain("Remove traffic limit"); fireEvent.click(gold()[0]);
  expect(gold()).toHaveLength(1); expect(gold()[0].textContent).toBe("Confirm");
  expect(screen.queryByRole("dialog", { name: /^Chapter 6:/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(useGame.getState().game).toBe(initial); expect(gold()).toHaveLength(0);
  accept(); fireEvent.click(gold()[0]); fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  expect(useGame.getState().game.campaign!.pending.some(a => a.type === "unlimit")).toBe(true);
  accept(); expect(gold()[0].getAttribute("aria-label")).toBe("Run");
});

it("yields to real running incidents and mandatory growth reviews", () => {
  let wave = decide(tick(combinedCompany(), 5), { type: "start_growth_wave" });
  // Accepted first wave is healthy, then cap/routing can expose a real app bottleneck.
  wave = tick(decide(wave, { type: "set_routing", mode: "single", targets: ["app-1"] }), 11);
  expect(wave.phase).toBe("incident");
  useGame.setState({ game: wave, ready: true, started: true, running: true, onboarding: false, tour: null });
  render(<CampaignAttentionHost><CampaignHeader/><CampaignPanel/><CampaignControls/></CampaignAttentionHost>);
  expect(screen.queryByRole("dialog", { name: /^Chapter 6:/ })).toBeNull();
});
