/*
 * The time of day outside. A whole day passes in DAY_SECONDS of play, starting mid-morning: the sun rises in the
 * east, crosses the southern sky and sets in the west, the light warms toward evening, and as it gets dark the moon
 * takes over and the city's lamps and windows come on. The office keeps a light of its own the whole time, so the
 * room stays readable at three in the morning.
 *
 * Everything here is arithmetic on a time of day, kept free of three.js and the clock so it can be tested;
 * Facility.tsx reads the clock and exterior.tsx applies the result to the city.
 */

/** Seconds of play for a whole day and night. */
export const DAY_SECONDS = 720;
/** Where the cycle starts: mid-morning. 0 is midnight, 0.25 sunrise, 0.5 noon and 0.75 sunset. */
export const START = 0.37;
/** How high the sun stands at noon, in radians. */
export const NOON_ELEVATION = 1.15;
/** The office's light never comes from lower than this, so the room is never cast into long shadow. */
export const OFFICE_MIN_ELEVATION = 0.42;
/** The city's light never comes from lower than this either, so walls facing it are lit, not grazed. */
const CITY_MIN_ELEVATION = 0.14;

export type Vec3 = [number, number, number];
/** Red, green and blue from 0 to 1. Light is linear and may exceed 1; colours to display are sRGB. */
export type RGB = [number, number, number];

export interface Daylight {
  time: number;
  /** Toward the sun, below the horizon at night. */
  sun: Vec3;
  /** Toward the light the city is shaded by: the sun by day, the moon by night. */
  key: Vec3;
  /** That light's colour and strength, and the sky's and the ground's light from above and below. */
  keyLight: RGB;
  skyLight: RGB;
  groundLight: RGB;
  /** The sky at the horizon, which the city fades into, as a colour to display. */
  horizon: RGB;
  /** How dark it is: 0 in broad day, 1 in deep night. Lamps, windows and headlights follow it. */
  dark: number;
  /** The office's own lights: where its sun comes from, its colour to display, and the strength of it and of the sky. */
  office: { dir: Vec3; colour: RGB; sun: number; sky: number };
}

interface Stop {
  t: number;
  horizon: string;
  sky: RGB;
  ground: RGB;
  key: RGB;
  dark: number;
}

/** The day, stop by stop. The first and last are the same midnight, so the cycle wraps without a seam. */
const STOPS: Stop[] = [
  { t: 0, horizon: "#1a1633", sky: [0.12, 0.14, 0.25], ground: [0.06, 0.06, 0.1], key: [0.13, 0.17, 0.29], dark: 1 },
  { t: 0.2, horizon: "#2a2552", sky: [0.13, 0.15, 0.26], ground: [0.07, 0.06, 0.11], key: [0.14, 0.18, 0.3], dark: 0.96 },
  { t: 0.25, horizon: "#f0a77e", sky: [0.42, 0.38, 0.48], ground: [0.25, 0.2, 0.22], key: [0.82, 0.5, 0.32], dark: 0.45 },
  { t: 0.3, horizon: "#e9dccb", sky: [0.5, 0.54, 0.64], ground: [0.29, 0.27, 0.25], key: [0.98, 0.84, 0.66], dark: 0.08 },
  { t: 0.4, horizon: "#c6dcef", sky: [0.54, 0.61, 0.71], ground: [0.32, 0.3, 0.27], key: [1.0, 0.95, 0.86], dark: 0 },
  { t: 0.5, horizon: "#bcd7f0", sky: [0.55, 0.62, 0.73], ground: [0.32, 0.3, 0.27], key: [1.02, 0.98, 0.9], dark: 0 },
  { t: 0.62, horizon: "#c6dcef", sky: [0.54, 0.61, 0.71], ground: [0.32, 0.3, 0.27], key: [1.0, 0.94, 0.84], dark: 0 },
  { t: 0.7, horizon: "#f1c792", sky: [0.5, 0.52, 0.6], ground: [0.3, 0.27, 0.24], key: [0.98, 0.76, 0.52], dark: 0.06 },
  { t: 0.75, horizon: "#ec8a64", sky: [0.4, 0.36, 0.48], ground: [0.24, 0.18, 0.22], key: [0.85, 0.5, 0.33], dark: 0.45 },
  { t: 0.8, horizon: "#4a3a6e", sky: [0.2, 0.2, 0.34], ground: [0.1, 0.09, 0.15], key: [0.22, 0.24, 0.4], dark: 0.9 },
  { t: 1, horizon: "#1a1633", sky: [0.12, 0.14, 0.25], ground: [0.06, 0.06, 0.1], key: [0.13, 0.17, 0.29], dark: 1 },
];

/** The moon hangs in the north-west all night, where the city's light used to come from. */
const MOON: Vec3 = normalise([-0.45, 1, -0.3]);

/** The office's sun by day, as it was before the sky moved: warm, from the front right. */
const OFFICE_SUN = { day: [1, 0.945, 0.871] as RGB, night: [0.84, 0.88, 1] as RGB };

function normalise(v: Vec3): Vec3 {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const mix3 = (a: RGB, b: RGB, k: number): RGB => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Wrap any time into a day, 0 to 1. */
export const wrap = (t: number) => ((t % 1) + 1) % 1;

/** Where the sun is: rising in the east (+x), at noon in the south (+z), setting in the west, below the horizon at night. */
export function sunAt(time: number): Vec3 {
  const phase = (wrap(time) - 0.25) * 2 * Math.PI;
  const elevation = NOON_ELEVATION * Math.sin(phase);
  const across: Vec3 = normalise([Math.cos(phase), 0, 0.25 + 0.75 * Math.max(0, Math.sin(phase))]);
  return [across[0] * Math.cos(elevation), Math.sin(elevation), across[2] * Math.cos(elevation)];
}

/** A direction raised, if need be, to stand at least `min` radians above the horizon. */
function atLeast(v: Vec3, min: number): Vec3 {
  const elevation = Math.asin(Math.max(-1, Math.min(1, v[1])));
  if (elevation >= min) return v;
  const flat = Math.hypot(v[0], v[2]) || 1;
  return [(v[0] / flat) * Math.cos(min), Math.sin(min), (v[2] / flat) * Math.cos(min)];
}

/** Everything the light outside and in the office depends on, at a time of day. */
export function daylight(time: number): Daylight {
  const t = wrap(time);
  let i = 0;
  while (i < STOPS.length - 2 && STOPS[i + 1].t <= t) i++;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  const k = smooth(0, 1, (t - a.t) / (b.t - a.t));
  const sun = sunAt(t);
  // The sun takes over from the moon as it clears the horizon, and hands back as it sets.
  const day = smooth(-0.25, 0.35, sun[1]);
  const sunward = atLeast(sun, CITY_MIN_ELEVATION);
  const key = normalise(mix3(MOON, sunward, day));
  const dark = lerp(a.dark, b.dark, k);
  const officeDir = atLeast(normalise(mix3(atLeast(MOON, OFFICE_MIN_ELEVATION), atLeast(sun, OFFICE_MIN_ELEVATION), day)), OFFICE_MIN_ELEVATION);
  const keyLight = mix3(a.key, b.key, k);
  // The office's sun takes some of the sky's colour, but stays near white so the room reads the same all day.
  const tone = mix3(OFFICE_SUN.day, OFFICE_SUN.night, dark);
  const colour = mix3(tone, whitest(keyLight), 0.25 * (1 - dark));
  return {
    time: t,
    sun,
    key,
    keyLight,
    skyLight: mix3(a.sky, b.sky, k),
    groundLight: mix3(a.ground, b.ground, k),
    horizon: mix3(hex(a.horizon), hex(b.horizon), k),
    dark,
    office: { dir: officeDir, colour, sun: lerp(2.3, 1.7, dark), sky: lerp(1.0, 0.82, dark) },
  };
}

/** A light's colour with its strength taken out, so the brightest channel is 1. */
function whitest(c: RGB): RGB {
  const m = Math.max(...c) || 1;
  return [c[0] / m, c[1] / m, c[2] / m];
}

/** The time of day after `seconds` of play, unless the page address fixes one. */
export function timeOfDay(seconds: number, fixed: number | null = null): number {
  return fixed ?? wrap(START + seconds / DAY_SECONDS);
}

/** A fixed time of day from the page address (`?time=0.5` is noon), if any. */
export function timeOverride(search: string): number | null {
  const raw = new URLSearchParams(search).get("time");
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? wrap(value) : null;
}
