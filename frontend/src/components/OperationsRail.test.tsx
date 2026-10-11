import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, expect, it } from "vitest";
import { newLegacyGame } from "@/sim";
import { useGame } from "@/game/store";
import OperationsRail from "./OperationsRail";
import { BASICS_STEPS } from "./Tutorial";

beforeEach(() => {
  localStorage.clear();
  useGame.setState({ ...useGame.getInitialState(), game: newLegacyGame(1), mode: "classic", ready: true, started: true });
});
afterEach(cleanup);

it("keeps the operations sections present without tasks and retains the advice action", () => {
  render(<OperationsRail />);
  expect(screen.getByRole("complementary", { name: "Operations" })).toBeTruthy();
  expect(screen.getByRole("region", { name: "Next move" })).toBeTruthy();
  expect(screen.getByRole("region", { name: "Warnings" })).toBeTruthy();
  expect(screen.getByText(/No active work/)).toBeTruthy();
  const action = screen.getByRole("region", { name: "Next move" }).querySelector("button");
  expect(action).toBeTruthy();
  fireEvent.click(action!);
  expect(useGame.getState().view).toBe("tech");
});

it("opens the tutorial's advice target and freezes weekly work in an incident", () => {
  useGame.setState({ tour: { track: "basics", step: BASICS_STEPS - 1 } });
  render(<OperationsRail />);
  expect(screen.getByRole("button", { name: /Operations/ }).getAttribute("aria-expanded")).toBe("true");
  act(() => {
    useGame.getState().act({ type: "start_debt_paydown" });
    useGame.setState({ tour: null, game: { ...useGame.getState().game, phase: "incident" } });
  });
  expect(screen.queryByRole("region", { name: "Next move" })).toBeNull();
  expect(screen.getByText("Resolve the incident to resume weekly work.")).toBeTruthy();
  expect(screen.getByRole("button", { name: /Pay down technical debt:.*Open Team/ }).hasAttribute("disabled")).toBe(true);
});
