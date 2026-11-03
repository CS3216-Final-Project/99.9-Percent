import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { newGame } from "@/sim";
import { captureScorecard } from "@/sim/campaignScorecard";
import { act, tick } from "@/sim/__tests__/spikeFixtures";
import { reliabilityOutcome } from "@/game/__fixtures__/reliabilityOutcome";
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
  expect(disclosures[0].querySelector("summary")!.textContent).toBe("View Technical Details");
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

it("completes the campaign from Stay Online's outcome and resets the single accordion on the scorecard", () => {
  const game = reliabilityOutcome();
  useGame.setState({ game, ready: true, started: true, onboarding: false }); render(<CampaignOverlays/>);
  const outcome = screen.getByRole("dialog", { name: "Reliability outcome" });
  fireEvent.click(within(outcome).getByText("View Technical Details"));
  expect(useGame.getState().game.outcome).toBeNull();
  fireEvent.click(within(outcome).getByRole("button", { name: "Complete campaign" }));
  expect(useGame.getState().game.outcome).toBe("won");
  fireEvent.click(within(screen.getByRole("dialog", { name: "Campaign finale" })).getByRole("button", { name: "Skip to the scorecard" }));
  checkReport();
  expect(screen.getByRole("region", { name: "Run scorecard" }).textContent).toContain("Campaign complete");
});

it("does not invent a recovery on a no-incident record, and retains all scorecard evidence", () => {
  const card = captureScorecard(newGame(), "won");
  render(<CampaignScorecard card={card}/>);
  const details = checkReport();
  expect(screen.getByText("No incidents appear in the retained record.").closest("details")).toBeNull();
  for (const label of ["Settled revenue", "Rejected demand", "Whole-run uptime", "Final architecture"]) expect(details.textContent).toContain(label);
  expect(details.textContent).toContain(card.runId);
});
