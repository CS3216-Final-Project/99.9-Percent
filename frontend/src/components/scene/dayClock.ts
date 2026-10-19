import { loadTimeOfDay, saveTimeOfDay } from "@/game/persist";
import { daylight, START, timeOfDay, timeOverride, type Daylight } from "./sky";

/*
 * The one clock the time of day runs on, shared by the city's light (Facility.tsx) and its sound (game/ambience.ts),
 * so what is seen and what is heard always agree. It carries on from where the last visit left off, so a new canvas
 * after a change of graphics keeps the same clock, and the page address can fix it (`?time=0.5` is noon).
 */

const LOADED = performance.now();
const fixed = timeOverride(window.location.search);
const begin = loadTimeOfDay() ?? START;

export function timeNow(): number {
  return timeOfDay((performance.now() - LOADED) / 1000, fixed, begin);
}

/** The light and the sky outside, now. */
export function daylightNow(): Daylight {
  return daylight(timeNow());
}

function persistTimeOfDay(): void {
  saveTimeOfDay(timeNow());
}

if (fixed === null) {
  // Module-level listeners and timer are app-lifetime singletons.
  window.addEventListener("pagehide", persistTimeOfDay);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") persistTimeOfDay();
  });
  window.setInterval(persistTimeOfDay, 10_000);
}
