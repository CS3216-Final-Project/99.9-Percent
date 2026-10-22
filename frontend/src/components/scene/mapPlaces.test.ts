import { describe, expect, it } from "vitest";
import { newLegacyGame } from "@/sim";
import { ROOM } from "./layout";
import {
  allPlaces,
  centreView,
  clampView,
  findPlaces,
  HOME_VIEW,
  initialView,
  placeLabels,
  placesOn,
  textWidth,
  viewBoxOf,
  panView,
  ZONE_KIND,
  zoomView,
  type LabelBox,
  type PlaceModel,
} from "./mapPlaces";
import { buildModel } from "./sceneModel";
import { zoneNamesOn } from "./places";

const model = () => buildModel(newLegacyGame(1)) as PlaceModel;

describe("placesOn", () => {
  it("lists the server floor's built equipment first, in equipment order, then its zones, with nothing else", () => {
    const places = placesOn("servers", model());
    expect(places.slice(0, 3).map((p) => p.name)).toEqual(["Network", "Servers", "Database"]);
    expect(places.filter((p) => p.kind === "fun")).toEqual([]);
    const names = places.map((p) => p.name);
    expect(names).toContain("Server hall");
    expect(names).toContain("Workshop");
    expect(names).toContain("Elevator");
    expect(names).not.toContain("Cache");
    for (const p of places) expect(p.floor).toBe("servers");
  });

  it("lists the office floor's equipment, then its fifteen zones, then the five fun things", () => {
    const places = placesOn("office", model());
    expect(places.slice(0, 3).map((p) => p.name)).toEqual(["Deploy", "Team", "Growth"]);
    const zones = places.filter((p) => p.kind === "zone");
    const fun = places.filter((p) => p.kind === "fun");
    expect(zones).toHaveLength(15);
    expect(zones.at(-1)?.name).toBe("Elevator");
    expect(fun).toHaveLength(5);
    // Groups keep their order: equipment, zones, fun.
    expect(places[3].kind).toBe("zone");
    expect(places[18].kind).toBe("fun");
  });

  it("gives every named zone on both floors a kind", () => {
    for (const floor of ["office", "servers"] as const) for (const [name] of zoneNamesOn(floor)) expect(ZONE_KIND[name], name).toBeTruthy();
  });

  it("marks symptomatic equipment as an alert and what is being investigated as busy", () => {
    const m = model();
    const db = () => placesOn("servers", m).find((p) => p.equipment === "db")!;
    m.symptomatic = ["db"];
    expect(db().mark).toBe("alert");
    m.inspecting = "db";
    expect(db().mark).toBe("busy");
  });
});

describe("findPlaces", () => {
  it("matches a trimmed, case-insensitive substring of the name", () => {
    const all = allPlaces(model());
    expect(findPlaces(all, "")).toBe(all);
    const found = findPlaces(all, " DATA ");
    expect(found.map((p) => p.name)).toEqual(["Database"]);
    expect(findPlaces(all, "coff").map((p) => p.name)).toEqual(["Make a coffee"]);
  });
});

describe("the map view", () => {
  it("frames the whole floor at home and clamps zoom to the range", () => {
    const box = viewBoxOf(HOME_VIEW);
    expect(box).toEqual({ x: ROOM.x0, y: ROOM.z0, w: ROOM.w, h: ROOM.d });
    expect(clampView({ k: 9, cx: ROOM.cx, cz: ROOM.cz }).k).toBe(4);
  });

  it("pulls the centre in so the frame never leaves the building", () => {
    const v = clampView({ k: 2, cx: ROOM.x0, cz: ROOM.z1 });
    const box = viewBoxOf(v);
    expect(box.x).toBeGreaterThanOrEqual(ROOM.x0);
    expect(box.x + box.w).toBeLessThanOrEqual(ROOM.x1);
    expect(box.y).toBeGreaterThanOrEqual(ROOM.z0);
    expect(box.y + box.h).toBeLessThanOrEqual(ROOM.z1);
  });

  it("zooms about a point so it stays in the same place in the frame", () => {
    const at: [number, number] = [0, 0];
    const before = viewBoxOf(HOME_VIEW);
    const fx = (at[0] - before.x) / before.w;
    const fy = (at[1] - before.y) / before.h;
    const after = viewBoxOf(zoomView(HOME_VIEW, 2, at));
    expect((at[0] - after.x) / after.w).toBeCloseTo(fx);
    expect((at[1] - after.y) / after.h).toBeCloseTo(fy);
  });

  it("cannot pan while the whole floor shows, and centres on a point once zoomed", () => {
    expect(panView(HOME_VIEW, 5, 5)).toEqual(HOME_VIEW);
    const v = centreView({ ...HOME_VIEW, k: 2 }, -10, 5);
    const box = viewBoxOf(v);
    expect(-10).toBeGreaterThanOrEqual(box.x);
    expect(-10).toBeLessThanOrEqual(box.x + box.w);
    expect(5).toBeGreaterThanOrEqual(box.y);
    expect(5).toBeLessThanOrEqual(box.y + box.h);
  });

  it("opens at the whole floor on wide frames and closer on narrow ones", () => {
    expect(initialView(780, [10, 10])).toEqual(HOME_VIEW);
    const narrow = initialView(310, [5, 5]);
    expect(narrow.k).toBeCloseTo(1.56, 2);
    const box = viewBoxOf(narrow);
    expect(5).toBeGreaterThanOrEqual(box.x);
    expect(5).toBeLessThanOrEqual(box.x + box.w);
    expect(initialView(60, null).k).toBe(4);
  });
});

describe("placeLabels", () => {
  const bounds: LabelBox = { x: 0, y: 0, w: 780, h: 425 };
  const ask = (key: string, x: number, y: number, text = key) => ({ key, x, y, text, clear: 11 });

  it("estimates a label's width", () => {
    expect(textWidth("Database", 11)).toBeCloseTo(60.8);
  });

  it("puts a lone label below its pin", () => {
    const { placed } = placeLabels([ask("a", 390, 200)], [], bounds, 11);
    expect(placed.get("a")?.side).toBe("below");
    expect(placed.get("a")?.box.y).toBeGreaterThan(200);
  });

  it("stacks colliding labels: below, then above", () => {
    const { placed } = placeLabels([ask("a", 390, 200), ask("b", 390, 200)], [], bounds, 11);
    expect(placed.get("a")?.side).toBe("below");
    expect(placed.get("b")?.side).toBe("above");
  });

  it("labels a pin near the bottom edge above it, and a corner pin to its left", () => {
    const { placed } = placeLabels([ask("low", 390, 415), ask("corner", 770, 415)], [], bounds, 11);
    expect(placed.get("low")?.side).toBe("above");
    expect(placed.get("corner")?.side).toBe("left");
  });

  it("keeps labels off other pins' markers", () => {
    const fixed = [
      { key: "below-zone", box: { x: 365, y: 212, w: 80, h: 20 } },
      { key: "above-zone", box: { x: 365, y: 165, w: 80, h: 20 } },
    ];
    const { placed } = placeLabels([ask("a", 400, 200, "Database"), ask("b", 449, 200)], fixed, bounds, 11);
    expect(placed.get("a")?.side).toBe("left");
  });

  it("hides a zone name a marker sits on, even when no label covers it", () => {
    const zone = { key: "zone", box: { x: 385, y: 195, w: 30, h: 10 } };
    const { hidden } = placeLabels([ask("a", 400, 200)], [zone], bounds, 11);
    expect(hidden.has("zone")).toBe(true);
  });

  it("gives off-frame pins no label while still labelling the ones on it", () => {
    const { placed } = placeLabels([ask("off", -50, 200), ask("on", 390, 200)], [], bounds, 11);
    expect(placed.has("off")).toBe(false);
    expect(placed.has("on")).toBe(true);
  });

  it("prefers the side that covers no fixed label, and only hides one when every side covers one", () => {
    const zone = { key: "zone:Meeting room", box: { x: 350, y: 225, w: 90, h: 16 } };
    const free = placeLabels([ask("a", 390, 200)], [zone], bounds, 11);
    expect(free.placed.get("a")?.side).toBe("above");
    expect(free.hidden.size).toBe(0);
    // Wall of fixed labels on every side of the pin: the label still lands, and the covered name is reported.
    const wall = [
      { key: "b", box: { x: 340, y: 216, w: 100, h: 20 } },
      { key: "t", box: { x: 340, y: 160, w: 100, h: 20 } },
      { key: "r", box: { x: 408, y: 185, w: 80, h: 20 } },
      { key: "l", box: { x: 250, y: 185, w: 120, h: 20 } },
    ];
    const boxed = placeLabels([ask("a", 390, 200)], wall, bounds, 11);
    expect(boxed.placed.get("a")).toBeTruthy();
    expect(insideBox(boxed.placed.get("a")!.box, bounds)).toBe(true);
    expect(boxed.hidden.size).toBeGreaterThan(0);
  });
});

const insideBox = (a: LabelBox, b: LabelBox) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
