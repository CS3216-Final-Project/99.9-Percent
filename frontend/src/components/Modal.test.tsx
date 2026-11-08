import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Modal } from "./ui";

afterEach(cleanup);

/** `fireEvent` returns false when a handler cancelled the key's default action, such as pressing the focused button. */
const pressed = (target: Element, key: string, repeat = false) => fireEvent.keyDown(target, { key, repeat });

it("cancels the repeats of a key held down since before the dialog opened, but not a fresh press", () => {
  render(<StrictMode><Modal title="Scorecard" onClose={() => {}}><textarea aria-label="Notes"/></Modal></StrictMode>);
  const close = screen.getByRole("button", { name: "Close" }), notes = screen.getByRole("textbox", { name: "Notes" });
  expect(document.activeElement).toBe(close);
  // Enter held on the button that opened the dialog repeats on its Close, and Space likewise.
  expect(pressed(close, "Enter", true)).toBe(false);
  expect(pressed(close, " ", true)).toBe(false);
  // Not even into a text field: it was not typed there.
  expect(pressed(notes, "Enter", true)).toBe(false);
  // Other keys are left alone.
  expect(pressed(close, "ArrowDown", true)).toBe(true);
  // Released and pressed again inside, the key is the player's, and holding it repeats as anywhere else.
  fireEvent.keyUp(close, { key: "Enter" });
  expect(pressed(notes, "Enter")).toBe(true);
  expect(pressed(notes, "Enter", true)).toBe(true);
  fireEvent.keyUp(notes, { key: "Enter" });
  expect(pressed(notes, "Enter", true)).toBe(false);
});

it("treats a held key as carried over again when the dialog becomes another one", () => {
  const { rerender } = render(<Modal title="First" onClose={() => {}}><p>One</p></Modal>);
  const close = () => screen.getByRole("button", { name: "Close" });
  expect(pressed(close(), "Enter")).toBe(true);
  expect(pressed(close(), "Enter", true)).toBe(true);
  // The press opened the next dialog in the same place: its repeats are not a press of that one.
  rerender(<Modal title="Second" onClose={() => {}}><p>Two</p></Modal>);
  expect(pressed(close(), "Enter", true)).toBe(false);
});
