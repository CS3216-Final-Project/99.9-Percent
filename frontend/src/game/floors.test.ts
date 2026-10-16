import { describe, expect, it } from "vitest";
import { EQUIPMENT_ORDER, type EquipmentId, type EquipmentState } from "@/sim";
import { attentionOn, FLOORS, floorFromSearch, floorOf, otherFloor, selectedInView, type Watched } from "./floors";

const calm = (): Watched => ({
  symptomatic: [],
  inspecting: null,
  states: Object.fromEntries(EQUIPMENT_ORDER.map((id) => [id, "ok"])) as Record<EquipmentId, EquipmentState>,
  built: Object.fromEntries(EQUIPMENT_ORDER.map((id) => [id, true])) as Record<EquipmentId, boolean>,
});

describe("the building's floors", () => {
  it("put the people's desks on the office floor and every machine on the server floor", () => {
    expect(EQUIPMENT_ORDER.filter((id) => floorOf(id) === "office").sort()).toEqual(["deploy", "growth", "team"]);
    for (const id of ["gateway", "app", "standby", "cache", "db", "replica", "backup", "monitoring"] as EquipmentId[]) expect(floorOf(id), id).toBe("servers");
    for (const id of EQUIPMENT_ORDER) expect(FLOORS).toContain(floorOf(id));
  });

  it("go up and down between the two", () => {
    expect(otherFloor("office")).toBe("servers");
    expect(otherFloor("servers")).toBe("office");
  });

  it("show a selection's details only on its own floor", () => {
    expect(selectedInView("app", "servers")).toBe("app");
    expect(selectedInView("app", "office")).toBeNull();
    expect(selectedInView("growth", "office")).toBe("growth");
    expect(selectedInView("growth", "servers")).toBeNull();
    expect(selectedInView(null, "office")).toBeNull();
  });

  it("read a floor from the page address, and ignore anything else", () => {
    expect(floorFromSearch("?floor=office")).toBe("office");
    expect(floorFromSearch("?time=0.5&floor=servers")).toBe("servers");
    expect(floorFromSearch("")).toBeNull();
    expect(floorFromSearch("?floor=roof")).toBeNull();
    expect(floorFromSearch("?floor=Office")).toBeNull();
  });
});

describe("a floor out of view", () => {
  it("asks for nothing while all is calm", () => {
    expect(attentionOn("servers", calm())).toBe("none");
    expect(attentionOn("office", calm())).toBe("none");
  });

  it("raises an alert where equipment shows symptoms or is being investigated, and only there", () => {
    expect(attentionOn("servers", { ...calm(), symptomatic: ["db"] })).toBe("alert");
    expect(attentionOn("office", { ...calm(), symptomatic: ["db"] })).toBe("none");
    expect(attentionOn("servers", { ...calm(), inspecting: "gateway" })).toBe("alert");
  });

  it("warns where built equipment is strained or down, but not about equipment not yet built", () => {
    const strained = calm();
    strained.states.app = "critical";
    expect(attentionOn("servers", strained)).toBe("warn");
    expect(attentionOn("office", strained)).toBe("none");
    const team = calm();
    team.states.team = "warn";
    expect(attentionOn("office", team)).toBe("warn");
    const unbuilt = calm();
    unbuilt.states.replica = "down";
    unbuilt.built.replica = false;
    expect(attentionOn("servers", unbuilt)).toBe("none");
  });
});
