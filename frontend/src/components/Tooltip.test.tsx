import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { useGame } from "../game/store";
import { TooltipLayer } from "./Tooltip";
import { tipProps } from "./tips";

vi.mock("./scene/Facility", () => ({ default: () => <div data-testid="facility" /> }));

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  useGame.setState(useGame.getInitialState(), true);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const settle = (ms = 300) => act(() => void vi.advanceTimersByTime(ms));
const tooltip = () => screen.queryByRole("tooltip");
const over = (el: Element, pointerType = "mouse") => fireEvent.pointerOver(el, { pointerType });
const out = (el: Element, relatedTarget: Element | null = null, pointerType = "mouse") => fireEvent.pointerOut(el, { pointerType, relatedTarget });

function Harness({ text = "Opens the thing (Q)", withOpen = true }: { text?: string; withOpen?: boolean }) {
  return (
    <StrictMode>
      {withOpen && (
        <button type="button" {...tipProps(text)}>
          Open
        </button>
      )}
      <button type="button" disabled {...tipProps("Locked until you have more cash")}>
        Locked
      </button>
      <span className="tip" tabIndex={0} data-tip="A plain-language term">
        Term
      </span>
      <TooltipLayer />
    </StrictMode>
  );
}

describe("tooltip layer", () => {
  it("opens after a short hover, closes on leaving, and shows a shortcut as a key", () => {
    render(<Harness />);
    const open = screen.getByRole("button", { name: "Open" });

    over(open);
    expect(tooltip()).toBeNull();
    settle();
    expect(tooltip()?.textContent).toContain("Opens the thing");
    expect(tooltip()?.querySelector("kbd")?.textContent).toBe("Q");
    expect(open.getAttribute("aria-describedby")).toBe(tooltip()?.id);

    out(open);
    expect(tooltip()).toBeNull();
    expect(open.hasAttribute("aria-describedby")).toBe(false);
  });

  it("does not open when the pointer passes through without resting, or from touch", () => {
    render(<Harness />);
    const open = screen.getByRole("button", { name: "Open" });

    over(open);
    settle(100);
    out(open);
    settle();
    expect(tooltip()).toBeNull();

    over(open, "touch");
    settle();
    expect(tooltip()).toBeNull();
  });

  it("explains a disabled control, which is where the reason for being locked lives", () => {
    render(<Harness />);
    over(screen.getByRole("button", { name: "Locked" }));
    settle();
    expect(tooltip()?.textContent).toBe("Locked until you have more cash");
  });

  it("opens on keyboard focus and closes on blur, but not when a mouse click focuses a button", () => {
    render(<Harness />);
    const term = screen.getByText("Term");
    act(() => term.focus());
    expect(tooltip()?.textContent).toBe("A plain-language term");
    act(() => term.blur());
    expect(tooltip()).toBeNull();

    // jsdom has no :focus-visible; a button focused by a pointer press must stay quiet.
    const open = screen.getByRole("button", { name: "Open" });
    vi.spyOn(open, "matches").mockReturnValue(false);
    act(() => open.focus());
    expect(tooltip()).toBeNull();
    vi.spyOn(open, "matches").mockReturnValue(true);
    act(() => open.blur());
    act(() => open.focus());
    expect(tooltip()).not.toBeNull();
  });

  it("closes on Escape before anything behind it sees the key", () => {
    const behind = vi.fn();
    window.addEventListener("keydown", behind);
    render(<Harness />);
    act(() => screen.getByText("Term").focus());
    expect(tooltip()).not.toBeNull();

    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(tooltip()).toBeNull();
    expect(behind).not.toHaveBeenCalled();

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(behind).toHaveBeenCalledTimes(1);
    window.removeEventListener("keydown", behind);
  });

  it("closes when the control is pressed, scrolled away from or removed", () => {
    const view = render(<Harness />);
    const open = screen.getByRole("button", { name: "Open" });

    over(open);
    settle();
    fireEvent.pointerDown(open);
    expect(tooltip()).toBeNull();

    over(open);
    settle();
    expect(tooltip()).not.toBeNull();
    fireEvent.scroll(document);
    expect(tooltip()).toBeNull();

    over(open);
    settle();
    expect(tooltip()).not.toBeNull();
    view.rerender(<Harness withOpen={false} />);
    settle(50);
    expect(tooltip()).toBeNull();
  });

  it("follows a changing explanation while it is open", () => {
    const view = render(<Harness text="Cash: $100" />);
    const open = screen.getByRole("button", { name: "Open" });
    over(open);
    settle();
    expect(tooltip()?.textContent).toContain("Cash: $100");

    view.rerender(<Harness text="Cash: $250" />);
    settle(50);
    expect(tooltip()?.textContent).toContain("Cash: $250");
  });

  it("registers one set of listeners under StrictMode and removes them on unmount", () => {
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const view = render(<Harness />);
    const added = add.mock.calls.filter(([type]) => type === "pointerover").length;
    view.unmount();
    expect(remove.mock.calls.filter(([type]) => type === "pointerover")).toHaveLength(added);
    add.mockRestore();
    remove.mockRestore();
  });
});

describe("game interface", () => {
  it("uses no native title tooltips on the title screen, in play or in an incident", () => {
    render(<App />);
    expect(document.querySelectorAll("[title]")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Try Prototype" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip introduction" }));
    expect(document.querySelectorAll("[title]")).toHaveLength(0);
    for (let i = 0; i < 6; i++) fireEvent.click(screen.getByRole("button", { name: "Advance step" }));
    expect(screen.getByText(/Stable steps: 0\/5/)).toBeTruthy();
    expect(document.querySelectorAll("[title]")).toHaveLength(0);
  });

  it("explains a header metric and a locked time control in the shared bubble", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Try Prototype" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip introduction" }));

    over(screen.getByText("Cash"));
    settle();
    expect(tooltip()?.textContent).toMatch(/Available cash: \$20,000/);
    out(screen.getByText("Cash"));

    for (let i = 0; i < 6; i++) fireEvent.click(screen.getByRole("button", { name: "Advance step" }));
    const advance = screen.getByRole("button", { name: "Incident" });
    expect(advance.hasAttribute("disabled")).toBe(true);
    over(advance);
    settle();
    expect(tooltip()?.textContent).toMatch(/Advance one physical step/);
  });
});
