import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGame } from "@/game/store";
import { newGame } from "@/sim";
import { act as decide, tick } from "@/sim/__tests__/spikeFixtures";
import { CampaignOverlays } from "./CampaignUI";
import { CampaignIncidentReport, CapacityAfterFailure } from "./CampaignIncidentReport";
import { reliabilityOutcome } from "@/game/__fixtures__/reliabilityOutcome";
import { describeEvents, reportWindowStart } from "@/game/reportEvents";

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
  expect(detail.open).toBe(false); expect(screen.getByLabelText("Recovery summary").querySelectorAll("dt").length).toBeGreaterThanOrEqual(3);
  fireEvent.click(screen.getByText("View Technical Details"));
  for (const explanation of r.explanations) expect(detail.textContent).toContain(explanation);
  const from = reportWindowStart(r);
  for (const m of r.snapshots.filter(m => m.step >= from)) expect(within(screen.getByRole("table", { name: "Recorded incident evidence by game second" })).getByRole("rowheader", { name: String(m.step) })).toBeTruthy();
  expect(detail.querySelectorAll(".report-events li")).toHaveLength(describeEvents(r.events).filter(e => e.step >= from && e.step <= r.recoveredStep).length);
  expect(detail.querySelector("pre")).toBeNull();
});
it("consolidates missing workload details and does not render an empty evidence table", () => {
  const r = structuredClone(recovery().campaign!.reports[0]); for (const s of r.snapshots) delete s.data;
  const view = render(<CampaignIncidentReport report={r} />);
  // Without any workload readings the section is left out rather than explained.
  expect(screen.queryByText("Workload and cache evidence")).toBeNull();
  expect(screen.queryByText(/workload and cache details were not recorded/)).toBeNull();
  view.rerender(<CampaignIncidentReport report={{ ...r, snapshots: [], events: [] }} />);
  expect(screen.queryByRole("table", { hidden: true })).toBeNull(); expect(screen.getByText("No historical observations were retained.")).toBeTruthy();
});
it("preserves the existing practice report instead of the new flow", () => {
  const game = recovery(); useGame.setState({ game, started: true, tutorialCompany: { game, remainderMs: 0, measurement: useGame.getState().measurement } });
  render(<CampaignOverlays />); expect(screen.queryByRole("dialog", { name: "System Recovered!" })).toBeNull();
  expect(screen.getByRole("dialog", { name: "Incident postmortem" }).textContent).toContain("Causes, actions and trade-offs");
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

it("says the load balancer kept sending traffic to a failed server instead of claiming enough capacity", () => {
  const c = reliabilityOutcome(true).campaign!, f = c.reliabilityStage!.fault!;
  render(<CampaignIncidentReport report={c.reports.find(r => r.snapshots.some(m => m.reliability?.faultId === f.id))!} />);
  const block = screen.getByRole("region", { name: "Capacity after the failure" });
  expect(within(block).getByText("Sent to the failed App 3").nextSibling?.textContent).toBe("800 req/s, all failed");
  expect(block.textContent).toContain(`every request the load balancer sent to App 3 failed until it was restored at game second ${f.restoredStep}.`);
  expect(block.textContent).toContain("The healthy servers could serve their own 1,600 req/s; the errors came from the failed server staying in the route.");
  expect(block.textContent).not.toContain("enough capacity");
  // A failed server does no work, so the evidence table never credits it with capacity.
  fireEvent.click(screen.getByText("View Technical Details", { exact: true }));
  const evidence = screen.getByRole("table", { name: "Recorded incident evidence by game second" });
  expect(evidence.textContent).toContain("App 3: 800 / 0 · 0 (failed)");
  expect(evidence.textContent).not.toMatch(/App 3: [\d,]+ \/ 1,600 · [\d,]+ \(failed/);
});

it.each([
  [{ toFailed: 800, stopped: { step: 21, by: "rerouted" as const, admitted: 2400, capacity: 3200 } }, "failed until it was taken out of the route at game second 21", "the errors came from the failed server staying in the route."],
  [{ toFailed: 800, stopped: { step: 21, by: "rerouted" as const, admitted: 2400, capacity: 1600 } }, "failed until it was taken out of the route at game second 21", "the healthy servers could serve 1,600 of the 2,400 req/s admitted, so they stayed overloaded"],
  [{ toFailed: 800, stopped: null, capacity: 1200 }, "failed until it was taken out of the route or restored", "overloaded by their own share as well"],
  [{ toFailed: 0, stopped: null }, "No traffic reached the failed server", "had enough capacity for everything admitted"],
  [{ toFailed: 0, stopped: null, capacity: 1600 }, "could not serve everything admitted", "stayed overloaded until capacity came back"],
])("tells the capacity story the evidence supports (%#)", (props, first, second) => {
  render(<CapacityAfterFailure step={20} admitted={2400} capacity={3200} failed={["app-3"]} {...props} />);
  const block = screen.getByRole("region", { name: "Capacity after the failure" });
  expect(block.textContent).toContain(first); expect(block.textContent).toContain(second);
  expect(!!within(block).queryByText("Sent to the failed App 3")).toBe(props.toFailed > 0);
});
