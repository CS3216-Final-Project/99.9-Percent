import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadAudio } from "@/game/persist";
import { useGame } from "@/game/store";
import { SoundButton } from "./SoundButton";
import { SoundSettings } from "./SoundSettings";

beforeEach(() => {
  localStorage.clear();
  useGame.setState(useGame.getInitialState(), true);
  useGame.getState().boot();
});
afterEach(cleanup);

describe("the Sound section", () => {
  it("labels both sliders, shows their percentages and starts at the saved levels", () => {
    useGame.getState().setAudio({ music: 35 });
    render(<SoundSettings />);
    const section = screen.getByRole("region", { name: "Sound" });
    const music = within(section).getByRole("slider", { name: "Music" });
    const effects = within(section).getByRole("slider", { name: "Sound effects" });
    expect(music).toHaveProperty("value", "35");
    expect(music.getAttribute("aria-valuetext")).toBe("35%");
    expect(effects.getAttribute("aria-valuetext")).toBe("80%");
    expect(section.textContent).toContain("35%");
    // Native range inputs: reachable and operable from the keyboard.
    effects.focus();
    expect(document.activeElement).toBe(effects);
    expect(effects.getAttribute("type")).toBe("range");
    expect(effects.getAttribute("step")).toBe("5");
  });

  it("applies and saves a volume as the slider moves", () => {
    render(<SoundSettings />);
    const effects = screen.getByRole("slider", { name: "Sound effects" });
    fireEvent.change(effects, { target: { value: "40" } });
    expect(useGame.getState().audio.effects).toBe(40);
    expect(effects.getAttribute("aria-valuetext")).toBe("40%");
    expect(screen.getByRole("region", { name: "Sound" }).textContent).toContain("40%");
    fireEvent.change(screen.getByRole("slider", { name: "Music" }), { target: { value: "0" } });
    expect(loadAudio()).toEqual({ music: 0, effects: 40, muted: false });
  });

  it("mutes everything with the same setting as the header button, and a slider unmutes", () => {
    render(
      <>
        <SoundButton />
        <SoundSettings />
      </>,
    );
    const header = screen.getByRole("button", { name: "Mute sound" });
    const muteAll = screen.getByRole("button", { name: "Mute all" });
    expect(muteAll.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(muteAll);
    expect(useGame.getState().audio.muted).toBe(true);
    expect(header.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(/Moving a slider turns sound back on/)).toBeTruthy();
    // The volumes survive the mute.
    expect(useGame.getState().audio).toMatchObject({ music: 80, effects: 80 });
    fireEvent.change(screen.getByRole("slider", { name: "Music" }), { target: { value: "60" } });
    expect(useGame.getState().audio).toEqual({ music: 60, effects: 80, muted: false });
    expect(muteAll.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(header);
    expect(muteAll.getAttribute("aria-pressed")).toBe("true");
  });
});
