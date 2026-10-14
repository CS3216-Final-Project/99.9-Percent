import type { SceneCue } from "@/game/sfx";

/*
 * The room's own sounds of walking, sent from the scene to whatever plays them (the effects player in Game.tsx):
 * footsteps and the glass doors. A plain list of listeners, so the scene never touches audio itself.
 */

const listeners = new Set<(cue: SceneCue, level: number) => void>();

export function onSceneSound(listener: (cue: SceneCue, level: number) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function sceneSound(cue: SceneCue, level: number): void {
  for (const l of listeners) l(cue, level);
}
