import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadControls, loadGraphics } from "@/game/persist";
import { useGame } from "@/game/store";
import { ControlSettings } from "./ControlSettings";

beforeEach(() => {
  localStorage.clear();
  useGame.setState(useGame.getInitialState(), true);
  useGame.getState().boot();
});
afterEach(() => cleanup());

describe("the Controls section", () => {
  it("sets the look speed with a slider, in range, and remembers it", () => {
    render(<ControlSettings />);
    const slider = screen.getByRole("slider", { name: "Look speed" });
    expect(slider).toHaveProperty("value", "1");
    expect([slider.getAttribute("min"), slider.getAttribute("max")]).toEqual(["0.25", "2"]);
    fireEvent.change(slider, { target: { value: "0.55" } });
    expect(useGame.getState().controls.lookSpeed).toBe(0.55);
    expect(slider.getAttribute("aria-valuetext")).toBe("55 per cent");
    expect(loadControls()).toEqual({ lookSpeed: 0.55, invertY: false });
  });

  it("turns looking up and down round, and back, and remembers it", () => {
    render(<ControlSettings />);
    const invert = screen.getByRole("button", { name: "Invert up and down" });
    expect(invert.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(invert);
    expect(invert.getAttribute("aria-pressed")).toBe("true");
    expect(loadControls().invertY).toBe(true);
    fireEvent.click(invert);
    expect(useGame.getState().controls.invertY).toBe(false);
  });

  it("sets the first-person field of view, in range, without changing the graphics quality", () => {
    render(<ControlSettings />);
    const slider = screen.getByRole("slider", { name: "First-person field of view" });
    expect(slider).toHaveProperty("value", "75");
    expect([slider.getAttribute("min"), slider.getAttribute("max")]).toEqual(["70", "90"]);
    fireEvent.change(slider, { target: { value: "86" } });
    expect(useGame.getState().graphics).toEqual({ quality: "auto", fov: 86 });
    expect(slider.getAttribute("aria-valuetext")).toBe("86 degrees");
    expect(loadGraphics()).toEqual({ quality: "auto", fov: 86 });
  });

  it("starts at what was saved, and reads anything unreadable as the defaults", () => {
    localStorage.setItem("nn.controls.v1", JSON.stringify({ lookSpeed: 0.4, invertY: true }));
    useGame.setState(useGame.getInitialState(), true);
    useGame.getState().boot();
    expect(useGame.getState().controls).toEqual({ lookSpeed: 0.4, invertY: true });
    localStorage.setItem("nn.controls.v1", "{not json");
    useGame.setState(useGame.getInitialState(), true);
    useGame.getState().boot();
    expect(useGame.getState().controls).toEqual({ lookSpeed: 1, invertY: false });
  });
});
