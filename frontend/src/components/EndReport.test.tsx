import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { newLegacyGame } from "@/sim";
import { readAnalytics } from "@/game/persist";
import { useGame } from "@/game/store";
import { sendFeedback } from "@/lib/feedback";
import { EndReport } from "./Modals";

vi.mock("@/lib/feedback", () => ({ sendFeedback: vi.fn() }));
beforeEach(() => {
  localStorage.clear();
  useGame.setState(useGame.getInitialState(), true);
  useGame.setState({ mode: "classic", started: true, game: { ...newLegacyGame("rating"), outcome: "bankrupt", phase: "ended" } });
  render(<StrictMode><EndReport /></StrictMode>);
});
afterEach(cleanup);

const pick = (n: number) => fireEvent.click(screen.getByRole("radio", { name: `${n} out of 5` }));
const reply = () => screen.getByRole("status").textContent;
const feedback = () => screen.queryByRole("textbox", { name: "Your feedback" });
const ratings = () => readAnalytics().filter((e) => e.name === "rating_submitted").map((e) => e.data?.rating);

describe("the end-of-run rating", () => {
  it("replies to the chosen rating and updates when the choice changes", () => {
    expect(reply()).toBe("1 no, 5 loved it");
    pick(5);
    expect(reply()).toBe("Thanks, glad you loved it!");
    pick(1);
    expect(reply()).toBe("Sorry it wasn't fun. Tell us why?");
    expect(screen.getByRole("radio", { name: "1 out of 5" }).getAttribute("aria-checked")).toBe("true");
    pick(3);
    expect(reply()).toBe("Thanks, noted.");
  });

  it("counts only the latest rating for the run", () => {
    pick(5);
    pick(1);
    pick(4);
    expect(ratings()).toEqual([4]);
  });

  it("asks for feedback on 1 and 2 without taking focus, and keeps the draft through 3-5", () => {
    pick(4);
    expect(feedback()).toBeNull();
    pick(2);
    const box = feedback()!;
    expect(box).not.toBe(document.activeElement);
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    fireEvent.change(box, { target: { value: "The incidents felt random" } });
    pick(4);
    expect(feedback()).toBeNull();
    pick(1);
    expect((feedback() as HTMLTextAreaElement).value).toBe("The incidents felt random");
    expect(sendFeedback).not.toHaveBeenCalled();
  });
});
