import { EQUIPMENT_ORDER, type EquipmentId, type EquipmentState } from "@/sim";
import { FLOORS, floorOf, type Floor } from "@/game/floors";
import { ELEVATOR_SPOT, FUN_PROPS } from "./floorplan";
import { ROOM } from "./layout";
import { placeAt, zoneNamesOn } from "./places";

/*
 * What the menu's map lists and marks: every place worth finding on a floor, and the pan/zoom framing of the plan.
 * Kept free of React, the browser and three.js so the rules can be tested.
 */

export type ZoneKind = "machines" | "work" | "break" | "plant";

/** What each zone is for, so the plan can colour zones by meaning and the legend can say what the colours mean. */
export const ZONE_KIND: Record<string, ZoneKind> = {
  "Server hall": "machines",
  "Network and power room": "machines",
  "Monitoring room": "machines",
  "Cooling plant": "plant",
  Workshop: "plant",
  Stores: "plant",
  "Open desks": "work",
  "Quiet desks": "work",
  Engineering: "work",
  "Meeting room": "work",
  "Huddle room": "work",
  Reception: "work",
  Kitchen: "break",
  Dining: "break",
  Lounge: "break",
  "Games room": "break",
  Foosball: "break",
  "Nap pods": "break",
  Events: "break",
  Library: "break",
};

export const ZONE_KIND_NAME: Record<ZoneKind, string> = { machines: "Machines", work: "Desks and meetings", break: "Breaks and fun", plant: "Back of house" };

export const zoneKindOf = (name: string): ZoneKind => ZONE_KIND[name] ?? "work";

export type PlaceKind = "equipment" | "zone" | "fun";
export interface Place {
  /** Unique across floors: "equipment:db", "zone:office:Lounge", "fun:arcade". */
  key: string;
  kind: PlaceKind;
  floor: Floor;
  name: string;
  x: number;
  z: number;
  /** The zone the place stands in, as the location line names it (placeAt); for a zone, its own name. */
  zone: string;
  equipment?: EquipmentId;
  state?: EquipmentState;
  /** The badge the minimap shows: symptoms of an incident, or being investigated. */
  mark?: "alert" | "busy";
}

/** The parts of the scene model the map needs (a structural subset of SceneModel). */
export interface PlaceModel {
  names: Record<EquipmentId, string>;
  built: Record<EquipmentId, boolean>;
  states: Record<EquipmentId, EquipmentState>;
  footprints: Record<EquipmentId, { x: number; z: number }>;
  symptomatic: readonly EquipmentId[];
  inspecting: EquipmentId | null;
}

/** Everything on a floor worth finding: built equipment in EQUIPMENT_ORDER, then the zones in zoneNamesOn order, then (office only) FUN_PROPS. */
export function placesOn(floor: Floor, model: PlaceModel): Place[] {
  const equipment = EQUIPMENT_ORDER.filter((id) => model.built[id] && floorOf(id) === floor).map((id): Place => {
    const { x, z } = model.footprints[id];
    return {
      key: `equipment:${id}`,
      kind: "equipment",
      floor,
      name: model.names[id],
      x,
      z,
      zone: placeAt(floor, x, z),
      equipment: id,
      state: model.states[id],
      mark: model.inspecting === id ? "busy" : model.symptomatic.includes(id) ? "alert" : undefined,
    };
  });
  const zones = zoneNamesOn(floor).map(([name, x, z]): Place => ({ key: `zone:${floor}:${name}`, kind: "zone", floor, name, x, z, zone: name }));
  zones.push({ key: `zone:${floor}:Elevator`, kind: "zone", floor, name: "Elevator", x: (ELEVATOR_SPOT[0] + ELEVATOR_SPOT[2]) / 2, z: (ELEVATOR_SPOT[1] + ELEVATOR_SPOT[3]) / 2, zone: "Elevator" });
  const fun = floor === "office" ? FUN_PROPS.map((p): Place => ({ key: `fun:${p.id}`, kind: "fun", floor, name: p.label, x: p.x, z: p.z, zone: placeAt("office", p.x, p.z) })) : [];
  return [...equipment, ...zones, ...fun];
}

/** Places on both floors, office first. */
export function allPlaces(model: PlaceModel): Place[] {
  return FLOORS.flatMap((f) => placesOn(f, model));
}

/** Case-insensitive, trimmed substring match on the name; an empty query returns `places` unchanged. */
export function findPlaces(places: Place[], query: string): Place[] {
  const q = query.trim().toLowerCase();
  if (!q) return places;
  return places.filter((p) => p.name.toLowerCase().includes(q));
}

/** How the plan is framed: zoom factor (1 = the whole floor) and the centre in metres. */
export interface MapView {
  k: number;
  cx: number;
  cz: number;
}

export const MAP_ZOOM = { min: 1, max: 4, step: 1.6 } as const;
export const HOME_VIEW: MapView = { k: 1, cx: ROOM.cx, cz: ROOM.cz };

/** k clamped to MAP_ZOOM, and the centre clamped so the framed rectangle never leaves the building. */
export function clampView(v: MapView): MapView {
  const k = Math.min(MAP_ZOOM.max, Math.max(MAP_ZOOM.min, v.k));
  const w = ROOM.w / k;
  const h = ROOM.d / k;
  const cx = w >= ROOM.w ? ROOM.cx : Math.min(ROOM.x1 - w / 2, Math.max(ROOM.x0 + w / 2, v.cx));
  const cz = h >= ROOM.d ? ROOM.cz : Math.min(ROOM.z1 - h / 2, Math.max(ROOM.z0 + h / 2, v.cz));
  return { k, cx, cz };
}

/** The SVG viewBox for a view: w = ROOM.w / k, h = ROOM.d / k, x = cx - w/2, y = cz - h/2. */
export function viewBoxOf(v: MapView): { x: number; y: number; w: number; h: number } {
  const w = ROOM.w / v.k;
  const h = ROOM.d / v.k;
  return { x: v.cx - w / 2, y: v.cz - h / 2, w, h };
}

/** Zoom by `factor` about a point on the floor (default: the centre) so that point stays put on screen, then clamp. */
export function zoomView(v: MapView, factor: number, at: [number, number] = [v.cx, v.cz]): MapView {
  return clampView({ k: v.k * factor, cx: at[0] + (v.cx - at[0]) / factor, cz: at[1] + (v.cz - at[1]) / factor });
}

export function panView(v: MapView, dx: number, dz: number): MapView {
  return clampView({ ...v, cx: v.cx + dx, cz: v.cz + dz });
}

export function centreView(v: MapView, x: number, z: number): MapView {
  return clampView({ ...v, cx: x, cz: z });
}

/** The smallest zoom-out: fewer pixels per metre than this and the plan's labels cannot be told apart. */
export const MIN_METRE_PX = 11;

/**
 * The framing a plan `widthPx` wide opens with: the whole floor where a metre already has MIN_METRE_PX pixels,
 * otherwise zoomed in until it does (never past MAP_ZOOM.max), centred on `focus` (the avatar) when given.
 * "Fit the floor" still goes to HOME_VIEW.
 */
export function initialView(widthPx: number, focus: [number, number] | null): MapView {
  return clampView({
    k: Math.min(MAP_ZOOM.max, Math.max(1, MIN_METRE_PX / (widthPx / ROOM.w))),
    cx: focus?.[0] ?? ROOM.cx,
    cz: focus?.[1] ?? ROOM.cz,
  });
}

/** A label's box on screen, in CSS pixels from the frame's top left. */
export interface LabelBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type LabelSide = "below" | "above" | "right" | "left";

/** A pin asking for a label: its anchor in px, its text, and half the marker's size, which the label clears. */
export interface LabelAsk {
  key: string;
  x: number;
  y: number;
  text: string;
  clear: number;
}

export interface FixedLabel {
  key: string;
  box: LabelBox;
}

/** Width of `text` set at `fontPx` in the display face, near enough: 0.6 em a character, plus the halo. */
export const textWidth = (text: string, fontPx: number) => text.length * 0.6 * fontPx + 8;

const overlaps = (a: LabelBox, b: LabelBox) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const inside = (a: LabelBox, b: LabelBox) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;

/**
 * Lay the pins' labels out so none overprints another, a marker or a zone name: each tries below, above, right
 * and left of its marker in turn, taking the first that fits inside `bounds` and covers nothing already placed
 * or any pin's marker (a box outside the bounds is only used when no candidate fits). Pins off the frame get no
 * label, though their markers still block. Zone names are `fixed`: a pin's label avoids them when it can, and
 * otherwise covers them - and a marker always covers them - so the zone names hidden either way come back in
 * `hidden` for the caller to leave out.
 */
export function placeLabels(
  asks: LabelAsk[],
  fixed: FixedLabel[],
  bounds: LabelBox,
  fontPx: number,
): { placed: Map<string, { side: LabelSide; box: LabelBox }>; hidden: Set<string> } {
  const placed = new Map<string, { side: LabelSide; box: LabelBox }>();
  const markers: LabelBox[] = asks.map((a) => ({ x: a.x - a.clear, y: a.y - a.clear, w: 2 * a.clear, h: 2 * a.clear }));
  const boxes: LabelBox[] = [...markers];
  const hidden = new Set<string>();
  for (const f of fixed) if (markers.some((m) => overlaps(m, f.box))) hidden.add(f.key);
  for (const ask of asks) {
    // A pin off the frame gets no label; its marker still blocks the labels of the pins on it.
    if (ask.x < bounds.x || ask.x > bounds.x + bounds.w || ask.y < bounds.y || ask.y > bounds.y + bounds.h) continue;
    const h = fontPx + 4;
    const w = textWidth(ask.text, fontPx);
    const gap = 4;
    const candidates: [LabelSide, LabelBox][] = [
      ["below", { x: ask.x - w / 2, y: ask.y + ask.clear + gap, w, h }],
      ["above", { x: ask.x - w / 2, y: ask.y - ask.clear - gap - h, w, h }],
      ["right", { x: ask.x + ask.clear + gap, y: ask.y - h / 2, w, h }],
      ["left", { x: ask.x - ask.clear - gap - w, y: ask.y - h / 2, w, h }],
    ];
    let best: [LabelSide, LabelBox] = candidates[0];
    let bestScore = Infinity;
    for (const [side, box] of candidates) {
      const score =
        (inside(box, bounds) ? 0 : 1000) +
        10 * boxes.filter((b) => overlaps(box, b)).length +
        fixed.filter((f) => !hidden.has(f.key) && overlaps(box, f.box)).length;
      if (score < bestScore) {
        bestScore = score;
        best = [side, box];
      }
    }
    placed.set(ask.key, { side: best[0], box: best[1] });
    boxes.push(best[1]);
    for (const f of fixed) if (!hidden.has(f.key) && overlaps(best[1], f.box)) hidden.add(f.key);
  }
  return { placed, hidden };
}
