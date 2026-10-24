import { ARCADE_Z, NAP_MATTRESS, NAP_PODS } from "./floorplan";
import { followPose, type Pose } from "./views";
import { avatar } from "./walk";

/*
 * How each of the office's fun things plays out while the avatar is busy with it (see FUN_PROPS in floorplan.ts):
 * pure timelines in the activity's progress `f` (0 to 1), plus the poses the view eases to while it watches —
 * lying in the nap pod, or drawn up to the red arcade cabinet's screen. Kept free of React and three.js so the
 * choreography can be tested; the drawings that read these are in activities.tsx, Avatar.tsx and ViewRig.tsx.
 */

/** 0 to 1 with the ends eased, the same curve the elevator ride uses. */
export const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/** 0 outside [a, b] and 1 through its middle, rising over the span's first tenth and falling over its last. */
export const envelope = (f: number, a: number, b: number) => Math.min(smooth((f - a) / ((b - a) * 0.1)), smooth((b - f) / ((b - a) * 0.1)));

/**
 * One raised hold, as a sip or a bite takes: `u` in [0, 1] rises over its first share, holds, and lowers over its
 * last. `peak` scales how far it goes up.
 */
const hold = (f: number, a: number, b: number, peak = 1) => {
  const u = (f - a) / (b - a);
  if (u <= 0 || u >= 1) return 0;
  if (u < 0.3) return smooth(u / 0.3) * peak;
  if (u < 0.7) return peak;
  return smooth((1 - u) / 0.3) * peak;
};

/** How far a sip tips its mug: nothing while it rises, tipping through the hold, un-tipping as it lowers. */
const tip = (f: number, a: number, b: number) => {
  const u = (f - a) / (b - a);
  if (u <= 0.3 || u >= 1) return 0;
  if (u < 0.5) return smooth((u - 0.3) / 0.2);
  if (u < 0.7) return 1;
  return smooth((1 - u) / 0.3);
};

/** The coffee making's two sips, each lifting the mug and tipping it while held. */
const coffeeSips = (f: number) => {
  const r1 = hold(f, 0.5, 0.66);
  const r2 = hold(f, 0.72, 0.88);
  return { raise: Math.max(r1, r2), tilt: Math.max(tip(f, 0.5, 0.66), tip(f, 0.72, 0.88)) };
};

/** A coffee from the espresso machine: brew with steam, the mug into the paw, two sips, and away. */
export function coffee(f: number): { steam: number; mug: number; raise: number; tilt: number } {
  const { raise, tilt } = coffeeSips(f);
  return {
    steam: Math.min(envelope(f, 0.02, 0.37), 1),
    mug: smooth((f - 0.37) / 0.09) * (1 - smooth((f - 0.92) / 0.08)),
    raise,
    tilt,
  };
}

/** The snack bag's three bites at their starts, each a nod as it is raised to the mouth. */
const snackBites = (f: number) => {
  let raise = 0;
  let nod = 0;
  for (const a of [0.5, 0.64, 0.78]) {
    raise = Math.max(raise, hold(f, a, a + 0.1));
    const u = (f - a) / 0.1;
    if (u >= 0 && u <= 1) nod = Math.max(nod, Math.sin(Math.PI * u));
  }
  return { raise, nod };
};

/** A snack from the vending machine: the bag drops out, is picked up, opened and eaten in three bites. */
export function snack(f: number): { bag: number; raise: number; nod: number; crumple: number; crumbs: boolean } {
  const { raise, nod } = snackBites(f);
  return {
    bag: smooth((f - 0.03) / 0.04) * (1 - smooth((f - 0.93) / 0.07)),
    raise,
    nod,
    crumple: smooth((f - 0.9) / 0.08),
    // A puff of crumbs as the bag is opened, and a sprinkle with each bite.
    crumbs: (f >= 0.4 && f <= 0.52) || [0.5, 0.64, 0.78].some((a) => f >= a && f <= a + 0.045),
  };
}

/** The cooler's three gulps, the cup tipping further each time as the water level drops. */
const waterGulps = (f: number) => {
  const peaks = [0.35, 0.6, 0.85];
  let tilt = 0;
  [0.52, 0.64, 0.76].forEach((a, i) => {
    tilt = Math.max(tilt, hold(f, a, a + 0.1, peaks[i]));
  });
  return tilt;
};

/** Water from the cooler: the cup fills under the tap, then three gulps empty it before it is crushed away. */
export function water(f: number): { cup: number; level: number; tilt: number; raise: number; stream: boolean; crushed: number } {
  return {
    cup: smooth((f - 0.05) / 0.04) * (1 - smooth((f - 0.95) / 0.05)),
    level: Math.min(1, smooth((f - 0.05) / 0.35)) - 0.34 * smooth((f - 0.57) / 0.05) - 0.33 * smooth((f - 0.69) / 0.05) - 0.33 * smooth((f - 0.81) / 0.05),
    tilt: waterGulps(f),
    raise: smooth((f - 0.4) / 0.07) * (1 - smooth((f - 0.88) / 0.07)),
    stream: f >= 0.05 && f <= 0.4,
    crushed: smooth((f - 0.9) / 0.08),
  };
}

/**
 * A nap in the first pod: hop in, eyes closing then a sleep with breath, a double blink to wake, and a last
 * stretch of a sit-up. `eyes` runs 0 open to 1 shut.
 */
export function nap(f: number): { eyes: number; asleep: boolean; breathe: number; stretch: number } {
  let eyes: number;
  if (f < 0.17) eyes = 0;
  else if (f < 0.27) eyes = smooth((f - 0.17) / 0.1);
  else if (f < 0.76) eyes = 1;
  else if (f < 0.82) {
    // The waking's double blink: shut then open then shut again over 0.76–0.82…
    eyes = 1 - Math.sin(Math.PI * ((f - 0.76) / 0.06));
  } else if (f < 0.87) {
    // …then opening over 0.82–0.87 and staying open for the sit-up.
    eyes = 1 - smooth((f - 0.82) / 0.05);
  } else eyes = 0;
  const asleep = f >= 0.27 && f < 0.76;
  return {
    eyes,
    asleep,
    breathe: asleep ? (1 - Math.cos((2 * Math.PI * (f - 0.27)) / 0.14)) / 2 : 0,
    stretch: smooth((f - 0.9) / 0.05) * (1 - smooth((f - 0.97) / 0.03)),
  };
}

/** The avatar's scripted pose through an activity: a pitch back for a sip or a nod for a bite, a little rise at the nap's end. */
export function bodyPose(prop: string, f: number): { pitch: number; bob: number } {
  switch (prop) {
    case "espresso":
      return { pitch: 0.22 * coffee(f).tilt, bob: 0 };
    case "cooler":
      return { pitch: 0.22 * water(f).tilt, bob: 0 };
    case "vending":
      return { pitch: -0.15 * snack(f).nod, bob: 0 };
    case "nap":
      return { pitch: 0, bob: 0.08 * nap(f).stretch };
    default:
      return { pitch: 0, bob: 0 };
  }
}

/** An extra pitch through the avatar's eyes for a sip or a bite: up to drink, down to bite. Skipped under reduced motion by the caller. */
export function eyeNudge(prop: string, f: number): number {
  switch (prop) {
    case "espresso":
      return -0.14 * coffee(f).tilt;
    case "cooler":
      return -0.14 * water(f).tilt;
    case "vending":
      return 0.1 * snack(f).nod;
    default:
      return 0;
  }
}

/**
 * How the follow view swings to watch the held thing and the avatar's face from its side: the turn added to the
 * avatar's yaw (the camera comes round its front-right, over the open floor clear of the counters and machines it
 * faces), the camera's pitch and its distance.
 */
const WATCH: Record<string, { turn: number; pitch: number; distance: number }> = {
  espresso: { turn: -Math.PI / 2, pitch: 0.42, distance: 1.7 },
  vending: { turn: -Math.PI / 2, pitch: 0.42, distance: 1.7 },
  cooler: { turn: -Math.PI / 2, pitch: 0.42, distance: 1.7 },
};

/** Whether looking round is frozen while the avatar plays: the nap and the arcade in every view, and the held-things in follow where the view swings round (first person keeps free look with the view models). */
export const lookLocked = (prop: string, view: "first" | "follow"): boolean => prop === "nap" || prop === "arcade" || (view === "follow" && prop in WATCH);

/** The red cabinet's screen's middle (see ARCADE_SCREEN in propModels.ts), where the brick breaker is watched. */
const SCREEN = { x: 21.3, y: 1.25, z: ARCADE_Z + 0.42 };

/**
 * The pose the view eases to while the avatar is busy, or null when the view stays the player's own: through the
 * sleeper's eyes lying in the pod and looking up under the hood, or drawn up to the arcade's screen in first
 * person and over the shoulder in follow. The nap's first-person pose is shared whatever `f`; its weight is the
 * lie-down blend, which the caller reads (see napBlend in walk.ts).
 */
export function scriptedPose(prop: string, _f: number, view: "first" | "follow", floorY: number): Pose | null {
  if (prop === "nap" && view === "first") {
    const x = NAP_PODS[0][0] + 0.02;
    const y = NAP_MATTRESS + 0.26;
    const z = NAP_PODS[0][1];
    // Lying back looking up along the pod toward the feet: half the hood's edge, half the room's ceiling.
    return { x, y, z, lx: x - 0.5, ly: y + 1, lz: z, fov: 55 };
  }
  if (prop === "nap" && view === "follow") {
    // Along the first pod from its foot end: the whole sleeper centred, nothing of the next pod in the way.
    return { x: NAP_PODS[0][0] - 1.9, y: 1.9, z: NAP_PODS[0][1] + 0.45, lx: NAP_PODS[0][0] - 0.25, ly: 0.6, lz: NAP_PODS[0][1], fov: 50 };
  }
  if (prop in WATCH && view === "follow") {
    // Round the avatar's side, so its face and the thing in its paws are in frame instead of hidden behind it.
    const w = WATCH[prop];
    return followPose(avatar.x, floorY, avatar.z, avatar.yaw + w.turn, w.pitch, w.distance);
  }
  if (prop === "arcade" && view === "first") {
    // In front of the red cabinet, looking up at its tilted screen — close, but with the field clear of the HUD.
    return { x: SCREEN.x + 0.1, y: 1.3, z: SCREEN.z + 0.9, lx: SCREEN.x + 0.1, ly: SCREEN.y, lz: SCREEN.z, fov: 38 };
  }
  if (prop === "arcade" && view === "follow") {
    // Over the shoulder: the follow view drawn close and low.
    return followPose(avatar.x, floorY, avatar.z, avatar.yaw, 0.32, 1.9);
  }
  return null;
}
