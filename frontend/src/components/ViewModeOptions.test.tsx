import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, expect, it } from "vitest";
import { useGame } from "@/game/store";
import { ViewModeOptions } from "./ViewModeOptions";

afterEach(() => { cleanup(); localStorage.clear(); useGame.setState(useGame.getInitialState(), true); });

it("chooses an explicit exploration mode, closes its disclosure and returns keyboard control without advancing the company", () => {
  useGame.setState(useGame.getInitialState(), true);
  const stage = createRef<HTMLDivElement>();
  const game = useGame.getState().game;
  render(<><div tabIndex={-1} ref={stage} /><details className="dock-menu" open><summary>View mode</summary><ViewModeOptions stage={stage} /></details></>);
  const menu = document.querySelector("details")!;
  fireEvent.click(screen.getByRole("button", { name: "Walk mode" }));
  expect(useGame.getState().walking).toBe(true);
  expect(menu.open).toBe(false);
  expect(document.activeElement).toBe(stage.current);
  menu.open = true;
  expect(screen.getByRole("button", { name: "Walk mode" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Overview" }));
  expect(useGame.getState().walking).toBe(false);
  expect(menu.open).toBe(false);
  expect(useGame.getState().game).toBe(game);
  expect(useGame.getState().running).toBe(false);
});

it("offers the views from the avatar, which turn walk mode on, and the overview, which turns it off", () => {
  useGame.setState({ started: true });
  const stage = createRef<HTMLDivElement>();
  render(<><div tabIndex={-1} ref={stage} /><ViewModeOptions stage={stage} /></>);
  const pressed = () => screen.getAllByRole("button").filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.getAttribute("aria-label"));
  expect(pressed()).toEqual(["Overview"]);
  fireEvent.click(screen.getByRole("button", { name: "First person" }));
  expect(useGame.getState()).toMatchObject({ walking: true, viewpoint: "first" });
  expect(pressed()).toEqual(["First person"]);
  fireEvent.click(screen.getByRole("button", { name: "Follow" }));
  expect(useGame.getState()).toMatchObject({ walking: true, viewpoint: "follow" });
  fireEvent.click(screen.getByRole("button", { name: "Walk mode" }));
  expect(useGame.getState()).toMatchObject({ walking: true, viewpoint: "overview" });
  expect(pressed()).toEqual(["Walk mode"]);
  fireEvent.click(screen.getByRole("button", { name: "Follow" }));
  fireEvent.click(screen.getByRole("button", { name: "Overview" }));
  expect(useGame.getState()).toMatchObject({ walking: false, viewpoint: "overview" });
});
