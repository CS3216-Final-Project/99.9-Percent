import type { SceneCue } from "@/game/sfx";
import { roleOf, type Activity, type Kind, type Role, type Species } from "./cast";

/*
 * The crew noticing the player's avatar in walk mode (see creatures.tsx and chatter.tsx): who greets it, what they
 * say, how far round a glance turns, and how well a chatting group can be overheard from how far away. Nothing here
 * touches React, three.js or audio; the scene reads these every frame.
 */

/** Metres: within this a creature notices the avatar. */
export const NOTICE_REACH = 1.7;
/** It must go this far before it can be noticed afresh (hysteresis). */
export const NOTICE_LEAVE = 2.3;
/** How long a greeting (bubble, glance, clip) lasts. */
export const GREET_SECONDS = 2.0;
/** Seconds before the same creature greets again. */
export const GREET_AGAIN = 12;
/** Shortest gap between greetings from anyone. */
export const GREET_SPACING = 0.7;
/** Seconds a glance takes to turn in, and to turn back out. */
export const GLANCE_SECONDS = 0.35;
/** Metres from a group: every word within the first, nothing beyond the second. */
export const EARSHOT: [number, number] = [3, 7];
/** Loudest a voice plays, as a share of the effects volume. */
export const VOICE_PEAK = 0.6;

/** Ease in and out over 0..1. */
const ease = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/** What a creature says when it notices the avatar, by its role: short, plain text that fits a bubble. */
export const HELLOS: Record<Role, string[]> = {
  dev: ["Hey boss!", "Shipping it!", "Tests are green", "One more bug...", "Works on my machine"],
  sre: ["Pager's quiet", "All green, boss", "Five nines or bust", "Don't touch prod"],
  pm: ["Got a sec?", "Roadmap's ready", "Let's sync later", "Hey, boss!"],
  designer: ["Like the new icons?", "Hi boss!", "Pixels, pixels", "Nice avatar!"],
  data: ["Numbers look good", "Hi boss!", "Charts are up", "p99 is fine"],
  intern: ["Hi! Hello!", "Is this right?", "Coffee, boss?", "First day nerves"],
  founder: ["Morning!", "Big launch soon", "How's uptime?"],
  security: ["Badge, please", "All clear", "Rotate your keys", "Hmm."],
  tech: ["Racks are humming", "Hey boss", "Cables are tidy", "Mind the fans"],
  frontdesk: ["Welcome back!", "Any visitors?", "Hello there!", "Parcel for you"],
  marketer: ["Launch day soon!", "Love the brand", "Hey boss!", "Going viral?"],
};

/** What a panicking creature says instead of its hello. */
export const PANIC_HELLOS = ["Not now, boss!", "Prod's on fire!", "Have you seen this?!", "Where's the runbook?", "It's always DNS"];

/** What a member of a chatting group says to the avatar right up close. */
export const ASIDES = ["Oh, hey boss!", "Need something?", "Shh, we're talking", "Want in?", "We were just saying", "Boss on deck!"];

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** What a creature says when it notices the avatar: the outage if it is panicking, otherwise a line for its role; `n` steps through them. */
export function greetingLine(species: Species, activity: Activity, n: number): string {
  if (activity === "panic") return PANIC_HELLOS[mod(n, PANIC_HELLOS.length)];
  const lines = HELLOS[roleOf(species)];
  return lines[mod(n, lines.length)];
}

/** What a member of a chatting group says to the avatar, `n` stepping through them. */
export function asideLine(n: number): string {
  return ASIDES[mod(n, ASIDES.length)];
}

/** The voice a body plan speaks in (see game/sfx.ts). */
export const voiceOf = (kind: Kind): SceneCue => ({ blob: "voiceBlob", big: "voiceBig", flyer: "voiceFlyer" } as const)[kind];

/** How loud a voice `distance` metres away plays: VOICE_PEAK within a metre, fading to silence at EARSHOT[1]. */
export function voiceLevel(distance: number): number {
  return VOICE_PEAK * (1 - ease((distance - 1) / (EARSHOT[1] - 1)));
}

/** How well a group `distance` metres away can be followed, 1 to 0 (bubble opacity). */
export function earshot(distance: number): number {
  return 1 - ease((distance - EARSHOT[0]) / (EARSHOT[1] - EARSHOT[0]));
}

/** What the caption shows: the line being said, or during the pause between speakers the last one, while the group can be followed at all; nothing once it cannot. */
export function captionLine(line: string | null, last: string | null, audible: boolean): string | null {
  return audible ? (line ?? last) : null;
}

/** How far round a glance has turned, 0..1: eases in over GLANCE_SECONDS, holds, eases back out before GREET_SECONDS is up. */
export function glance(since: number): number {
  if (since < 0 || since >= GREET_SECONDS) return 0;
  return Math.min(ease(since / GLANCE_SECONDS), ease((GREET_SECONDS - since) / GLANCE_SECONDS));
}

/** Whether a creature has already noticed the avatar, and when it last greeted it. */
export interface Notice {
  inside: boolean;
  lastAt: number;
}

export const fresh = (): Notice => ({ inside: false, lastAt: -Infinity });

let lastAnyone = -Infinity;
export const resetGreetings = () => {
  lastAnyone = -Infinity;
};

/**
 * Whether something `distance` metres from the avatar greets it now. Fires on coming within NOTICE_REACH; not again
 * until it has gone beyond NOTICE_LEAVE and come back, and GREET_AGAIN has passed; and never within GREET_SPACING of
 * anyone else's greeting — in that case it is NOT marked inside, so it tries again next frame and the hellos come
 * one after another rather than in a chorus.
 */
export function notices(state: Notice, distance: number, now: number): boolean {
  if (distance > NOTICE_LEAVE) {
    state.inside = false;
    return false;
  }
  if (distance > NOTICE_REACH || state.inside) return false;
  if (now - state.lastAt < GREET_AGAIN) {
    state.inside = true;
    return false;
  }
  if (now - lastAnyone < GREET_SPACING) return false;
  state.inside = true;
  state.lastAt = now;
  lastAnyone = now;
  return true;
}
