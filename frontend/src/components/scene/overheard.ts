import type { Role } from "./cast";

/*
 * What the avatar can overhear of a chatting group right now, shared by the groups (see chatter.tsx) and the caption
 * on the page (see Facility.tsx). Each group publishes its current line and the role of whoever said it under its
 * own name; the groups stand far apart, so at most one is in earshot and the first entry is what the caption shows.
 */

export interface Overheard {
  speaker: Role;
  line: string;
  alarmed: boolean;
}

const heard = new Map<string, Overheard>();
const listeners = new Set<(o: Overheard | null) => void>();
let shown: Overheard | null = null;

function publish(): void {
  const next = heard.values().next().value ?? null;
  if (next === shown || (next && shown && next.speaker === shown.speaker && next.line === shown.line && next.alarmed === shown.alarmed)) return;
  shown = next ?? null;
  for (const l of listeners) l(shown);
}

/** Publish (or clear, with null) what one group is saying within the avatar's earshot. */
export function overhear(key: string, o: Overheard | null): void {
  if (o) heard.set(key, o);
  else heard.delete(key);
  publish();
}

/** Hear when the line in earshot changes. Returns the way to stop listening. */
export function onOverheard(listener: (o: Overheard | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Drop everything overheard, as when walk mode ends. */
export function clearOverheard(): void {
  if (!heard.size && !shown) return;
  heard.clear();
  publish();
}
