/*
 * Where an inspection was opened from, so its card can grow out of that spot: the edges, corners and fill of the
 * room label or side panel chip that was pressed, or the point clicked on a machine in the room. Recorded on every
 * press and key, and taken once by the card that opens right after.
 */

export interface Origin { x: number; y: number; width: number; height: number; radius: string; background: string | null; at: number; within: boolean }

/** A press older than this did not open the card. */
const FRESH_MS = 1500;
let last: Origin | null = null;

function record(target: EventTarget | null, point?: { x: number; y: number }): void {
  const element = target instanceof Element ? target : null;
  const control = element?.closest("button, [role='button'], summary") ?? null;
  const box = control?.getBoundingClientRect();
  const within = !!element?.closest(".modal");
  if (control && box && box.width > 0) {
    const style = getComputedStyle(control);
    // A see-through control has no fill of its own to carry, so the card's paper is used instead.
    const background = /^(transparent|rgba\(.*,\s*0\))$/.test(style.backgroundColor) ? null : style.backgroundColor;
    last = { x: box.x, y: box.y, width: box.width, height: box.height, radius: style.borderRadius, background, at: performance.now(), within };
  } else if (point) last = { x: point.x - 8, y: point.y - 8, width: 16, height: 16, radius: "50%", background: null, at: performance.now(), within };
}

if (typeof window !== "undefined") {
  // Module-level listeners are app-lifetime singletons, like the day clock's.
  window.addEventListener("pointerdown", (e) => record(e.target, { x: e.clientX, y: e.clientY }), true);
  window.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") record(document.activeElement); }, true);
}

/** The spot the card that is opening now came from, or null when it did not come from a fresh press outside a dialog. */
export function takeOrigin(): Origin | null {
  const o = last;
  last = null;
  return o && !o.within && performance.now() - o.at < FRESH_MS ? o : null;
}
