import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGame } from "@/game/store";
import { newGame } from "@/sim";
import { act as decide, tick } from "@/sim/__tests__/spikeFixtures";
import { CampaignOverlays } from "./CampaignUI";

beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function show(wide: boolean) {
  const listeners = new Set<() => void>();
  let matches = wide;
  vi.stubGlobal("matchMedia", () => ({ get matches() { return matches; }, addEventListener: (_type: string, listener: () => void) => listeners.add(listener), removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener) }));
  let game = decide(tick(newGame(), 6), { type: "start_db_upgrade" });
  for (let i = 0; i < 100 && game.phase !== "review"; i++) game = tick(game);
  game = decide(game, { type: "acknowledge_review" });
  const first = game.campaign!.reports[0];
  const second = structuredClone(first);
  second.id = "second-report";
  second.openedStep += 20;
  second.recoveredStep += 20;
  for (const sample of second.snapshots) { sample.step += 20; sample.db.capacity = 2000; sample.db.demand = 100; sample.app.capacity = 100; sample.app.demand = 200; for (const instance of sample.instances ?? []) { instance.capacity = 100; instance.demand = 200; } }
  second.events = [];
  game.campaign!.reports.push(second);
  useGame.setState({ game, ready: true, started: true, hasRun: true, onboarding: false, view: "history", running: false });
  render(<CampaignOverlays />);
  fireEvent.click(screen.getByRole("tab", { name: /^Incidents/ }));
  return { resize: (value: boolean) => act(() => { matches = value; for (const listener of listeners) listener(); }), game };
}
it("selects the newest report beside the index on desktop and moves keyboard focus to a chosen report", () => {
  const { game } = show(true);
  const index = screen.getByRole("navigation", { name: "Reports" });
  const newest = within(index).getByRole("button", { name: /Application overloaded/ });
  expect(newest.getAttribute("aria-current")).toBe("true");
  const older = within(index).getByRole("button", { name: /Database overloaded/ });
  fireEvent.click(older);
  const detail = screen.getByRole("region", { name: "Incident report" });
  expect(document.activeElement).toBe(within(detail).getByRole("heading", { name: "Database overloaded" }));
  expect(detail.textContent).toContain(`Game seconds ${game.campaign!.reports[0].openedStep}-${game.campaign!.reports[0].recoveredStep}`);
  expect(newest.getAttribute("aria-current")).toBeNull();
});
it("expands reports in place on narrow screens and keeps selection across resizing", () => {
  const { resize } = show(false);
  expect(screen.queryByRole("navigation", { name: "Reports" })).toBeNull();
  expect(screen.queryByRole("region", { name: "Incident report" })).toBeNull();
  const older = screen.getByRole("button", { name: /Database overloaded/ });
  fireEvent.click(older);
  expect(older.getAttribute("aria-expanded")).toBe("true");
  resize(true);
  expect(screen.getByRole("navigation", { name: "Reports" })).toBeTruthy();
  expect(within(screen.getByRole("region", { name: "Incident report" })).getByRole("heading", { name: "Database overloaded" })).toBeTruthy();
  resize(false);
  fireEvent.click(screen.getByRole("button", { name: /Database overloaded/ }));
  expect(screen.queryByRole("region", { name: "Incident report" })).toBeNull();
});
