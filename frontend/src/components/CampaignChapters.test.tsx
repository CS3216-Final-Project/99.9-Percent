import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { useGame } from "@/game/store";
import { newGame } from "@/sim";
import { dataCompany } from "@/sim/__tests__/dataFixture";
import { preparedReliability } from "@/sim/__tests__/reliabilityFixture";
import { spikeCompany } from "@/sim/__tests__/spikeFixtures";
import { CampaignChapters } from "./CampaignChapters";

beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); });
afterEach(cleanup);

it.each([
  ["Opening", 1, () => newGame()],
  ["Scaling & Routing", 2, () => dataCompany("read-heavy", false)],
  ["Data Strategy", 3, () => dataCompany()],
  ["Traffic Spikes & Autoscaling", 4, () => spikeCompany(false)],
  ["Stay Online", 5, () => preparedReliability()],
] as const)("shows %s prominently at chapter %i", (name, number, company) => {
  useGame.setState({ game: company(), started: true, ready: true });
  render(<CampaignChapters />);
  const bar = screen.getByRole("region", { name: "Guided Mode chapters" });
  expect(within(bar).getByLabelText("Current chapter").textContent).toBe(name);
  expect(bar.textContent).toContain(`Chapter ${number} of 6`);
  expect(within(bar).queryByRole("list", { name: "Chapter progress" })).toBeNull();
  expect(within(bar).getByLabelText("Current objective").textContent).not.toBe("");
  expect(within(bar).getAllByRole("button", { name: "View chapters" })).toHaveLength(1);
});

it("keeps Next absent before eligibility, then advances through the existing paused action", () => {
  useGame.setState({ game: newGame(), started: true, ready: true });
  const view = render(<CampaignChapters />);
  expect(screen.queryByRole("button", { name: /^Next:/ })).toBeNull();
  view.unmount();
  const game = dataCompany("read-heavy", false);
  useGame.setState({ game, running: true });
  render(<CampaignChapters />);
  fireEvent.click(screen.getByRole("button", { name: "Next: Continue to data strategy" }));
  expect(useGame.getState().game.campaign!.dataStage).toBeTruthy();
  expect(useGame.getState().game.campaign!.runId).toBe(game.campaign!.runId);
  expect(useGame.getState().running).toBe(false);
});

it("explains a disabled Next without changing its engine gate", () => {
  const game = spikeCompany(false);
  game.campaign!.spikeStage!.acknowledged = true;
  useGame.setState({ game, started: true, ready: true });
  render(<CampaignChapters />);
  const next = screen.getByRole("button", { name: "Next: Continue to reliability" });
  expect(next.hasAttribute("disabled")).toBe(true);
  const reason = document.getElementById(next.getAttribute("aria-describedby")!)!;
  expect(reason.textContent).toContain("stable baseline management and empty queues");
  expect(reason.tabIndex).toBe(0);
  fireEvent.click(next);
  expect(useGame.getState().game).toBe(game);
});

it("opens all six chapters without advancing the company and stays paused on close", () => {
  const game = newGame();
  useGame.setState({ game, started: true, ready: true, running: true });
  render(<CampaignChapters />);
  fireEvent.click(screen.getByRole("button", { name: "View chapters" }));
  expect(useGame.getState().running).toBe(false);
  expect(useGame.getState().game).toBe(game);
  const dialog = screen.getByRole("dialog", { name: "Guided Mode chapters" });
  expect(within(dialog).getAllByRole("listitem")).toHaveLength(6);
  expect(dialog.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
  expect(within(dialog).getByRole("heading", { name: "Stay Online" }).closest("li")!.textContent).toContain("Locked");
  fireEvent.click(within(dialog).getByRole("button", { name: "Back to company" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(useGame.getState().running).toBe(false);
});
