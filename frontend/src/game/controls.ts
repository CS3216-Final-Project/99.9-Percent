/*
 * How the views from the avatar answer the mouse: how fast they look round, and whether moving up looks up or down.
 * A browser setting kept across runs and modes, never part of a save. Kept free of React and the browser so the
 * rules can be tested.
 */

/** Look speed as a share of the usual, from a quarter to double, in steps of five per cent. */
export const LOOK_SPEED = { min: 0.25, max: 2, initial: 1, step: 0.05 } as const;

export interface ControlSettings {
  /** How fast mouse look, dragging, pointing and the arrow keys turn the view, as a share of the usual. */
  lookSpeed: number;
  /** Moving the mouse up looks down, as some players prefer. */
  invertY: boolean;
}

export const DEFAULT_CONTROLS: ControlSettings = { lookSpeed: LOOK_SPEED.initial, invertY: false };

/** A look speed in range, on a step, or the usual for anything that is not a number. */
export function clampLookSpeed(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return LOOK_SPEED.initial;
  const stepped = Math.round(v / LOOK_SPEED.step) * LOOK_SPEED.step;
  return Math.round(Math.min(LOOK_SPEED.max, Math.max(LOOK_SPEED.min, stepped)) * 100) / 100;
}

/** Control settings read from storage: anything missing or unreadable takes its default. */
export function controlsOf(v: unknown): ControlSettings {
  const s = v && typeof v === "object" ? (v as Partial<Record<keyof ControlSettings, unknown>>) : {};
  return { lookSpeed: clampLookSpeed(s.lookSpeed), invertY: typeof s.invertY === "boolean" ? s.invertY : DEFAULT_CONTROLS.invertY };
}
