import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ALL_SPECIES, SPECIES, type Species } from "./cast";
import { loadGltf } from "./gltf";

const CREATURES = "/models/creatures/";
const url = (s: Species) => `${CREATURES}${SPECIES[s].file}.glb`;

export type Crew = Map<Species, GLTF>;
let crew: Promise<Crew> | null = null;

/** Fetch every species once. A failure is reported once and forgotten, so a later mount tries again. */
export function loadCrew(): Promise<Crew> {
  if (crew) return crew;
  const attempt = Promise.all(ALL_SPECIES.map((s) => loadGltf(url(s)))).then((list) => new Map(ALL_SPECIES.map((s, i) => [s, list[i]])));
  crew = attempt;
  attempt.catch((error: unknown) => {
    if (crew === attempt) crew = null;
    console.warn("Creature models failed to load; the office carries on without its crew.", error);
  });
  return attempt;
}

/** Start fetching the crew as soon as the 3D scene's code loads. */
export function preloadCreatures(): void {
  loadCrew().catch(() => {});
}
