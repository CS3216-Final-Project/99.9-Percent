import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { financiallyTrappedCompany } from "@/game/__fixtures__/chapter6Finance";
import { useGame } from "@/game/store";
import { CampaignAttentionHost } from "./CampaignAttention";
import { CampaignHeader, CampaignPanel, CampaignControls } from "./CampaignUI";
import { combinedCompany } from "@/sim/__tests__/combinedFixture";

const trapped = financiallyTrappedCompany();
beforeEach(() => {
  localStorage.clear(); useGame.setState(useGame.getInitialState(), true);
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 10, y: 10, top: 10, left: 10, right: 54, bottom: 54, width: 44, height: 44, toJSON: () => ({}) });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
function show(game = trapped) {
  useGame.setState({ game, ready: true, started: true, running: false, onboarding: false, tour: null });
  render(<CampaignAttentionHost><CampaignHeader/><CampaignPanel/><CampaignControls/></CampaignAttentionHost>);
}

it("warns honestly, cues Hint first and transfers only accepted attention to existing finances", () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  show();
  expect(screen.getByText("Capacity funding blocked")).toBeTruthy();
  const gold = () => document.querySelectorAll<HTMLElement>(".campaign-gold-attention");
  act(() => vi.advanceTimersByTime(10000));
  expect(gold()).toHaveLength(1); expect(gold()[0].getAttribute("aria-label")).toBe("Hint");
  fireEvent.click(screen.getByRole("button", { name: "Hint" }));
  const hint = screen.getByRole("dialog", { name: "Hint" });
  expect(hint.textContent).toContain("at most $7,200");
  expect(hint.textContent).toContain("cannot fund a capacity improvement");
  fireEvent.click(within(hint).getByRole("button", { name: "Got it" }));
  expect(gold()).toHaveLength(1); expect(gold()[0].getAttribute("aria-label")).toBe("View finances");
  expect(useGame.getState().game).toBe(trapped);
  fireEvent.click(gold()[0]);
  const finances = screen.getByRole("dialog", { name: "Company finances" });
  expect(within(finances).getByRole("note").textContent).toContain("open Menu to export your save");
  expect(gold()).toHaveLength(0);
  expect(useGame.getState().game).toBe(trapped);
  fireEvent.click(within(finances).getByRole("button", { name: "Close" }));
  expect(gold()).toHaveLength(0);
});

it("does not add a financial warning or compete with preparation for a healthy company", () => {
  show(combinedCompany());
  expect(screen.queryByText("Capacity funding blocked")).toBeNull();
  expect(screen.queryByText("Money at risk")).toBeNull();
});
