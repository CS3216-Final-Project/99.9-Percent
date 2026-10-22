import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import type { Box } from "@/components/spotlight";
import { getSheetState, setSheetState, type SheetState } from "../layout/sheetState";

/** The dock along the bottom edge, whichever edition of it is showing. */
const DOCK = ".phone-dock, .bottombar";
/** The strip along the top edge, which keeps Menu and sound reachable. */
const TOP = ".phone-top, .topbar";

export interface CoachFrame {
  /** The dock's height from the bottom edge: the coach strip sits directly above it. */
  dock: number;
  /** The bottom of the top strip: nothing the coach opens may cover Menu. */
  top: number;
  /** The top edge of the coach strip itself. */
  stripTop: number;
}

const GAP = 8;

/**
 * Where the reading layer fits without covering the lesson's lit control: the larger of the gaps above and below
 * that control, between the top strip and the coach strip. Without a control, the whole space between them.
 */
export function readingPlace(box: Box | null, top: number, stripTop: number, viewportHeight: number): CSSProperties {
  const end = stripTop - GAP;
  let from = top + GAP, to = end;
  if (box && box.y < end && box.y + box.h > from) {
    const above = { from, to: Math.min(end, box.y - GAP) };
    const below = { from: box.y + box.h + GAP, to: end };
    ({ from, to } = below.to - below.from >= above.to - above.from ? below : above);
  }
  return { bottom: Math.round(viewportHeight - to), maxHeight: Math.max(0, Math.round(to - from)) };
}

const same = (a: CoachFrame, b: CoachFrame) => a.dock === b.dock && a.top === b.top && a.stripTop === b.stripTop;

/**
 * Where the coach strip and its reading layer go: measured from the real dock and top strip, so it follows whatever
 * the layout draws there (including safe-area insets) and a dock that changes height.
 */
export function useCoachFrame(strip: RefObject<HTMLElement | null>): CoachFrame {
  const [frame, setFrame] = useState<CoachFrame>({ dock: 0, top: 0, stripTop: typeof window === "undefined" ? 0 : window.innerHeight });
  useLayoutEffect(() => {
    const read = () => {
      const vh = window.innerHeight;
      const dockEl = document.querySelector(DOCK), topEl = document.querySelector(TOP);
      const dockTop = dockEl && dockEl.getClientRects().length ? dockEl.getBoundingClientRect().top : vh;
      const next = {
        dock: Math.max(0, Math.round(vh - dockTop)),
        top: Math.round(topEl && topEl.getClientRects().length ? topEl.getBoundingClientRect().bottom : 0),
        stripTop: Math.round(strip.current?.getBoundingClientRect().top ?? vh),
      };
      setFrame(f => same(f, next) ? f : next);
    };
    read();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(read);
    for (const el of [document.querySelector(DOCK), document.querySelector(TOP), strip.current]) if (el) observer?.observe(el);
    // The dock and top strip can be replaced or change height with the game's state; a slow poll catches that.
    const id = window.setInterval(read, 250);
    window.addEventListener("resize", read);
    return () => { observer?.disconnect(); window.clearInterval(id); window.removeEventListener("resize", read); };
  }, [strip]);
  return frame;
}

/**
 * Publishes the dock's measured height as `--phone-coach-bottom` on the document, so every guide's strip docks
 * directly above the dock, whatever height the dock has.
 */
export function useDockOffset() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    let last = -1;
    const read = () => {
      const dockEl = document.querySelector(DOCK);
      const vh = window.innerHeight;
      const offset = Math.max(0, Math.round(vh - (dockEl && dockEl.getClientRects().length ? dockEl.getBoundingClientRect().top : vh)));
      if (offset !== last) { last = offset; root.style.setProperty("--phone-coach-bottom", `${offset}px`); }
    };
    read();
    const dockEl = document.querySelector(DOCK);
    const observer = typeof ResizeObserver === "undefined" || !dockEl ? null : new ResizeObserver(read);
    if (dockEl) observer?.observe(dockEl);
    const id = window.setInterval(read, 250);
    window.addEventListener("resize", read);
    return () => { observer?.disconnect(); window.clearInterval(id); window.removeEventListener("resize", read); root.style.removeProperty("--phone-coach-bottom"); };
  }, []);
}

/**
 * Opens the System metrics sheet as far as the current lesson or guide needs, and gives the player back the sheet
 * they had once the guide ends. `null` leaves the sheet as it is.
 */
export function useGuideSheet(state: SheetState | null) {
  const before = useRef<SheetState | null>(null);
  useEffect(() => {
    if (state) {
      before.current ??= getSheetState();
      setSheetState(state);
    } else if (before.current !== null) {
      setSheetState(before.current);
      before.current = null;
    }
  }, [state]);
  useEffect(() => () => {
    if (before.current !== null) setSheetState(before.current);
    before.current = null;
  }, []);
}
