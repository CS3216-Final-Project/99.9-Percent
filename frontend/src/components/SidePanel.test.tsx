import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { DEFAULT_META, saveMeta, saveMode } from "@/game/persist";
import { useGame } from "@/game/store";
import SidePanel from "./SidePanel";

beforeEach(() => {
  // jsdom lays nothing out, so it has no scrolling; the panel scrolls back to the top on each selection.
  Element.prototype.scrollTo = () => {};
  localStorage.clear();
  saveMeta({ ...DEFAULT_META, challengeUnlocked: true, tutorialDone: true });
  saveMode("classic");
  useGame.setState(useGame.getInitialState(), true);
  useGame.getState().boot();
  useGame.getState().play();
  useGame.setState({ onboarding: false, tour: null });
});
afterEach(cleanup);

it("hides a machine's details while the view is on another floor", () => {
  render(<SidePanel />);
  act(() => useGame.getState().select("app"));
  expect(useGame.getState().floor).toBe("servers");
  expect(screen.getByRole("complementary", { name: "Details" })).toBeTruthy();

  act(() => useGame.getState().goToFloor("office", "menu"));
  expect(screen.queryByRole("complementary", { name: "Details" })).toBeNull();

  act(() => useGame.getState().select("team"));
  expect(useGame.getState().floor).toBe("office");
  expect(screen.getByRole("complementary", { name: "Details" })).toBeTruthy();
  act(() => useGame.getState().goToFloor("servers", "elevator"));
  expect(screen.queryByRole("complementary", { name: "Details" })).toBeNull();
});

it("keeps a selection made during an incident off the other floor once the incident ends", () => {
  render(<SidePanel />);
  act(() => useGame.getState().select("app"));
  const game = useGame.getState().game;
  act(() => useGame.setState({ game: { ...game, phase: "incident" } }));
  act(() => useGame.getState().goToFloor("office", "menu"));
  act(() => useGame.setState({ game: { ...useGame.getState().game, phase: "management" } }));
  expect(useGame.getState().selected).toBe("app");
  expect(screen.queryByRole("complementary", { name: "Details" })).toBeNull();
});
