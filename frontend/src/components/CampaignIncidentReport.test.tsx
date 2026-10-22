import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGame } from "@/game/store";
import { newGame } from "@/sim";
import { act as decide, tick } from "@/sim/__tests__/spikeFixtures";
import { CampaignOverlays } from "./CampaignUI";
import { CampaignIncidentReport } from "./CampaignIncidentReport";

let serial = 0;
function recovery() {
  let g = decide(tick(newGame(1, `recovery-ui-${++serial}`), 6), { type: "start_db_upgrade" });
  while (g.phase !== "review") g = tick(g);
  return g;
}
function show(game = recovery()) {
  useGame.setState({ game, ready: true, started: true, hasRun: true, onboarding: false, tour: null });
  return render(<StrictMode><CampaignOverlays /></StrictMode>);
}
beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("waits for authoritative review, not purchase, improving metrics or a retained older report", () => {
  const game = decide(tick(newGame(), 6), { type: "start_db_upgrade" });
  show(game); expect(screen.queryByRole("dialog")).toBeNull();
  let improving = tick(game); while (!improving.campaign!.incident?.stableSteps) improving = tick(improving);
  act(() => useGame.setState({ game: improving })); expect(screen.queryByRole("dialog")).toBeNull();
  const confirmed = recovery(); act(() => useGame.setState({ game: confirmed }));
  expect(screen.getByRole("dialog", { name: "System Recovered!" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "View Incident Report" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue company" }));
  expect(screen.queryByRole("dialog", { name: "System Recovered!" })).toBeNull();
});
it("shows one acknowledgement, focuses the report button, and leaves acknowledgement/progression to Continue company", () => {
  const game = recovery(); const view = show(game);
  const button = screen.getByRole("button", { name: "View Incident Report" }); expect(document.activeElement).toBe(button);
  expect(screen.queryByRole("dialog", { name: "Incident postmortem" })).toBeNull();
  fireEvent.keyDown(button, { key: "Escape" }); expect(screen.getByRole("dialog", { name: "System Recovered!" })).toBeTruthy();
  fireEvent.click(button); const report = screen.getByRole("dialog", { name: "Incident postmortem" });
  expect(useGame.getState().game).toBe(game); expect(document.activeElement).toBe(within(report).getByRole("button", { name: "Continue company" }));
  expect(within(report).getAllByRole("heading", { level: 3 }).filter(n => !n.closest("details")).map(e => e.textContent)).toEqual(["What happened?", "How did you respond?", "What could be improved?", "Key takeaway"]);
  view.unmount(); show(game); expect(screen.queryByRole("dialog", { name: "System Recovered!" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Continue company" }));
  const after = useGame.getState().game;
  expect(after.phase).toBe("management"); expect(after.campaign!.runId).toBe(game.campaign!.runId);
  expect(after.campaign!.step).toBe(game.campaign!.step); expect(after.campaign!.cashCents).toBe(game.campaign!.cashCents);
  expect(after.campaign!.trace.filter(e => e.type === "review-acknowledged")).toHaveLength(1);
});
it("retains every explanation, observation and event behind one collapsed technical disclosure", () => {
  const r = recovery().campaign!.reports[0]; render(<CampaignIncidentReport report={r} />);
  const detail = screen.getByText("View Technical Details").closest("details")!;
  expect(detail.open).toBe(false); expect(screen.getByLabelText("Recovery summary").querySelectorAll("dt")).toHaveLength(3);
  fireEvent.click(screen.getByText("View Technical Details"));
  for (const explanation of r.explanations) expect(detail.textContent).toContain(explanation);
  expect(detail.textContent).toContain(JSON.stringify(r.snapshots, null, 2));
  for (const event of r.events) expect(detail.textContent).toContain(JSON.stringify(event.data, null, 2));
  expect(screen.getByRole("table")).toBeTruthy();
});
it("consolidates missing workload details and does not render an empty evidence table", () => {
  const r = structuredClone(recovery().campaign!.reports[0]); for (const s of r.snapshots) delete s.data;
  const view = render(<CampaignIncidentReport report={r} />);
  expect(screen.getAllByText(/workload and cache details were not recorded/)).toHaveLength(1);
  expect(screen.queryByText(/Workload detail not recorded in this historical snapshot/)).toBeNull();
  view.rerender(<CampaignIncidentReport report={{ ...r, snapshots: [], events: [] }} />);
  expect(screen.queryByRole("table", { hidden: true })).toBeNull(); expect(screen.getByText("No historical observations were retained.")).toBeTruthy();
});
it.each(["walkthrough", "practice"])("preserves the existing %s report instead of the new flow", kind => {
  const game = recovery(); useGame.setState({ game, started: true, tour: { track: "campaign", step: 0 }, tutorialCompany: kind === "practice" ? { game, remainderMs: 0, measurement: useGame.getState().measurement } : null });
  render(<CampaignOverlays />); expect(screen.queryByRole("dialog", { name: "System Recovered!" })).toBeNull();
  expect(screen.getByRole("dialog", { name: "Incident postmortem" }).textContent).toContain("Recorded causes, actions and trade-offs");
});
it("still opens the report when receipt storage is unavailable and avoids repeats during the visit", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw Error("unavailable"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("unavailable"); });
  const game = recovery(); const view = show(game); fireEvent.click(screen.getByRole("button", { name: "View Incident Report" }));
  view.unmount(); show(game); expect(screen.getByRole("dialog", { name: "Incident postmortem" })).toBeTruthy();
});
it("does not confuse a new recovered incident with the previous presentation receipt", () => {
  const game = recovery(); show(game);
  fireEvent.click(screen.getByRole("button", { name: "View Incident Report" }));
  const next = structuredClone(game); next.campaign!.reports.at(-1)!.id += "-next";
  act(() => useGame.setState({ game: next }));
  expect(screen.getByRole("dialog", { name: "System Recovered!" })).toBeTruthy();
});
