import type { SceneCue } from "@/game/sfx";
import type { Species } from "./cast";

/*
 * The room's own sounds of walking and the crew's spoken lines, sent from the scene to whatever plays them (the
 * effects and speech players in Game.tsx): footsteps, the glass doors, and each line a creature says aloud. A
 * plain list of listeners each, so the scene never touches audio itself.
 */

const listeners = new Set<(cue: SceneCue, level: number) => void>();

export function onSceneSound(listener: (cue: SceneCue, level: number) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function sceneSound(cue: SceneCue, level: number): void {
  for (const l of listeners) l(cue, level);
}

/** A line a crew member says aloud: its text, who says it and how near the avatar is (1 beside it, 0 at the edge of earshot). */
export interface SpokenLine {
  text: string;
  species: Species;
  near: number;
}

const speaking = new Set<(line: SpokenLine) => void>();

export function onSceneSpeech(listener: (line: SpokenLine) => void): () => void {
  speaking.add(listener);
  return () => speaking.delete(listener);
}

export function sceneSpeech(line: SpokenLine): void {
  for (const l of speaking) l(line);
}
