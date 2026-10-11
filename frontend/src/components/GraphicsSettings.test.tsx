import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadGraphics } from "@/game/persist";
import { useGame } from "@/game/store";
import { GraphicsSettings } from "./GraphicsSettings";

beforeEach(() => {
  localStorage.clear();
  useGame.setState(useGame.getInitialState(), true);
  useGame.getState().boot();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the Graphics section", () => {
  it("offers Auto, High, Medium and Low as one group, Auto chosen at first, each explained", () => {
    render(<GraphicsSettings />);
    const group = within(screen.getByRole("region", { name: "Graphics" })).getByRole("radiogroup", { name: "Graphics quality" });
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("value"))).toEqual(["auto", "high", "medium", "low"]);
    expect(within(group).getByRole("radio", { name: "Auto" })).toHaveProperty("checked", true);
    expect(radios.filter((r) => (r as HTMLInputElement).checked)).toHaveLength(1);
    // The name is the quality alone; what it does is the description.
    const low = within(group).getByRole("radio", { name: "Low" });
    expect(document.getElementById(low.getAttribute("aria-describedby")!)?.textContent).toMatch(/no shadows/i);
  });

  it("applies a choice at once and remembers it for next time", () => {
    render(<GraphicsSettings />);
    fireEvent.click(screen.getByRole("radio", { name: "Medium" }));
    expect(useGame.getState().graphics.quality).toBe("medium");
    expect(screen.getByRole("radio", { name: "Medium" })).toHaveProperty("checked", true);
    expect(screen.getByRole("radio", { name: "Auto" })).toHaveProperty("checked", false);
    expect(loadGraphics()).toEqual({ quality: "medium" });
  });

  it("starts at the saved choice", () => {
    localStorage.setItem("nn.graphics.v1", JSON.stringify({ quality: "low" }));
    useGame.setState(useGame.getInitialState(), true);
    useGame.getState().boot();
    render(<GraphicsSettings />);
    expect(screen.getByRole("radio", { name: "Low" })).toHaveProperty("checked", true);
  });

  it("still applies a choice when the browser will not save it", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw Error("blocked");
    });
    render(<GraphicsSettings />);
    fireEvent.click(screen.getByRole("radio", { name: "High" }));
    expect(screen.getByRole("radio", { name: "High" })).toHaveProperty("checked", true);
    expect(useGame.getState().graphics.quality).toBe("high");
  });
});
