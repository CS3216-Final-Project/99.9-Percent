import { floorOf, type Floor } from "@/game/floors";
import type { EquipmentId } from "@/sim";
import { appSlot, dbSlot, DB_CABINET, RACK, type Footprint } from "./layout";
import type { FloorLayout } from "./trafficLayout";

export interface BeamTarget { x: number; z: number; w: number; d: number; floor: Floor }

/**
 * Where a guidance spotlight lands in the room: an equipment id lands on its whole pad, an App Server id on its
 * one rack, and "app" on every installed server. Ids on the other floor are left to that floor's own beams.
 */
export function beamTargets(spot: string[], footprints: Record<EquipmentId, Footprint>, layout: FloorLayout): BeamTarget[] {
  const out: BeamTarget[] = [];
  for (const id of spot) {
    if (id === "app") for (let i = 0; i < Math.min(layout.apps.length, 12); i++) out.push({ ...appSlot(i), w: RACK.w, d: RACK.d, floor: "servers" });
    else if (id.startsWith("app-")) {
      const i = layout.apps.indexOf(id);
      if (i >= 0 && i < 12) out.push({ ...appSlot(i), w: RACK.w, d: RACK.d, floor: "servers" });
    } else if (id === "db") for (let i = 0; i < layout.dbCabinets; i++) out.push({ ...dbSlot(i), w: DB_CABINET.w, d: DB_CABINET.d, floor: "servers" });
    else {
      const f = footprints[id as EquipmentId];
      if (f) out.push({ x: f.x, z: f.z, w: f.w, d: f.d, floor: floorOf(id as EquipmentId) });
    }
  }
  return out;
}

/** Whether a rack is one of the lit machines; app ids and their "app" family both light App Server racks. */
export function rackLit(spot: string[], rackId: string): boolean {
  return spot.includes(rackId)
    || (rackId.startsWith("app-") || rackId === "temp") && spot.includes("app")
    || rackId === "lb" && spot.includes("gateway");
}
