import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGame } from "@/game/store";
import { ViewOverlay } from "./ViewOverlay";
import { mouse, viewNow } from "./viewState";

const lockChanged = (locked: boolean) =>
  act(() => {
    viewNow.locked = locked;
    window.dispatchEvent(new Event("nn:look-lock"));
  });

beforeEach(() => {
  localStorage.clear();
  useGame.setState(useGame.getInitialState(), true);
  useGame.setState({ started: true, walking: true, viewpoint: "first" });
  viewNow.locked = false;
});
afterEach(() => {
  cleanup();
  mouse.take = () => {};
  viewNow.locked = false;
  viewNow.lockRefused = false;
});

describe("the overlay of the views from the avatar", () => {
  it("tells how to look round while the mouse looks, and shows no card", () => {
    render(<ViewOverlay />);
    lockChanged(true);
    expect(document.querySelector(".view-dot")).not.toBeNull();
    expect(document.querySelector(".view-hint")?.textContent).toMatch(/Move the mouse to look round/);
    expect(screen.queryByRole("group", { name: "Mouse look paused" })).toBeNull();
  });

  it("offers, once the cursor is back, to look round again or to leave first person for the overview", () => {
    const take = vi.fn();
    mouse.take = take;
    render(<ViewOverlay />);
    lockChanged(false);
    const card = screen.getByRole("group", { name: "Mouse look paused" });
    fireEvent.click(screen.getByRole("button", { name: "Look around" }));
    expect(take).toHaveBeenCalledOnce();
    expect(card).not.toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: /^Exit first person/ })[0]);
    expect(useGame.getState()).toMatchObject({ walking: false, viewpoint: "overview" });
  });

  it("shows no card where the browser will not hand over the mouse, and says to point instead", () => {
    render(<ViewOverlay />);
    act(() => {
      viewNow.locked = false;
      viewNow.lockRefused = true;
      window.dispatchEvent(new Event("nn:look-lock"));
    });
    expect(screen.queryByRole("group", { name: "Mouse look paused" })).toBeNull();
    expect(document.querySelector(".view-hint")?.textContent).toMatch(/Point towards an edge to look round/);
    expect(document.querySelector(".view-dot")).not.toBeNull();
  });

  it("shows nothing over the overview, and in follow the same mouse look without the dot", () => {
    useGame.setState({ viewpoint: "overview" });
    const { rerender } = render(<ViewOverlay />);
    expect(document.querySelector(".view-overlay")).toBeNull();
    act(() => useGame.setState({ viewpoint: "follow" }));
    rerender(<ViewOverlay />);
    lockChanged(true);
    expect(document.querySelector(".view-hint")?.textContent).toMatch(/Move the mouse to swing round/);
    expect(document.querySelector(".view-dot")).toBeNull();
    lockChanged(false);
    expect(screen.getByRole("group", { name: "Mouse look paused" })).not.toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: /^Exit follow/ })[0]);
    expect(useGame.getState()).toMatchObject({ walking: false, viewpoint: "overview" });
  });
});
