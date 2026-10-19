import type * as THREE from "three";
import { FLOOR_Y } from "./levels";
import type { Floor } from "@/game/floors";

/*
 * The crew as the map sees them: every creature drawn in the building, read where it stands whenever the map looks.
 * The room keeps their world matrices current every frame, on whichever floor is hidden too.
 */

const crew = new Set<THREE.Object3D>();

/** A creature is in the building; the returned function takes it out again. */
export function standing(o: THREE.Object3D): () => void {
  crew.add(o);
  return () => crew.delete(o);
}

/** Where the crew stand on a floor now, as [x, z] pairs. */
export function crewOn(floor: Floor): [number, number][] {
  const at: [number, number][] = [];
  const middle = (FLOOR_Y.office + FLOOR_Y.servers) / 2;
  for (const o of crew) {
    const e = o.matrixWorld.elements;
    const on: Floor = e[13] < middle ? "servers" : "office";
    if (on === floor) at.push([e[12], e[14]]);
  }
  return at;
}
