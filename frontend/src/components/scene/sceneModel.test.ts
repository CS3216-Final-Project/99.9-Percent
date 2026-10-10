// @vitest-environment node
import { describe, expect, it } from "vitest";
import { advanceTurn, applyAction, incidentTick, newGame, newLegacyGame, type Action, type GameState } from "@/sim";
import { advanceSteps, step } from "@/sim/step";
import { buildModel } from "./sceneModel";

function must(s: GameState, action: Action): GameState {
  const r = applyAction(s, action);
  if (!r.ok) throw new Error(r.message);
  return r.state;
}

// E2E skips drawing the room in most journeys, so the incident rules of the scene are pinned here.
describe("scene model", () => {
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
});
