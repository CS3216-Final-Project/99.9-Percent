import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { newGame } from "@/sim";
import { captureScorecard } from "@/sim/campaignScorecard";
import { act, tick } from "@/sim/__tests__/spikeFixtures";
import { combinedCompany, finishRound, finishedCompany } from "@/sim/__tests__/combinedFixture";
import { useGame } from "@/game/store";
import { CampaignOverlays } from "./CampaignUI";
import CampaignScorecard from "./CampaignScorecard";

const titles = ["What happened?", "How did you respond?", "What could be improved?", "Key takeaway"];
beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); });
afterEach(cleanup);
function checkReport() {
  expect(screen.getAllByRole("heading", { level: 3 }).filter(n => !n.closest("details")).map(n => n.textContent)).toEqual(titles);
  const disclosures = document.querySelectorAll("details");
  expect(disclosures).toHaveLength(1);
  expect(disclosures[0].open).toBe(false);
  expect(disclosures[0].querySelector("summary")!.textContent).toBe("View technical details");
  return disclosures[0];
}

it("keeps prevention evidence in one accordion and acknowledges the same company", () => {
  let game = tick(act(act(newGame(), { type: "set_traffic_limit", enabled: true }), { type: "start_db_upgrade" }), 4);
  game = act(act(game, { type: "incident_inspect", equipment: "app" }), { type: "incident_inspect", equipment: "db" });
  game = tick(act(game, { type: "set_traffic_limit", enabled: false }), 5);
  useGame.setState({ game, ready: true, started: true, onboarding: false }); render(<CampaignOverlays/>);
  const details = checkReport();
  expect(within(details).getByText("Setup spending")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Continue company" }));
  expect(useGame.getState().game.campaign!.openingPrevention!.outcome!.acknowledged).toBe(true);
  expect(useGame.getState().game.campaign!.runId).toBe(game.campaign!.runId);
  expect(useGame.getState().game.campaign!.step).toBe(game.campaign!.step);
});

it("preserves growth review evidence and explicit acknowledgement", () => {
  const game = finishRound(act(tick(combinedCompany(), 5), { type: "start_growth_wave" }));
  useGame.setState({ game, ready: true, started: true, onboarding: false }); render(<CampaignOverlays/>);
  const details = checkReport();
  expect(details.textContent).toContain("Recorded growth round");expect(details.querySelector("pre")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Continue company" }));
  expect(useGame.getState().game.campaign!.combinedStage!.completedRounds.at(-1)!.acknowledged).toBe(true);
  expect(useGame.getState().game.campaign!.cashCents).toBe(game.campaign!.cashCents);
});

it("keeps final review explicit and resets the single accordion on completion", { timeout: 30_000 }, () => {
  const game = finishedCompany();
  useGame.setState({ game, ready: true, started: true, onboarding: false }); render(<CampaignOverlays/>);
  const details = checkReport();
  fireEvent.click(within(details).getByText("View technical details"));
  expect(details.textContent).toContain("50,000");
  expect(useGame.getState().game.outcome).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Complete campaign" }));
  expect(useGame.getState().game.outcome).toBe("won");
  fireEvent.click(within(screen.getByRole("dialog", { name: "Campaign finale" })).getByRole("button", { name: "Skip to the scorecard" }));
  checkReport();
});

it("does not invent a recovery on a no-incident record, and retains all scorecard evidence", () => {
  const card = captureScorecard(newGame(), "won");
  render(<CampaignScorecard card={card}/>);
  const details = checkReport();
  expect(screen.getByText("No incidents appear in the retained record.").closest("details")).toBeNull();
  for (const label of ["Settled revenue", "Rejected demand", "Whole-run uptime", "Final architecture"]) expect(details.textContent).toContain(label);
  expect(details.textContent).toContain(card.runId);
});
