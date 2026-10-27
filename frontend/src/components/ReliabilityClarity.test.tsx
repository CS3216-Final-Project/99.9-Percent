import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { reliabilityOutcome } from "@/game/__fixtures__/reliabilityOutcome";
import { describeEvents, reportWindowStart } from "@/game/reportEvents";
import { reliabilityLesson } from "@/game/reliabilityLesson";
import { useGame } from "@/game/store";
import { CampaignOverlays } from "./CampaignUI";
import { CampaignIncidentReport } from "./CampaignIncidentReport";

/** Every game second the evidence table covers, expanding rows that share identical readings ("274-293"). */
const covered = (table: HTMLElement) => within(table).getAllByRole("rowheader").flatMap(th => {
  const [from, to = from] = th.textContent!.split("-").map(Number);
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
});

beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); });
afterEach(cleanup);
const titles = ["What happened?", "How did you respond?", "What to improve next"];

it("keeps outcome evidence collapsed and preserves explicit same-company acknowledgement", () => {
  const game = reliabilityOutcome(true);
  useGame.setState({ game, ready: true, started: true, onboarding: false, tour: null });
  render(<CampaignOverlays/>);
  const dialog = screen.getByRole("dialog", { name: "Reliability outcome" });
  expect(within(dialog).getAllByRole("heading", { level: 3 }).filter(n => !n.closest("details, .report-capacity")).map(n => n.textContent)).toEqual(titles);
  expect(dialog.textContent).toContain("requested a free server restore");
  const details = within(dialog).getByText("Show the evidence", { exact: true }).closest("details")!;
  expect(details.open).toBe(false);
  expect(within(dialog).getByText("Application failure").closest("details")).toBe(details);
  fireEvent.click(within(dialog).getByText("Show the evidence", { exact: true }));
  expect(within(details).getByText("Application failure")).toBeTruthy();
  expect(within(details).getByText("Company setup spending at completion")).toBeTruthy();
  expect(useGame.getState().game).toBe(game);
  fireEvent.click(within(dialog).getByRole("button", { name: "Stay in this chapter" }));
  const after = useGame.getState().game;
  expect(after.campaign!.reliabilityStage!.acknowledged).toBe(true);
  expect(after.campaign!.runId).toBe(game.campaign!.runId); expect(after.campaign!.step).toBe(game.campaign!.step);
  expect(after.campaign!.cashCents).toBe(game.campaign!.cashCents);
});

it("uses the same four sections for a Chapter 5 incident while retaining all detailed observations", () => {
  const c = reliabilityOutcome().campaign!;
  const report = c.reports.find(r => r.snapshots.some(m => m.reliability?.faultId === c.reliabilityStage!.fault!.id))!;
  render(<CampaignIncidentReport report={report} reliability={reliabilityLesson(c, report)}/>);
  expect(screen.getAllByRole("heading", { level: 3 }).filter(n => !n.closest("details, .report-capacity")).map(n => n.textContent)).toEqual(["What happened?", "How it unfolded", "What resolved it?", "What to improve next"]);
  // The server came back on its own, so the report does not ask how the player responded.
  expect(screen.getByRole("heading", { name: "What resolved it?" }).nextElementSibling!.textContent).toMatch(/returned automatically/);
  const details = screen.getByText("Show the evidence", { exact: true }).closest("details")!;
  expect(details.open).toBe(false);
  expect(screen.getByLabelText("Incident impact").closest("details")).toBeNull();
  fireEvent.click(screen.getByText("Show the evidence", { exact: true }));
    for (const text of report.explanations) expect(details.textContent).toContain(text);
  const from = reportWindowStart(report);
  const table = screen.getByRole("table", { name: /^Recorded incident evidence by game second/ });
  expect(covered(table)).toEqual(report.snapshots.filter(m => m.step >= from).map(m => m.step));
  for (const event of describeEvents(report.events).filter(e => e.step >= from && e.step <= report.recoveredStep)) expect(details.textContent).toContain(event.title);
  expect(details.querySelector("pre")).toBeNull();
  expect(screen.getByRole("region", { name: "Capacity after the failure" }).closest("details")).toBeNull();
});
