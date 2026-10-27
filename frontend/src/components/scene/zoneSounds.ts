import type { ZoneCue } from "@/game/sfx";
import { GROUPS } from "./conversations";
import { ARCADE_Z, ARCADES, FOOSBALL, OPEN_PODS, SPOTS } from "./floorplan";
import { RALLY } from "./rally";

/*
 * The sounds of the office's zones: foosball clacks, a table-tennis rally, arcade bleeps, the espresso machine,
 * kitchen clinks, the television, typing at the open desks, a phone call, a presentation, chat groups murmuring
 * and a sleeper breathing. Each plays now and then, quietly, near where the camera looks - or, while the player
 * walks the office, near where the avatar stands, however far out the camera is zoomed. Kept free of React and
 * audio so the levels can be tested.
 */

/**
 * Where the sounds are heard from: where the camera looks and how far in it is zoomed, in pixels a metre.
 * With `walking`, x and z are instead the avatar's own position and the zoom must not quieten the sounds.
 */
export interface Focus {
  x: number;
  z: number;
  zoom: number;
  walking?: boolean;
}

/**
 * What the sounds are heard from right now, written by the scene each frame and read by the sounds. `live` is false
 * while the office floor is not on screen, `walking` is true in walk mode on the office floor, and `hush` is true
 * during an incident, when the office has other things to say.
 */
export const viewFocus: Focus & { live: boolean; hush: boolean; walking: boolean } = { x: 0, z: 0, zoom: 30, live: false, hush: false, walking: false };

/** A zone's sound: what plays, where it comes from, and how many seconds pass between plays. */
export interface ZoneSound {
  cue: ZoneCue;
  x: number;
  z: number;
  every: [number, number];
}

export const ZONE_SOUNDS: ZoneSound[] = [
  { cue: "foosball", x: FOOSBALL.x, z: FOOSBALL.z, every: [0.6, 1.5] },
  { cue: "pingPong", x: RALLY.x, z: RALLY.z, every: [0.45, 0.8] },
  { cue: "arcade", x: (ARCADES[0][1] + ARCADES[1][1]) / 2, z: ARCADE_Z, every: [2.5, 5] },
  { cue: "espresso", x: 17.31, z: -8.91, every: [10, 18] },
  { cue: "kitchen", x: 18.4, z: -6.2, every: [5, 10] },
  { cue: "television", x: 15.5, z: 6.5, every: [3.5, 6] },
  { cue: "keyboard", x: OPEN_PODS[2][0], z: OPEN_PODS[2][1], every: [1.2, 2.8] },
  { cue: "phone", x: SPOTS.phoneBooth.x, z: SPOTS.phoneBooth.z, every: [4, 8] },
  { cue: "presentation", x: SPOTS.presenter.x, z: SPOTS.presenter.z, every: [4.5, 7.5] },
  ...GROUPS.map(({ centre: [x, z] }) => ({ cue: "murmur" as const, x, z, every: [2.8, 5.2] as [number, number] })),
  { cue: "murmur", x: SPOTS.kitchenChat.x, z: SPOTS.kitchenChat.z, every: [3.2, 5.8] },
  { cue: "snore", x: SPOTS.napper.x, z: SPOTS.napper.z, every: [4, 6] },
];

/** Metres from where the sounds are heard: full volume within the first, silence beyond the second. */
export const ZONE_REACH: [number, number] = [3, 11];
/** Zoom, in pixels a metre: silence below the first, full volume above the second. The game opens at 30. */
export const ZONE_ZOOM: [number, number] = [24, 45];
/**
 * The loudest a zone sound gets, as a share of the effects volume. In walk mode this intentionally sits well above
 * the faint outdoor bed heard through the walls, so what the avatar stands beside is clearly audible.
 */
export const ZONE_PEAK = 0.8;
/**
 * Seconds until a source plays its first sound after coming into earshot, so a new place answers promptly without
 * bursting the moment it is heard. `nextGap` stays the recurring cadence.
 */
export const ZONE_ENTRY_GAP: [number, number] = [0.15, 0.55];

const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/**
 * How loud a zone's sound plays, 0 to ZONE_PEAK, from where the sounds are heard: the camera's view, or the
 * avatar's own place in walk mode, where the camera's zoom no longer counts.
 */
export function zoneLevel(sound: ZoneSound, focus: Focus): number {
  const near = 1 - smooth((Math.hypot(sound.x - focus.x, sound.z - focus.z) - ZONE_REACH[0]) / (ZONE_REACH[1] - ZONE_REACH[0]));
  const close = focus.walking ? 1 : smooth((focus.zoom - ZONE_ZOOM[0]) / (ZONE_ZOOM[1] - ZONE_ZOOM[0]));
  return ZONE_PEAK * near * close;
}

/** Seconds until a zone's sound plays again, for a random number `r` from 0 to 1. */
export function nextGap(sound: ZoneSound, r: number): number {
  return sound.every[0] + r * (sound.every[1] - sound.every[0]);
}

/** Seconds until a newly heard zone's first sound, for a random number `r` from 0 to 1. */
export function entryGap(r: number): number {
  return ZONE_ENTRY_GAP[0] + r * (ZONE_ENTRY_GAP[1] - ZONE_ENTRY_GAP[0]);
}
