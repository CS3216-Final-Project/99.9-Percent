import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MenuTabs, type MenuTab } from "./MenuTabs";

afterEach(cleanup);

function Harness() {
  const [tab, setTab] = useState<MenuTab>("run");
  return (
    <MenuTabs value={tab} onChange={setTab}>
      <p>Showing {tab}</p>
    </MenuTabs>
  );
}

const tab = (name: string) => screen.getByRole("tab", { name });

describe("menu tabs", () => {
  it("names the selected panel after its tab, and only the selected tab is reachable by Tab", () => {
    render(<Harness />);
    const run = tab("Run");
    expect(run.getAttribute("aria-selected")).toBe("true");
    expect(run.tabIndex).toBe(0);
    expect(tab("Sound").getAttribute("aria-selected")).toBe("false");
    expect(tab("Sound").tabIndex).toBe(-1);
    const panel = screen.getByRole("tabpanel");
    expect(panel.getAttribute("aria-labelledby")).toBe(run.id);
    expect(run.getAttribute("aria-controls")).toBe(panel.id);
    // A tab that is not selected has no panel in the page to control.
    expect(tab("Sound").getAttribute("aria-controls")).toBeNull();
    expect(screen.getByText("Showing run")).toBeTruthy();
  });

  it("switches panel on click and mounts only that panel", () => {
    render(<Harness />);
    fireEvent.click(tab("Saves"));
    expect(screen.getByText("Showing saves")).toBeTruthy();
    expect(screen.queryByText("Showing run")).toBeNull();
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(tab("Saves").id);
  });

  it("moves with the arrow keys, wrapping at both ends, and moves focus with the selection", () => {
    render(<Harness />);
    tab("Run").focus();
    fireEvent.keyDown(tab("Run"), { key: "ArrowLeft" });
    expect(tab("Playtest").getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tab("Playtest"));
    fireEvent.keyDown(tab("Playtest"), { key: "ArrowRight" });
    expect(tab("Run").getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(tab("Run"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(tab("Sound"));
    expect(screen.getByText("Showing sound")).toBeTruthy();
  });

  it("jumps to the first and last tab with Home and End", () => {
    render(<Harness />);
    fireEvent.keyDown(tab("Run"), { key: "End" });
    expect(tab("Playtest").getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(tab("Playtest"), { key: "Home" });
    expect(tab("Run").getAttribute("aria-selected")).toBe("true");
  });

  it("leaves other keys and modified arrows alone", () => {
    render(<Harness />);
    const notHandled = fireEvent.keyDown(tab("Run"), { key: "ArrowDown" });
    expect(notHandled).toBe(true);
    fireEvent.keyDown(tab("Run"), { key: "ArrowRight", altKey: true });
    fireEvent.keyDown(tab("Run"), { key: "constructor" });
    expect(tab("Run").getAttribute("aria-selected")).toBe("true");
  });
});
