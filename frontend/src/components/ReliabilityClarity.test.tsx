import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { reliabilityOutcome } from "@/game/__fixtures__/reliabilityOutcome";
import { reliabilityLesson } from "@/game/reliabilityLesson";
import { useGame } from "@/game/store";
import { CampaignOverlays } from "./CampaignUI";
import { CampaignIncidentReport } from "./CampaignIncidentReport";

beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); });
afterEach(cleanup);
const titles = ["What happened?", "How did you respond?", "What could be improved?", "Key takeaway", "Capacity after the failure"];

it("keeps outcome evidence collapsed and preserves explicit same-company acknowledgement", () => {
  const game = reliabilityOutcome(true);
  useGame.setState({ game, ready: true, started: true, onboarding: false, tour: null });
  render(<CampaignOverlays/>);
  const dialog = screen.getByRole("dialog", { name: "Reliability outcome" });
  expect(within(dialog).getAllByRole("heading", { level: 3 }).filter(n => !n.closest("details")).map(n => n.textContent)).toEqual(titles);
  expect(dialog.textContent).toContain("requested a free server restore");
  const details = within(dialog).getByText("View technical details", { exact: true }).closest("details")!;
  expect(details.open).toBe(false);
  expect(within(dialog).getByText("Application failure").closest("details")).toBe(details);
  fireEvent.click(within(dialog).getByText("View technical details", { exact: true }));
  expect(within(details).getByText("Application failure")).toBeTruthy();
  expect(within(details).getByText("Company setup spending at completion")).toBeTruthy();
  expect(useGame.getState().game).toBe(game);
  fireEvent.click(within(dialog).getByRole("button", { name: "Continue operating" }));
  const after = useGame.getState().game;
  expect(after.campaign!.reliabilityStage!.acknowledged).toBe(true);
  expect(after.campaign!.runId).toBe(game.campaign!.runId); expect(after.campaign!.step).toBe(game.campaign!.step);
  expect(after.campaign!.cashCents).toBe(game.campaign!.cashCents);
});

it("uses the same four sections for a Chapter 5 incident while retaining all detailed observations", () => {
  const c = reliabilityOutcome().campaign!;
  const report = c.reports.find(r => r.snapshots.some(m => m.reliability?.faultId === c.reliabilityStage!.fault!.id))!;
  render(<CampaignIncidentReport report={report} reliability={reliabilityLesson(c, report)}/>);
  expect(screen.getAllByRole("heading", { level: 3 }).filter(n => !n.closest("details")).map(n => n.textContent)).toEqual(titles);
  const details = screen.getByText("View technical details", { exact: true }).closest("details")!;
  expect(details.open).toBe(false);
  expect(screen.getByLabelText("Recovery summary").closest("details")).toBe(details);
  fireEvent.click(screen.getByText("View technical details", { exact: true }));
  expect(screen.getByLabelText("Recovery summary")).toBeTruthy();
  for (const text of report.explanations) expect(details.textContent).toContain(text);
  expect(details.querySelectorAll(".report-events li").length).toBeGreaterThan(0);
  expect(details.querySelector("pre")).toBeNull();
});
