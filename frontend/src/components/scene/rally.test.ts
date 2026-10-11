import { describe, expect, it } from 'vitest';
import { BALL_RADIUS, ballAt, RALLY, RALLY_PERIOD, TABLE } from './rally';

const STEP = 0.001;
const samples = (from: number, to: number) => Array.from({ length: Math.round((to - from) / STEP) }, (_, i) => from + i * STEP);

describe('table-tennis rally', () => {
  it('clears the net on every crossing', () => {
    for (const t of samples(0, 2 * RALLY_PERIOD)) {
      const [x, y] = ballAt(t);
      if (Math.abs(x - RALLY.x) < 0.02) expect(y - BALL_RADIUS).toBeGreaterThan(TABLE.netTop);
    }
  });

  it('bounces once per crossing, on the half of the player about to hit it', () => {
    const floor = TABLE.top + BALL_RADIUS;
    const half = RALLY_PERIOD / 2;
    for (const [from, side] of [
      [0, 1],
      [half, -1],
    ] as const) {
      const ts = samples(from, from + half);
      const touches = ts.filter((t) => ballAt(t)[1] < floor + 0.002);
      expect(touches.length).toBeGreaterThan(0);
      // All the touching samples are one bounce: close together, on the receiver's half and on the table.
      expect(touches[touches.length - 1] - touches[0]).toBeLessThan(0.05);
      const dx = ballAt(touches[0])[0] - RALLY.x;
      expect(Math.sign(dx)).toBe(side);
      expect(Math.abs(dx)).toBeLessThan(TABLE.length / 2);
    }
  });

  it('never sinks into the table', () => {
    for (const t of samples(0, RALLY_PERIOD)) {
      const [x, y] = ballAt(t);
      if (Math.abs(x - RALLY.x) <= TABLE.length / 2) expect(y).toBeGreaterThanOrEqual(TABLE.top + BALL_RADIUS - 1e-9);
    }
  });

  it('is struck beyond each end line, where the players stand, when their swings land', () => {
    expect(ballAt(0)[0]).toBeCloseTo(RALLY.x - RALLY.reach);
    expect(ballAt(RALLY_PERIOD / 2)[0]).toBeCloseTo(RALLY.x + RALLY.reach);
    expect(RALLY.reach).toBeGreaterThan(TABLE.length / 2);
  });

  it('keeps the same rally for times before the clock starts', () => {
    const [x1, y1] = ballAt(-0.3);
    const [x2, y2] = ballAt(RALLY_PERIOD - 0.3);
    expect(x1).toBeCloseTo(x2);
    expect(y1).toBeCloseTo(y2);
  });
});
