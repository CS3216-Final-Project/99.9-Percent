/*
 * How the room is seen: from high above (overview), from a few metres behind the avatar (follow), or through its
 * eyes (first person). Follow and first person look from the avatar, so they need walk mode on; the overview works
 * either way. Kept free of React, three.js and the browser so the rules can be tested; scene/views.ts says where
 * each view puts the camera.
 */

export type Viewpoint = "overview" | "follow" | "first";

/** In the order the V key goes through them. */
export const VIEWPOINTS: readonly Viewpoint[] = ["overview", "follow", "first"];

export const VIEWPOINT_NAME: Record<Viewpoint, string> = { overview: "Overview", follow: "Follow", first: "First person" };

export const isViewpoint = (v: unknown): v is Viewpoint => VIEWPOINTS.includes(v as Viewpoint);

/** The view the V key goes to next. */
export function nextViewpoint(v: Viewpoint): Viewpoint {
  return VIEWPOINTS[(VIEWPOINTS.indexOf(v) + 1) % VIEWPOINTS.length];
}

/** Whether a view looks from the avatar, and so needs walk mode on. */
export const fromAvatar = (v: Viewpoint) => v !== "overview";

/** What changed the view, for the analytics. */
export type ViewSwitch = "menu" | "key" | "walk_ended";

/** The first-person field of view, in degrees, that the player can choose between, and where it starts. */
export const FOV = { min: 70, max: 90, initial: 75 } as const;

/** A field of view in range and whole, or the default for anything that is not a number. */
export function clampFov(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return FOV.initial;
  return Math.round(Math.min(FOV.max, Math.max(FOV.min, v)));
}
