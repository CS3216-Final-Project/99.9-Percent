import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { useGame } from "@/game/store";
import { launchCompany, recoveredOpeningCompany } from "@/sim/__tests__/scalingLaunchFixture";
import { campaignAttention } from "@/game/campaignAttention";
import { LaunchOpportunity } from "./LaunchOpportunity";

beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); });
afterEach(cleanup);
function show() {
  useGame.setState({ game: launchCompany(), ready: true, started: true, onboarding: false, tour: null, running: false });
  render(<LaunchOpportunity/>);
}

it("keeps reviewing and declining read-only, then commits one explicit launch", () => {
  show(); const before = useGame.getState().game;
  expect(campaignAttention(before)).toMatchObject({ reason: "scaling-launch", target: "launch" });
  expect(screen.getByRole("region", { name: "Growth launch opportunity" }).textContent).toContain("$7,200");
  fireEvent.click(screen.getByRole("button", { name: "Review launch" }));
  expect(screen.getByRole("dialog").textContent).toContain("1,000 req/s");
  fireEvent.click(screen.getByRole("button", { name: "Keep preparing" }));
  expect(useGame.getState().game).toBe(before);
  fireEvent.click(screen.getByRole("button", { name: "Review launch" }));
  fireEvent.click(screen.getByRole("button", { name: "Launch campaign" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  const countdown = screen.getByRole("progressbar", { name: "Launch countdown" });
  expect(countdown.getAttribute("aria-valuetext")).toContain("3 game seconds. Paused.");
  expect(document.activeElement).toBe(countdown);
  act(() => useGame.getState().setRunning(true));
  expect(countdown.getAttribute("aria-valuetext")).toContain("Running.");
  expect(countdown.textContent).toContain("3s to launch");
  act(() => useGame.getState().setRunning(false));
  expect(countdown.textContent).toContain("Paused · 3s left");
  expect(useGame.getState().game.campaign!.inputs.filter(i => i.action.type === "launch_scaling")).toHaveLength(1);
  act(() => useGame.getState().stepSeconds(2));
  expect(useGame.getState().game.campaign!.incomingRate).toBe(800);
  act(() => useGame.getState().stepSeconds(1));
  expect(useGame.getState().game.campaign!.incomingRate).toBe(1400);
});

it.each([false, true])("versions a new Scaling entry after Opening (stay first: %s)", stay => {
  useGame.setState({ game: recoveredOpeningCompany(), ready: true, started: true, onboarding: false, tour: null, running: false });
  expect(useGame.getState().act({ type: "acknowledge_milestone", enterScaling: !stay })).toBe(true);
  if (stay) {
    expect(useGame.getState().game.campaign!.scaling).toBeNull();
    expect(useGame.getState().act({ type: "enter_scaling" })).toBe(true);
  }
  expect(useGame.getState().game.campaign!.scaling).toMatchObject({ version: 2, dueStep: null });
});
