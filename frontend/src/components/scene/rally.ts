/*
 * The table-tennis rally in the games corner: where the ball is at any moment.
 * Each crossing starts at one player's paddle, clears the net, bounces once on
 * the far half and rises to the other player's paddle. Kept free of React and
 * three.js so the path can be checked without drawing it.
 */

/** The table in metres, centred on its own origin with its length along x. */
export const TABLE = { length: 2.74, width: 1.52, top: 0.79, netTop: 0.945 };

/** Where the table stands and how the rally is played. */
export const RALLY = {
  x: 18.2,
  z: 12.6,
  /** Crossings each second, halved: one there-and-back takes 2 / speed seconds. */
  speed: 0.9,
  /** How far from the table's centre the ball is struck, just past the end line. */
  reach: 1.5,
  /** How far from the centre the ball lands on the receiver's half. */
  bounce: 0.75,
  /** Height at which the ball is struck. */
  hit: 1.0,
};

export const BALL_RADIUS = 0.035;

/** Seconds for the ball to go there and back. */
export const RALLY_PERIOD = 2 / RALLY.speed;

/** How high the ball arcs above a straight line on its way over the net, and on its way up from the bounce. */
const ARC_OVER = 0.3;
const ARC_UP = 0.15;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * The ball's position in the room at time t seconds. The -x player strikes it
 * at t = 0 and every period after; the +x player half a period later.
 */
export function ballAt(t: number): [number, number, number] {
  const half = RALLY_PERIOD / 2;
  const phase = ((t % RALLY_PERIOD) + RALLY_PERIOD) % RALLY_PERIOD;
  const outward = phase < half;
  // How far along this crossing the ball is, and where along the table that puts it, measured towards the receiver.
  const u = (outward ? phase : phase - half) / half;
  const along = lerp(-RALLY.reach, RALLY.reach, u);
  const landing = (RALLY.bounce + RALLY.reach) / (2 * RALLY.reach);
  const floor = TABLE.top + BALL_RADIUS;
  let y: number;
  if (u < landing) {
    const s = u / landing;
    y = lerp(RALLY.hit, floor, s) + ARC_OVER * 4 * s * (1 - s);
  } else {
    const s = (u - landing) / (1 - landing);
    y = lerp(floor, RALLY.hit, s) + ARC_UP * 4 * s * (1 - s);
  }
  return [RALLY.x + (outward ? along : -along), y, RALLY.z + Math.sin(t * 1.3) * 0.2];
}
