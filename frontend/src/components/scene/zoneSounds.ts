import type { ZoneCue } from "@/game/sfx";
import { ARCADE_Z, ARCADES, FOOSBALL, SPOTS } from "./floorplan";

/*
 * The sounds of the office's zones: foosball clacks, arcade bleeps, the espresso machine and a sleeper breathing.
 * Each plays now and then, quietly, and only while the camera looks close by: zoomed in near the foosball table the
 * player hears the game, and from across the office nothing. Kept free of React and audio so the levels can be tested.
 */

/** Where the camera looks and how far in it is zoomed, in pixels a metre; the scene keeps this up to date. */
export interface Focus {
  x: number;
  z: number;
  zoom: number;
}

/**
 * What the camera looks at right now, written by the scene each frame and read by the sounds. `live` is false
 * while the office floor is not on screen, and `hush` is true during an incident, when the office has other things to say.
 */
export const viewFocus: Focus & { live: boolean; hush: boolean } = { x: 0, z: 0, zoom: 30, live: false, hush: false };

/** A zone's sound: what plays, where it comes from, and how many seconds pass between plays. */
export interface ZoneSound {
  cue: ZoneCue;
  x: number;
  z: number;
  every: [number, number];
}

export const ZONE_SOUNDS: ZoneSound[] = [
  { cue: "foosball", x: FOOSBALL.x, z: FOOSBALL.z, every: [0.6, 1.5] },
  { cue: "arcade", x: (ARCADES[0][1] + ARCADES[1][1]) / 2, z: ARCADE_Z, every: [2.5, 5] },
  { cue: "espresso", x: 17.31, z: -8.91, every: [10, 18] },
  { cue: "snore", x: SPOTS.napper.x, z: SPOTS.napper.z, every: [4, 6] },
];

/** Metres from where the camera looks: full volume within the first, silence beyond the second. */
export const ZONE_REACH: [number, number] = [3, 11];
/** Zoom, in pixels a metre: silence below the first, full volume above the second. The game opens at 30. */
export const ZONE_ZOOM: [number, number] = [24, 45];
/** The loudest a zone sound gets, as a share of the effects volume. */
export const ZONE_PEAK = 0.45;

const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/** How loud a zone's sound plays, 0 to ZONE_PEAK, from where the camera looks. */
export function zoneLevel(sound: ZoneSound, focus: Focus): number {
  const near = 1 - smooth((Math.hypot(sound.x - focus.x, sound.z - focus.z) - ZONE_REACH[0]) / (ZONE_REACH[1] - ZONE_REACH[0]));
  const close = smooth((focus.zoom - ZONE_ZOOM[0]) / (ZONE_ZOOM[1] - ZONE_ZOOM[0]));
  return ZONE_PEAK * near * close;
}

/** Seconds until a zone's sound plays again, for a random number `r` from 0 to 1. */
export function nextGap(sound: ZoneSound, r: number): number {
  return sound.every[0] + r * (sound.every[1] - sound.every[0]);
}
