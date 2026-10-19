import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGame } from "@/game/store";
import { Minimap } from "./Minimap";
import { avatar, placeAvatar } from "./walk";

// The database shows symptoms of an incident, so the map has somewhere to put a badge.
vi.mock("./sceneModel", async (original) => {
  const real = await original<typeof import("./sceneModel")>();
  return { ...real, buildModel: (g: Parameters<typeof real.buildModel>[0]) => ({ ...real.buildModel(g), symptomatic: ["db"] }) };
});

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  useGame.setState(useGame.getInitialState(), true);
  useGame.setState({ started: true, mapOpen: true, floor: "servers" });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const where = () => document.querySelector(".map-where")?.textContent;

describe("the map", () => {
  it("is not shown before a run is on screen", () => {
    useGame.setState({ started: false });
    render(<Minimap onFloor={() => {}} />);
    expect(screen.queryByRole("region", { name: "Map" })).toBeNull();
  });

  it("says where the avatar sits while nobody walks, and switches floors through its tabs", () => {
    const onFloor = vi.fn();
    render(<Minimap onFloor={onFloor} />);
    expect(where()).toBe("Meeting room, office floor");
    const servers = screen.getByRole("button", { name: /^Servers/ });
    expect(servers.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(servers);
    expect(onFloor).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /^Office/ }));
    expect(onFloor).toHaveBeenCalledWith("office");
  });

  it("follows the avatar in walk mode, and says only when the place changes", () => {
    useGame.setState({ walking: true, floor: "office" });
    placeAvatar("office", [18.25, 6.2]);
    render(<Minimap onFloor={() => {}} />);
    // The tabs say which floor the map shows, so the line does not.
    expect(where()).toBe("Lounge");
    const line = document.querySelector(".map-where")!;
    const before = line.firstChild;
    act(() => {
      avatar.x = 18.4;
      vi.advanceTimersByTime(400);
    });
    // Still the lounge: the line is the same text node, so a screen reader hears nothing new.
    expect(line.firstChild).toBe(before);
    act(() => {
      avatar.x = 18.25;
      avatar.z = 11.9;
      vi.advanceTimersByTime(400);
    });
    expect(where()).toBe("Games room");
    expect(document.querySelector(".map-avatar")).not.toBeNull();
    // The zone walked into glows on the plan; the one it started in never did.
    expect([...document.querySelectorAll(".map-names text.is-entered")].map((t) => t.textContent)).toEqual(["Games room"]);
  });

  it("moves with the avatar every frame, without drawing the map again", () => {
    useGame.setState({ walking: true, floor: "office" });
    placeAvatar("office", [18.25, 6.2]);
    render(<Minimap onFloor={() => {}} />);
    const dial = document.querySelector(".map-world")!;
    const before = dial.getAttribute("transform");
    const line = document.querySelector(".map-where")!.firstChild;
    act(() => {
      avatar.x = 18.6;
      vi.advanceTimersToNextFrame();
    });
    // The dial slid under the avatar on the very next frame: the map is centred on it.
    expect(dial.getAttribute("transform")).not.toBe(before);
    expect(dial.getAttribute("transform")).toContain("translate(-18.60 -6.20)");
    expect(document.querySelector(".map-where")!.firstChild).toBe(line);
  });

  it("marks the equipment that needs looking at on its own floor, and tells screen readers in words", () => {
    render(<Minimap onFloor={() => {}} />);
    expect(document.querySelectorAll(".map-mark.tone-alert")).toHaveLength(1);
    expect(screen.getByText(/Incident: .*, server floor/)).not.toBeNull();
    act(() => useGame.setState({ floor: "office" }));
    expect(document.querySelectorAll(".map-mark")).toHaveLength(0);
  });

  it("folds away to a button and opens again, remembering the choice", () => {
    render(<Minimap onFloor={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Hide map" }));
    expect(useGame.getState().mapOpen).toBe(false);
    expect(localStorage.getItem("nn.map.v1")).toBe("closed");
    expect(screen.queryByRole("region", { name: "Map" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Map" }));
    expect(useGame.getState().mapOpen).toBe(true);
    expect(screen.getByRole("region", { name: "Map" })).not.toBeNull();
  });
});
