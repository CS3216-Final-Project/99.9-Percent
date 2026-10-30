/*
 * The clock the room's own life runs on: the crew, the visitors and their elevator errands, the city's cars and
 * walkers, the machines and the traffic. It is the page's clock with every second the company stood paused taken
 * out, so while the player pauses the room holds still, and it carries on from the same moment when they run again.
 * What the player drives stays on the page's clock (ride.ts): the camera, the avatar and its rides, and the previews
 * and spotlights that answer the pointer, so the room can still be explored and inspected while paused.
 */

/** Seconds the world has stood still, and since when it has, while the clock is paused. */
let stoppedSeconds = 0;
let stoppedAt: number | null = null;

/** Seconds on the world's clock. */
export function worldNow(): number {
  return ((stoppedAt ?? performance.now()) / 1000) - stoppedSeconds;
}

/** A frame's seconds on the world's clock: none while it is held. */
export const worldDelta = (dt: number): number => (stoppedAt === null ? dt : 0);

/** Holds the world where it is, and lets it run on from there. */
export function holdWorld(hold: boolean): void {
  if (hold && stoppedAt === null) stoppedAt = performance.now();
  else if (!hold && stoppedAt !== null) {
    stoppedSeconds += (performance.now() - stoppedAt) / 1000;
    stoppedAt = null;
  }
}
