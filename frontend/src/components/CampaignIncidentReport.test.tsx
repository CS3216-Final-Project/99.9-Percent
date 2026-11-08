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
import { dataCompany } from "@/sim/__tests__/dataFixture";
import { IncidentTimeline } from "./IncidentTimeline";

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
it("plots the evidence window as a timeline whose selected second reads out every lane and highlights its events", () => {
  const r = recovery().campaign!.reports[0]; render(<CampaignIncidentReport report={r} />);
  fireEvent.click(screen.getByText("View Technical Details"));
  const from = reportWindowStart(r), window = r.snapshots.filter(m => m.step >= from);
  const timeline = within(screen.getByRole("region", { name: "Incident timeline" }));
  const slider = timeline.getByRole("slider", { name: "Incident timeline, game second" });
  // It opens on the worst second, the one furthest past a limit: here the slowest second that also failed requests.
  const worst = window.reduce((a, m) => (m.latencyMs > a.latencyMs || m.latencyMs === a.latencyMs && (m.serviceErrorRate ?? 0) > (a.serviceErrorRate ?? 0) ? m : a));
  expect(worst.serviceErrorRate).toBeGreaterThan(0.01);
  expect(slider.getAttribute("aria-valuenow")).toBe(String(worst.step));
  // Screen readers hear one sentence, with the servers' names capitalised as everywhere else.
  expect(slider.getAttribute("aria-valuetext")).toBe(`Game second ${worst.step}: response time ${Math.round(worst.latencyMs).toLocaleString("en-US")} ms, service errors ${(worst.serviceErrorRate! * 100).toFixed(2)}%, `
    + `App Servers ${worst.app.demand.toLocaleString("en-US")} of ${worst.app.capacity.toLocaleString("en-US")} req/s, Database ${worst.db.demand.toLocaleString("en-US")} of ${worst.db.capacity.toLocaleString("en-US")} ops/s`);
  expect(slider.getAttribute("aria-valuemin")).toBe(String(window[0].step));
  fireEvent.keyDown(slider, { key: "Home" });
  expect(slider.getAttribute("aria-valuenow")).toBe(String(window[0].step));
  fireEvent.keyDown(slider, { key: "ArrowLeft" });
  expect(slider.getAttribute("aria-valuenow")).toBe(String(window[0].step));
  // Moving to the second the incident opened highlights its marker and its line in the key.
  for (let i = window.findIndex(m => m.step === r.openedStep); i > 0; i--) fireEvent.keyDown(slider, { key: "ArrowRight" });
  expect(slider.getAttribute("aria-valuenow")).toBe(String(r.openedStep));
  const opened = timeline.getAllByRole("listitem").find(li => li.textContent!.includes("Incident opened"))!;
  expect(opened.hasAttribute("data-current")).toBe(true);
  expect(opened.querySelector(".timeline-badge")!.textContent).toBe(String(timeline.getAllByRole("listitem").indexOf(opened) + 1));
  fireEvent.keyDown(slider, { key: "End" });
  expect(slider.getAttribute("aria-valuenow")).toBe(String(window.at(-1)!.step));
  expect(opened.hasAttribute("data-current")).toBe(false);
});
it("stacks a burst of events at most three high and folds the rest at that spot into one counted marker", () => {
  const r = recovery().campaign!.reports[0], snapshots = r.snapshots.filter(m => m.step >= reportWindowStart(r)), step = r.openedStep;
  const events = Array.from({ length: 12 }, (_, i) => ({ id: i, step, title: `Decision ${i + 1}`, detail: null, kind: "decision" as const }));
  const { container } = render(<IncidentTimeline snapshots={snapshots} events={events} trace={[]} openedStep={r.openedStep} recoveredStep={r.recoveredStep} focusable />);
  const markers = [...container.querySelectorAll(".timeline-marker")];
  expect(markers.map(m => m.textContent)).toEqual(["1", "2", "+10"]);
  expect(new Set(markers.map(m => m.querySelector("circle")!.getAttribute("cy"))).size).toBe(3);
  // The track is never taller than three markers: twelve stacked would make the plot 560 px tall.
  expect(container.querySelector("svg")!.getAttribute("height")).toBe("425");
  // The key still names every event under its own number.
  const key = within(screen.getByRole("list", { name: "Recorded events" })).getAllByRole("listitem");
  expect(key.map(li => li.querySelector(".timeline-badge")!.textContent)).toEqual(events.map((_, i) => String(i + 1)));
  // Selecting their second highlights the folded marker and every event it stands for.
  const slider = screen.getByRole("slider", { name: "Incident timeline, game second" });
  fireEvent.keyDown(slider, { key: "Home" });
  for (let i = snapshots.findIndex(m => m.step === step); i > 0; i--) fireEvent.keyDown(slider, { key: "ArrowRight" });
  expect(slider.getAttribute("aria-valuenow")).toBe(String(step));
  expect(markers.every(m => m.hasAttribute("data-current"))).toBe(true);
  expect(key.every(li => li.hasAttribute("data-current"))).toBe(true);
});
it("opens a failure whose response time stays flat on a second that failed requests, not on a calm one", () => {
  const c = reliabilityOutcome(true).campaign!, f = c.reliabilityStage!.fault!;
  const r = structuredClone(c.reports.find(r => r.snapshots.some(m => m.reliability?.faultId === f.id))!), window = r.snapshots.filter(m => m.step >= reportWindowStart(r));
  window[0].serviceErrorRate = 0;
  expect(new Set(window.map(m => m.latencyMs)).size).toBe(1);
  render(<CampaignIncidentReport report={r} />); fireEvent.click(screen.getByText("View Technical Details", { exact: true }));
  const slider = screen.getByRole("slider", { name: "Incident timeline, game second" });
  const opened = window.find(m => String(m.step) === slider.getAttribute("aria-valuenow"))!;
  expect(opened.serviceErrorRate).toBe(Math.max(...window.map(m => m.serviceErrorRate ?? 0)));
  expect(opened.serviceErrorRate).toBeGreaterThan(0.01);
});
it("consolidates missing workload details and does not render an empty evidence table", () => {
  const r = structuredClone(recovery().campaign!.reports[0]); for (const s of r.snapshots) delete s.data;
  const view = render(<CampaignIncidentReport report={r} />);
  expect(screen.queryByText("Workload and cache evidence")).toBeNull();
  expect(screen.getByText(/workload and cache details were not recorded/)).toBeTruthy();
  view.rerender(<CampaignIncidentReport report={{ ...r, snapshots: [], events: [] }} />);
  expect(screen.queryByRole("table", { hidden: true })).toBeNull(); expect(screen.getByText("No historical observations were retained.")).toBeTruthy();
});
it("retains cache warmth before and after each observation and database read/write demand", () => {
  let game = decide(tick(dataCompany(), 6), { type: "deploy_cache" });
  for (let i = 0; i < 100 && game.phase !== "review"; i++) game = tick(game);
  const report = game.campaign!.reports.at(-1)!;
  render(<CampaignIncidentReport report={report} />);
  fireEvent.click(screen.getByText("View Technical Details"));
  const table = screen.getByRole("table", { name: "Workload and cache readings, shown when they change" });
  expect(within(table).getByRole("columnheader", { name: "Warmth used / after" })).toBeTruthy();
  expect(within(table).getByRole("columnheader", { name: "Database read / write demand ops/s" })).toBeTruthy();
  const warming = report.snapshots.find(m => m.data && m.data.warmthUsed === 0 && m.data.warmthAfterStep > 0)!;
  const row = within(table).getByRole("rowheader", { name: String(warming.step) }).closest("tr")!;
  expect(within(row).getByRole("cell", { name: "0% / 12%" })).toBeTruthy();
  expect(within(row).getByRole("cell", { name: `${warming.data!.databaseReadDemand.toLocaleString("en-US")} / ${warming.data!.databaseWriteDemand.toLocaleString("en-US")}` })).toBeTruthy();
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
  expect(within(block).getByText("Sent to the failed Server 3").nextSibling?.textContent).toBe("800 req/s, all failed");
  expect(block.textContent).toContain(`every request the load balancer sent to Server 3 failed until it was restored at game second ${f.restoredStep}.`);
  expect(block.textContent).toContain("The healthy servers could serve their own 1,600 req/s; the errors came from the failed server staying in the route.");
  expect(block.textContent).not.toContain("enough capacity");
  // A failed server does no work, so the evidence table never credits it with capacity.
  fireEvent.click(screen.getByText("View Technical Details", { exact: true }));
  const evidence = screen.getByRole("table", { name: "Recorded incident evidence by game second" });
  expect(evidence.textContent).toContain("Server 3: 800 / 0 · 0 (failed)");
  expect(evidence.textContent).not.toMatch(/Server 3: [\d,]+ \/ 1,600 · [\d,]+ \(failed/);
});

it("shows a Stay Online incident as its per-server table and event list, and an earlier chapter's as the timeline, whichever chapter reads it", () => {
  // The timeline sums capacity over healthy servers while the route still feeds the failed one; the table's
  // per-server rows and Routing column show why the errors came.
  const game = reliabilityOutcome(true), c = game.campaign!, f = c.reliabilityStage!.fault!;
  const stay = c.reports.find(r => r.snapshots.some(m => m.reliability?.faultId === f.id))!, opening = c.reports[0];
  expect(opening.openedStep).toBeLessThan(c.reliabilityStage!.enteredStep);
  useGame.setState({ game });
  const view = render(<CampaignIncidentReport report={stay} />);
  fireEvent.click(screen.getByText("View Technical Details", { exact: true }));
  expect(screen.queryByRole("slider")).toBeNull();
  const region = screen.getByRole("region", { name: "Recorded incident evidence" });
  expect(region.closest(".visually-hidden")).toBeNull();
  const table = within(region).getByRole("table", { name: "Recorded incident evidence by game second" });
  expect(table.textContent).toContain("Server 3: 800 / 0 · 0 (failed)");
  expect(within(table).getByRole("columnheader", { name: "Routing" })).toBeTruthy();
  const events = describeEvents(stay.events).filter(e => e.step >= reportWindowStart(stay) && e.step <= stay.recoveredStep);
  expect(screen.getByRole("heading", { name: "What happened, second by second" })).toBeTruthy();
  expect(screen.getByRole("list", { name: "Recorded events" }).querySelectorAll("li")).toHaveLength(events.length);
  view.unmount();
  // The company's Opening incident, read from History in Stay Online, keeps its timeline.
  render(<CampaignIncidentReport report={opening} />);
  fireEvent.click(screen.getByText("View Technical Details", { exact: true }));
  expect(screen.getByRole("slider", { name: "Incident timeline, game second" })).toBeTruthy();
  expect(screen.getByRole("table", { name: "Recorded incident evidence by game second" }).closest(".visually-hidden")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "What happened, second by second" })).toBeNull();
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
  expect(!!within(block).queryByText("Sent to the failed Server 3")).toBe(props.toFailed > 0);
});
