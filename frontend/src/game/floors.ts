import type { EquipmentId, EquipmentState } from "@/sim";

/*
 * The building's two floors: the office on top, and below it the servers with the database, the network and the
 * monitoring room. The room shows one floor at a time. Which floor a piece of equipment stands on is decided here
 * from its id, so the simulation never knows about floors, and the floor in view is never saved.
 *
 * Kept free of React, three.js and the browser so the rules can be tested; scene/levels.ts adds where the floors
 * stand and how the elevator rides between them.
 */

export type Floor = "office" | "servers";

export const FLOORS: Floor[] = ["office", "servers"];

/** What the floor menu calls each floor. */
export const FLOOR_NAME: Record<Floor, string> = { office: "Office floor", servers: "Server floor" };

/** The equipment that works on the office floor: the people and their desks. Everything else is a machine. */
const OFFICE_EQUIPMENT: readonly EquipmentId[] = ["deploy", "team", "growth"];

export function floorOf(id: EquipmentId): Floor {
  return OFFICE_EQUIPMENT.includes(id) ? "office" : "servers";
}

export function otherFloor(floor: Floor): Floor {
  return floor === "office" ? "servers" : "office";
}

/** A floor fixed by the page address (`?floor=office`), for screenshots and tests. Anything else is ignored. */
export function floorFromSearch(search: string): Floor | null {
  const value = new URLSearchParams(search).get("floor");
  return value === "office" || value === "servers" ? value : null;
}

/** What took the player to another floor, for the analytics. */
export type FloorSwitch = "menu" | "key" | "elevator" | "select" | "tour" | "incident" | "action";

/** What a floor out of view asks of the player: nothing, a warning, or an alert. */
export type Attention = "none" | "warn" | "alert";

/** The parts of the room's state that say which equipment needs looking at. */
export interface Watched {
  symptomatic: readonly EquipmentId[];
  inspecting: EquipmentId | null;
  states: Record<EquipmentId, EquipmentState>;
  built: Record<EquipmentId, boolean>;
}

/**
 * What needs the player on a floor: an alert while equipment there shows symptoms of an incident or is being
 * investigated, or a warning while built equipment there is strained or down.
 */
export function attentionOn(floor: Floor, model: Watched): Attention {
  const here = (id: EquipmentId) => floorOf(id) === floor;
  if (model.symptomatic.some(here) || (model.inspecting !== null && here(model.inspecting))) return "alert";
  const ids = Object.keys(model.states) as EquipmentId[];
  return ids.some((id) => here(id) && model.built[id] && (model.states[id] === "warn" || model.states[id] === "critical" || model.states[id] === "down")) ? "warn" : "none";
}
