// @vitest-environment node
import { describe, expect, it } from "vitest";
import { advanceTurn, applyAction, incidentTick, newGame, newLegacyGame, type Action, type GameState } from "@/sim";
import { advanceSteps, step } from "@/sim/step";
import { buildModel } from "./sceneModel";
import {dataCompany} from "@/sim/__tests__/dataFixture";
import {footprint,dbSlot,DB_CABINET} from "./layout";

function must(s: GameState, action: Action): GameState {
  const r = applyAction(s, action);
  if (!r.ok) throw new Error(r.message);
  return r.state;
}

// E2E skips drawing the room in most journeys, so the incident rules of the scene are pinned here.
describe("scene model", () => {
  it("renders the fourth campaign DB cabinet in the same footprint as the activated tier",()=>{
    let s=dataCompany();s=must(s,{type:"start_db_upgrade"});s=advanceSteps(s,4).state;
    expect(s.campaign!.dbCapacity).toBe(3000);const m=buildModel(s),pad=footprint(s,"db");
    expect(m.dbCabinets).toBe(4);expect(m.footprints.db).toEqual(pad);
    for(let i=0;i<m.dbCabinets;i++)expect(Math.abs(dbSlot(i).x-pad.x)+DB_CABINET.w/2).toBeLessThanOrEqual(pad.w/2);
  });
  it("shows a Classic incident only as far as the player has investigated", () => {
    let s = advanceTurn({ ...newLegacyGame(1), users: 4500 });
    expect(s.phase).toBe("incident");
    s.infra.dbHost.status = "failed";
    let m = buildModel(s);
    expect(m.incident).toBe(true);
    expect(m.symptomatic).toContain("app");
    // A dead machine looks fine on the floor until someone checks it.
    expect(m.dbLed).toBe("ok");

    s = must(s, { type: "incident_inspect", equipment: "db" });
    expect(buildModel(s).inspecting).toBe("db");
    while (s.incident!.inspecting) s = incidentTick(s, 1);
    m = buildModel(s);
    expect(m).toMatchObject({ inspected: ["db"], inspecting: null, dbLed: "off" });
  });

  it("follows the Campaign incident and leaves an unrouted server dark", () => {
    let s = advanceSteps(newGame(1, "scene"), 6).state;
    expect(buildModel(s).incident).toBe(true);
    s = must(s, { type: "add_server" });
    while (s.campaign!.apps.length < 2) s = step(s).state;
    expect(buildModel(s).hosts).toEqual(["ok", "off"]);
  });
  it("shows each application's own constraint and keeps an unrouted queue visible until drained", () => {
    let s=newGame(3,"individual-racks");const c=s.campaign!;
    c.apps[0].capacity=1600;c.apps[0].tier="large";
    c.apps.push({id:"app-2",capacity:600,backlog:0,routed:true,tier:"base",state:"active"});
    c.routing={mode:"balanced",targets:["app-1","app-2"]};c.loadBalancer=true;c.dbCapacity=2000;c.incomingRate=1400;
    s=step(s).state;
    expect(s.campaign!.snapshot.app.demandRatio).toBeLessThan(1);
    expect(buildModel(s).hosts).toEqual(["ok","critical"]);
    s.campaign!.routing={mode:"single",targets:["app-1"]};s.campaign!.apps[1].routed=false;s.campaign!.apps[1].backlog=1000;
    s=step(s).state;expect(buildModel(s).hosts).toEqual(["ok","warn"]);
    s=step(s).state;expect(buildModel(s).hosts).toEqual(["ok","off"]);
  });
});
