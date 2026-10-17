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
