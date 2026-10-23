import { expect, it } from "vitest";
import { beamTargets, rackLit } from "./spotSpec";
import { appSlot, RACK } from "./layout";
import { floorOf } from "@/game/floors";
import { buildModel } from "./sceneModel";
import { newGame } from "@/sim";

const model = buildModel(newGame());
const footprints = model.footprints;
const layout = { apps: ["app-1"], dbCabinets: model.dbCabinets };

it("lands an equipment id on its whole pad and an App Server id on its one rack", () => {
  const db = beamTargets(["db"], footprints, layout);
  expect(db).toHaveLength(layout.dbCabinets); expect(db.every(t => t.floor === "servers")).toBe(true);
  const [gate] = beamTargets(["gateway"], footprints, layout);
  expect(gate).toMatchObject({ x: footprints.gateway.x, z: footprints.gateway.z, floor: floorOf("gateway") });
  const [app] = beamTargets(["app-1"], footprints, layout);
  expect(app).toMatchObject({ ...appSlot(0), w: RACK.w, d: RACK.d, floor: "servers" });
  expect(beamTargets(["app"], footprints, layout)).toHaveLength(Math.min(layout.apps.length, 12));
  expect(beamTargets(["nonsense"], footprints, layout)).toHaveLength(0);
});

it("lights only the named racks; the app family covers its servers and the gateway its load balancer", () => {
  expect(rackLit(["db"], "db")).toBe(true); expect(rackLit(["db"], "gateway")).toBe(false);
  expect(rackLit(["app"], "app-3")).toBe(true); expect(rackLit(["app"], "temp")).toBe(true);
  expect(rackLit(["app-2"], "app-1")).toBe(false); expect(rackLit(["gateway"], "lb")).toBe(true);
  expect(rackLit([], "db")).toBe(false);
});
