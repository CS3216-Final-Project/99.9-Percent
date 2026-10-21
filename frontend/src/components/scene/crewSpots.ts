import type * as THREE from "three";
import { FLOOR_Y } from "./levels";
import type { Floor } from "@/game/floors";
import type { Body } from "./spacing";

/*
 * The crew as the map sees them: every creature drawn in the building, read where it stands whenever the map looks.
 * The room keeps their world matrices current every frame, on whichever floor is hidden too.
 */

const crew = new Map<THREE.Object3D, number>();

/** A creature is in the building; the returned function takes it out again. */
export function standing(o: THREE.Object3D, r = 0): () => void {
  crew.set(o, r);
  return () => crew.delete(o);
}

/** Where the crew stand on a floor now, as [x, z] pairs. */
export function crewOn(floor: Floor): [number, number][] {
  const at: [number, number][] = [];
  const middle = (FLOOR_Y.office + FLOOR_Y.servers) / 2;
  for (const o of crew.keys()) {
    const e = o.matrixWorld.elements;
    const on: Floor = e[13] < middle ? "servers" : "office";
    if (on === floor) at.push([e[12], e[14]]);
  }
  return at;
}

export function bodiesOn(floor: Floor, skip?: (o: THREE.Object3D) => boolean): Body[] {
  const at: Body[] = [];
  const middle = (FLOOR_Y.office + FLOOR_Y.servers) / 2;
  for (const [o, r] of crew) {
    if (r <= 0 || skip?.(o)) continue;
    const e = o.matrixWorld.elements;
    const on: Floor = e[13] < middle ? "servers" : "office";
    if (on === floor) at.push({ x: e[12], z: e[14], r });
  }
  return at;
}

export function within(o: THREE.Object3D, ancestor: THREE.Object3D): boolean {
  for (let parent = o.parent; parent; parent = parent.parent) if (parent === ancestor) return true;
  return false;
}
