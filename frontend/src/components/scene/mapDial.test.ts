import { describe, expect, it } from "vitest";
import { DIAL_RADIUS, dialTurn, halfWidthAngle, northOnDial, onRim, toDial, viewWedge } from "./mapDial";
import { headingDir } from "./views";

const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

/** Rotate a point on the floor as SVG's rotate(degrees) would, to check the dial agrees with the drawing. */
function svgRotate([x, y]: [number, number], degrees: number): [number, number] {
  const r = (degrees * Math.PI) / 180;
  return [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)];
}

describe("the map's dial", () => {
  it("puts what the view faces straight up, whichever way it faces", () => {
    for (const heading of [0, 0.6, Math.PI / 2, 2.5, -1.2, Math.PI]) {
      const [fx, fz] = headingDir(heading);
      const [x, y] = toDial(4 * fx, 4 * fz, 0, 0, heading);
      near(x, 0);
      near(y, -4);
      // The same turn the SVG plan is drawn with.
      const [sx, sy] = svgRotate([4 * fx, 4 * fz], dialTurn(heading));
      near(sx, x);
      near(sy, y);
    }
  });

  it("measures from its middle, and keeps distances", () => {
    const [x, y] = toDial(15, -3, 12, 1, 0.9);
    near(Math.hypot(x, y), Math.hypot(3, -4));
    expect(toDial(5, 5, 5, 5, 1.3)).toEqual([0, 0]);
  });

  it("brings what lies beyond the rim to the rim, in its direction", () => {
    expect(onRim([3, 4], 10)).toEqual({ at: [3, 4], off: false });
    const far = onRim([30, 40], 10);
    expect(far.off).toBe(true);
    near(far.at[0], 6);
    near(far.at[1], 8);
  });

  it("puts the compass's N towards the back wall, at the top when the view faces it", () => {
    const [x, y] = northOnDial(0, DIAL_RADIUS);
    near(x, 0);
    near(y, -DIAL_RADIUS);
    // Turned a quarter, facing -x, the back wall is to the right.
    const [rx, ry] = northOnDial(Math.PI / 2, 10);
    near(rx, 10);
    near(ry, 0);
  });

  it("draws first person's wedge out from the avatar, either side of where it looks", () => {
    const [from, left, right] = viewWedge(2, 3, 0, Math.PI / 4, 5);
    expect(from).toEqual([2, 3]);
    // Looking along -z: one edge to the left (-x), the other to the right, both ahead.
    expect(left[1]).toBeLessThan(3);
    expect(right[1]).toBeLessThan(3);
    expect(Math.sign(left[0] - 2)).toBe(-Math.sign(right[0] - 2));
    near(Math.hypot(left[0] - 2, left[1] - 3), 5);
    near(halfWidthAngle(90, 1), Math.PI / 4);
    expect(halfWidthAngle(75, 16 / 9)).toBeGreaterThan(halfWidthAngle(75, 1));
  });
});
