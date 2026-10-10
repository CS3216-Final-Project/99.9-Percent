/**
 * Shared vocabulary for the tooltip layer. Any element that carries `data-tip` explains itself in
 * `TooltipLayer`, so no control needs the browser's own `title` bubble.
 */

export type TipSide = "above" | "below";

/** Attribute that makes an element show a tooltip. */
export const TIP_ATTR = "data-tip";
/** Optional preferred side. The layer still flips when there is no room. */
export const TIP_SIDE_ATTR = "data-tip-side";

/**
 * Spread onto any element that should explain itself. `aria-description` keeps the explanation available to
 * assistive technology, which the native `title` attribute used to provide.
 */
export function tipProps(text: string | undefined, side?: TipSide) {
  if (!text) return {};
  return { [TIP_ATTR]: text, [TIP_SIDE_ATTR]: side, "aria-description": text } as const;
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Placement {
  left: number;
  top: number;
  side: TipSide;
  /** Distance of the arrow from the tooltip's left edge, so it points at the trigger's centre. */
  arrow: number;
}

/** Space kept between the trigger and the tooltip, and between the tooltip and the window edge. */
export const TIP_GAP = 10;
export const TIP_MARGIN = 8;
const ARROW_INSET = 14;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Where a tooltip of `tip` size goes for a trigger at `anchor`: centred on the trigger on its preferred side,
 * on the other side when that one does not fit, and kept inside the window either way.
 */
export function placeTip(anchor: Box, tip: { width: number; height: number }, view: { width: number; height: number }, prefer: TipSide = "below"): Placement {
  const room = { below: view.height - (anchor.top + anchor.height) - TIP_GAP - TIP_MARGIN, above: anchor.top - TIP_GAP - TIP_MARGIN };
  const other: TipSide = prefer === "below" ? "above" : "below";
  let side = prefer;
  if (room[prefer] < tip.height) side = room[other] >= tip.height || room[other] > room[prefer] ? other : prefer;

  const top = side === "below" ? anchor.top + anchor.height + TIP_GAP : anchor.top - TIP_GAP - tip.height;
  const centre = anchor.left + anchor.width / 2;
  const left = Math.max(TIP_MARGIN, Math.min(centre - tip.width / 2, view.width - TIP_MARGIN - tip.width));
  return { left, top, side, arrow: clamp(centre - left, ARROW_INSET, Math.max(ARROW_INSET, tip.width - ARROW_INSET)) };
}

/** "Rotate left (Q)" becomes the words plus a key, so shortcuts read as keys. */
export function splitShortcut(text: string): { label: string; key?: string } {
  const m = /^(.*\S)\s+\(([A-Z])\)$/.exec(text);
  return m ? { label: m[1], key: m[2] } : { label: text };
}
