import { StrictMode } from "react";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGame } from "@/game/store";
import { ToastHost } from "./Game";
import { Modal } from "./ui";

const Screen = ({ dialog }: { dialog: boolean }) => <StrictMode>
  <ToastHost />
  {dialog && <Modal title="Menu"><button>Resume</button></Modal>}
</StrictMode>;
beforeEach(() => { vi.useFakeTimers(); useGame.setState(useGame.getInitialState(), true); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

it("puts a toast inside the open dialog, where a screen reader in that dialog hears it, without taking focus", async () => {
  render(<Screen dialog />);
  const dialog = screen.getByRole("dialog", { name: "Menu" }), resume = within(dialog).getByRole("button", { name: "Resume" });
  expect(document.activeElement).toBe(resume);
  await act(async () => useGame.getState().notify("Could not save.", "error"));
  expect(within(dialog).getByRole("alert").textContent).toContain("Could not save.");
  expect(screen.getAllByRole("alert")).toHaveLength(1);
  expect(document.activeElement).toBe(resume);
  // A dialog that does not reach down to it (jsdom lays nothing out) keeps the floating toast and its timer.
  act(() => { vi.advanceTimersByTime(5199); });
  expect(useGame.getState().toast).not.toBeNull();
  act(() => { vi.advanceTimersByTime(1); });
  expect(useGame.getState().toast).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("floats a toast on over the game when its dialog closes, and outside any dialog", async () => {
  const { rerender } = render(<Screen dialog />);
  await act(async () => useGame.getState().notify("Saved", "success"));
  expect(within(screen.getByRole("dialog")).getByRole("status").textContent).toContain("Saved");
  rerender(<Screen dialog={false} />);
  await act(async () => {});
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("status").textContent).toContain("Saved");
  act(() => { vi.advanceTimersByTime(2800); });
  expect(screen.queryByRole("status")).toBeNull();
});
