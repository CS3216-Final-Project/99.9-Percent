import { daylight, timeOfDay, timeOverride, type Daylight } from "./sky";

/*
 * The one clock the time of day runs on, shared by the city's light (Facility.tsx) and its sound (game/ambience.ts),
 * so what is seen and what is heard always agree. It starts when the page loads, so a new canvas after a change of
 * graphics carries on where it was, and the page address can fix it (`?time=0.5` is noon).
 */

const START = performance.now();
const fixed = timeOverride(window.location.search);

/** The light and the sky outside, now. */
export function daylightNow(): Daylight {
  return daylight(timeOfDay((performance.now() - START) / 1000, fixed));
}
