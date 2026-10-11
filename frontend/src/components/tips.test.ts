import { describe, expect, it } from "vitest";
import { TIP_GAP, TIP_MARGIN, placeTip, splitShortcut, tipProps } from "./tips";

const view = { width: 1000, height: 700 };
const tip = { width: 200, height: 60 };
const button = (left: number, top: number) => ({ left, top, width: 40, height: 20 });

describe("placeTip", () => {
  it("centres the tooltip under its trigger and points the arrow at it", () => {
    const p = placeTip(button(480, 100), tip, view);
    expect(p.side).toBe("below");
    expect(p.top).toBe(100 + 20 + TIP_GAP);
    expect(p.left).toBe(500 - tip.width / 2);
    expect(p.arrow).toBe(tip.width / 2);
  });

  it("opens above when there is no room below, and below when asked for above but there is no room", () => {
    expect(placeTip(button(480, 660), tip, view).side).toBe("above");
    expect(placeTip(button(480, 660), tip, view).top).toBe(660 - TIP_GAP - tip.height);
    expect(placeTip(button(480, 10), tip, view, "above").side).toBe("below");
    expect(placeTip(button(480, 400), tip, view, "above").side).toBe("above");
  });

  it("uses the roomier side when neither fits, and the preferred side on a tie", () => {
    const short = { width: 1000, height: 100 };
    const tall = { width: 200, height: 200 };
    expect(placeTip(button(480, 60), tall, short).side).toBe("above");
    expect(placeTip(button(480, 40), tall, short, "below").side).toBe("below");
    expect(placeTip(button(480, 40), tall, short, "above").side).toBe("above");
  });

  it("keeps the tooltip inside the window at both edges, with the arrow still on the trigger", () => {
    const right = placeTip(button(970, 100), tip, view);
    expect(right.left).toBe(view.width - TIP_MARGIN - tip.width);
    expect(right.left + right.arrow).toBeGreaterThan(970);
    expect(right.left + right.arrow).toBeLessThan(1010);

    const left = placeTip(button(0, 100), tip, view);
    expect(left.left).toBe(TIP_MARGIN);
    expect(left.arrow).toBeGreaterThanOrEqual(14);
  });

  it("never lets the arrow leave the bubble when the trigger is far outside it", () => {
    const p = placeTip(button(5000, 100), tip, view);
    expect(p.arrow).toBeLessThanOrEqual(tip.width - 14);
  });
});

describe("splitShortcut", () => {
  it("turns a trailing single-letter shortcut into a key", () => {
    expect(splitShortcut("Rotate left (Q)")).toEqual({ label: "Rotate left", key: "Q" });
    expect(splitShortcut("Pause or resume the clock (P)")).toEqual({ label: "Pause or resume the clock", key: "P" });
  });

  it("leaves other parentheses as text", () => {
    expect(splitShortcut("Cancel (50% refund)")).toEqual({ label: "Cancel (50% refund)" });
    expect(splitShortcut("(Q)")).toEqual({ label: "(Q)" });
  });
});

describe("tipProps", () => {
  it("marks the element and keeps the text available to assistive technology", () => {
    expect(tipProps("Menu")).toEqual({ "data-tip": "Menu", "data-tip-side": undefined, "aria-description": "Menu" });
    expect(tipProps("Menu", "above")["data-tip-side"]).toBe("above");
  });

  it("adds nothing when there is no text", () => {
    expect(tipProps(undefined)).toEqual({});
    expect(tipProps("")).toEqual({});
  });
});
