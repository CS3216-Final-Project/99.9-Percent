import { useEffect, useState, type CSSProperties } from "react";

/** Positioning shared by the guides: a lit box around what a step points at, and a card placed beside it. */
export type Place = "top" | "bottom" | "left" | "right";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Where the card sits relative to what it points at. */
export function placeFor(selector: string): Place {
  if (selector.startsWith(".eq-label") || selector.startsWith(".node")) return "right";
  if (selector.startsWith(".view-tabs") || selector.startsWith(".advance") || selector.startsWith(".campaign-clock") || selector.startsWith(".room-controls")) return "top";
  if (selector.startsWith(".next-chip") || selector.startsWith(".topbar") || selector.startsWith(".stat-")) return "bottom";
  return "left";
}

/**
 * `edge` is where the open room ends on the right: a panel there is left uncovered when the target is in the room.
 * `width` is the card's width on wide screens.
 */
export function cardStyle(box: Box | null, place: Place, vw: number, vh: number, edge = vw, height = 240, width = 280): CSSProperties {
  const W = Math.min(width, vw - 24);
  if (!box) return { left: (vw - W) / 2, top: "50%", transform: "translateY(-50%)", width: W };
  // On small screens the card docks to the edge with more room beside the target, and never grows into it.
  if (vw < 900) {
    const gap = 10, above = box.y - gap - 12, below = vh - (box.y + box.h) - gap - 12;
    return below >= above ? { left: 12, right: 12, bottom: 12, maxHeight: Math.max(120, below) } : { left: 12, right: 12, top: 12, maxHeight: Math.max(120, above) };
  }
  const gap = 14;
  const x = (v: number) => clamp(v, 12, vw - W - 12);
  const y = (v: number) => clamp(v, 12, Math.max(12, vh - height - 12));
  // Never cover the thing being pointed at: flip sides when there is no room.
  if (place === "left" && box.x - gap - W < 12) place = "right";
  else if (place === "right" && box.x + box.w + gap + W > edge - 12 && box.x - gap - W >= 12) place = "left";
  else if (place === "bottom" && box.y + box.h + gap + height > vh - 12 && box.y - gap - height >= 12) place = "top";
  else if (place === "top" && box.y - gap - height < 12 && box.y + box.h + gap + height <= vh - 12) place = "bottom";
  switch (place) {
    case "bottom":
      return { left: x(box.x), top: y(box.y + box.h + gap), width: W };
    case "top":
      return {
        left: x(box.x + box.w / 2 < vw / 2 ? box.x : box.x + box.w - W),
        top: y(box.y - gap - height),
        width: W,
      };
    case "left":
      return { left: Math.max(12, box.x - gap - W), top: y(box.y - 10), width: W };
    case "right":
      return { left: x(box.x + box.w + gap), top: y(box.y), width: W };
  }
}

const sameBox = (a: Box | null, b: Box | null) =>
  a === b || (!!a && !!b && Math.round(a.x) === Math.round(b.x) && Math.round(a.y) === Math.round(b.y) && Math.round(a.w) === Math.round(b.w) && Math.round(a.h) === Math.round(b.h));

/**
 * The on-screen box of the element `selector` names, padded, kept current as the layout, room and panels move.
 * `covered` reports a real modal dialog over the game, which the guide steps aside for.
 */
export function useTargetBox(selector: string | null, pad = 6): { box: Box | null; covered: boolean; viewport: { w: number; h: number } } {
  const [box, setBox] = useState<Box | null>(null);
  const [covered, setCovered] = useState(false);
  const [viewport, setViewport] = useState(() => ({ w: typeof window === "undefined" ? 1280 : window.innerWidth, h: typeof window === "undefined" ? 800 : window.innerHeight }));
  useEffect(() => {
    const read = () => {
      setViewport(v => (v.w === window.innerWidth && v.h === window.innerHeight ? v : { w: window.innerWidth, h: window.innerHeight }));
      setCovered(!!document.querySelector(".modal-backdrop"));
      const el = selector ? document.querySelector<HTMLElement>(selector) : null;
      // Something without a box of its own (hidden, or laid out with display: contents) cannot be pointed at.
      if (!el || el.getClientRects().length === 0) { setBox(b => (b === null ? b : null)); return; }
      // An open dock menu hangs outside its trigger's box; it is part of what the step points at.
      let { left, top, right, bottom } = el.getBoundingClientRect();
      el.querySelectorAll<HTMLElement>(".dock-panel").forEach(child => {
        if (child.getClientRects().length === 0) return;
        const r = child.getBoundingClientRect();
        left = Math.min(left, r.left); top = Math.min(top, r.top); right = Math.max(right, r.right); bottom = Math.max(bottom, r.bottom);
      });
      const x = Math.max(4, left - pad), y = Math.max(4, top - pad);
      const next = { x, y, w: Math.min(window.innerWidth - 4, right + pad) - x, h: Math.min(window.innerHeight - 4, bottom + pad) - y };
      setBox(b => (sameBox(b, next) ? b : next));
    };
    read();
    const id = window.setInterval(read, 120);
    window.addEventListener("resize", read);
    return () => { window.clearInterval(id); window.removeEventListener("resize", read); };
  }, [selector, pad]);
  return { box, covered, viewport };
}
