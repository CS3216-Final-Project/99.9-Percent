import type { Species } from "./cast";
import { heading } from "./routes";

/*
 * Crew chatting in small groups around the office. Each group stands in a
 * ring facing its middle and takes turns to speak, one line at a time, shown
 * in a speech bubble. Who speaks and what they say come from the clock, so
 * every group keeps talking without any state to save. During an incident the
 * talk turns to the outage.
 *
 * Lines stay short, plain text with no emoji, so they fit a bubble in the
 * pixel font.
 */

export interface Member {
  species: Species;
  x: number;
  z: number;
}

export interface Group {
  name: string;
  /** The point the group stands round and faces. */
  centre: [number, number];
  members: Member[];
  /** What the group talks about on a normal day. */
  lines: string[];
  /** Seconds added to the clock, so groups do not change speaker together. */
  offset: number;
}

/** Seconds each speaker holds the floor. */
export const TURN_SECONDS = 4.2;
/** How much of a turn the speaker's bubble shows; the rest is a pause. */
export const SPEAKING = 0.75;
/** The longest line a bubble holds. */
export const MAX_LINE = 20;

export const INCIDENT_LINES = [
  "Is prod down?!",
  "Who deployed?",
  "Roll it back!",
  "Check the graphs!",
  "Pager's going off",
  "It's always DNS",
  "All hands on deck!",
  "Status page, now!",
];

/** Members spaced evenly round a centre, the first nearest the given angle. */
function ring(centre: [number, number], radius: number, species: Species[], start: number): Member[] {
  return species.map((s, i) => {
    const a = start + (i / species.length) * Math.PI * 2;
    return { species: s, x: centre[0] + Math.cos(a) * radius, z: centre[1] + Math.sin(a) * radius };
  });
}

export const GROUPS: Group[] = [
  {
    name: "standup by the east window",
    centre: [19.6, 2.8],
    members: ring([19.6, 2.8], 0.65, ["cat", "pinkSlime", "mushnub"], -Math.PI / 2),
    lines: ["Standup in 5?", "Who broke main?", "Tests are green", "Ship it!", "LGTM", "Is that a P2?", "Merge conflict again", "Rewrite it in Rust?", "One more feature", "Works on my machine"],
    offset: 0,
  },
  {
    name: "catch-up by reception",
    centre: [9.4, 11.9],
    members: ring([9.4, 11.9], 0.65, ["chick", "birb", "greenBlob"], -Math.PI / 2),
    lines: ["Coffee run?", "Pizza's here!", "Seed round closed!", "The train was late", "Lunch at noon?", "Demo day Friday", "Nice hoodie!", "We're hiring!", "Let's circle back", "Five nines or bust"],
    offset: 1.7,
  },
  {
    name: "planning by the townhall screen",
    centre: [-15.7, 6.9],
    members: ring([-15.7, 6.9], 0.75, ["yeti", "ninja", "monkroose"], -Math.PI / 2),
    lines: ["Q3 roadmap?", "Let's whiteboard it", "Users love it", "Need more servers", "Ship by Friday?", "Scale it up!", "Nice dashboard!", "Uptime is a feature", "Big launch soon", "Five nines or bust"],
    offset: 3.1,
  },
];

/** Which way a member turns to face the middle of their group. */
export function memberRotation(group: Group, i: number): number {
  const m = group.members[i];
  return heading(group.centre[0] - m.x, group.centre[1] - m.z);
}

export interface Turn {
  /** Which member is speaking. */
  speaker: number;
  /** What they are saying, or null in the pause before the next speaker. */
  line: string | null;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** Who is speaking in a group at time t seconds and what they say. */
export function turnAt(group: Group, t: number, incident: boolean): Turn {
  const clock = (t + group.offset) / TURN_SECONDS;
  const k = Math.floor(clock);
  const lines = incident ? INCIDENT_LINES : group.lines;
  // Step through the lines three at a time; with a count that three does not divide, every line comes round.
  const line = lines[mod(k * 3 + Math.round(group.offset * 10), lines.length)];
  return { speaker: mod(k, group.members.length), line: clock - k < SPEAKING ? line : null };
}
