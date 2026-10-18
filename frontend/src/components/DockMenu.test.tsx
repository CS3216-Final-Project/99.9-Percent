import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DockMenu } from "./DockMenu";

afterEach(cleanup);

it("leaves Escape to a modal above the dock, then restores menu trigger focus when the menu closes", () => {
  const modalEscape = vi.fn();
  const view = render(<>
    <DockMenu label="Camera"><button type="button">Zoom in</button></DockMenu>
    <div role="dialog" aria-modal="true"><button type="button" onKeyDown={event => { if (event.key === "Escape") modalEscape(); }}>Close inspection</button></div>
  </>);
  const menu = view.container.querySelector("details")!;
  menu.open = true;
  const modal = screen.getByRole("button", { name: "Close inspection" });
  modal.focus(); fireEvent.keyDown(modal, { key: "Escape" });
  expect(modalEscape).toHaveBeenCalledOnce();
  expect(menu.open).toBe(true);
  expect(document.activeElement).toBe(modal);

  const zoom = screen.getByRole("button", { name: "Zoom in" });
  zoom.focus(); fireEvent.keyDown(zoom, { key: "Escape" });
  expect(menu.open).toBe(false);
  expect(document.activeElement).toBe(menu.querySelector("summary"));
});
