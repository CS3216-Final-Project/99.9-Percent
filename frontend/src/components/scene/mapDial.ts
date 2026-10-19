import { headingDir } from "./views";

/*
 * The map as a round dial, the way a game's minimap works: centred on the avatar (or on what the overview looks at)
 * and turned so the way the view faces is up, so left and right on the dial are left and right on screen. Plain
 * arithmetic on numbers, kept free of React so it can be tested.
 *
 * Positions on the dial are in metres from its middle, x to the right and y down, as SVG draws them.
 */

/** Metres from the middle of the dial to its rim. */
export const DIAL_RADIUS = 13;

/** Degrees the floor plan turns, as SVG's rotate takes them (clockwise on screen), for the view's heading. */
export const dialTurn = (heading: number) => (heading * 180) / Math.PI;

/** Where a spot on the floor shows on the dial, for a dial centred on (cx, cz) and facing `heading`. */
export function toDial(x: number, z: number, cx: number, cz: number, heading: number): [number, number] {
  const dx = x - cx;
  const dz = z - cz;
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  return [dx * c - dz * s, dx * s + dz * c];
}

/** A spot on the dial, or, beyond `r` from the middle, the point on that circle in its direction. */
export function onRim([x, y]: [number, number], r: number): { at: [number, number]; off: boolean } {
  const d = Math.hypot(x, y);
  return d <= r ? { at: [x, y], off: false } : { at: [(x / d) * r, (y / d) * r], off: true };
}

/** Where the compass's N stands on a circle of radius `r`: towards the back wall, -z on the floor. */
export const northOnDial = (heading: number, r: number): [number, number] => [Math.sin(heading) * r, -Math.cos(heading) * r];

/** The wedge of floor first person sees: from the avatar, `length` metres out, `half` radians either side of where it looks. */
export function viewWedge(x: number, z: number, heading: number, half: number, length: number): [number, number][] {
  const [lx, lz] = headingDir(heading - half);
  const [rx, rz] = headingDir(heading + half);
  return [
    [x, z],
    [x + lx * length, z + lz * length],
    [x + rx * length, z + rz * length],
  ];
}

/** Half the horizontal angle a camera of vertical field of view `fovDegrees` sees, on a screen `aspect` wide. */
export const halfWidthAngle = (fovDegrees: number, aspect: number) => Math.atan(Math.tan((fovDegrees * Math.PI) / 360) * aspect);
