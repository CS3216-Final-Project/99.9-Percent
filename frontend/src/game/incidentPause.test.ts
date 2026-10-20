import { expect, it } from "vitest";
import { newGame } from "@/sim";
import { step } from "@/sim/step";
import { act, tick } from "@/sim/__tests__/spikeFixtures";
import { preparedReliability } from "@/sim/__tests__/reliabilityFixture";
import { pauseTransition } from "@/sim/__tests__/pauseFixture";
import { incidentNeedsPause, campaignAttention } from "./campaignAttention";

it.each([1, 2, 3, 4, 5, 6])("recognises the observed Chapter %i incident without a chapter script or mutation", chapter => {
  const { before, incident } = pauseTransition(chapter); const original = structuredClone(incident);
  expect(incidentNeedsPause(before)).toBe(false);
  expect(incidentNeedsPause(incident), campaignAttention(incident).reason).toBe(true);
  expect(incident).toEqual(original);
});
it("retains the existing first-incident engine stop instead of changing automatic clock behaviour", () => {
  const g = tick(newGame(), 5), result = step(g);
  expect(result.stopReason).toBe("first-incident"); expect(result.state.phase).toBe("incident");
});
it("excludes accepted relevant DB/admission work, measured recovery and confirmed review", () => {
  const g = tick(newGame(), 6);
  for (const action of [{ type: "start_db_upgrade" }, { type: "set_traffic_limit", enabled: true }] as const) {
    let s = act(g, action); expect(incidentNeedsPause(s)).toBe(false);
    for (let i = 0; i < 50 && s.phase !== "review"; i++) {
      s = tick(s);
      if (s.campaign!.incident?.stableSteps) expect(incidentNeedsPause(s)).toBe(false);
    }
    expect(s.phase).toBe("review"); expect(incidentNeedsPause(s)).toBe(false);
  }
});
it("allows investigation despite an unrelated purchase, while a valid queued failover needs time", () => {
  expect(incidentNeedsPause(act(tick(newGame(), 6), { type: "add_server" }))).toBe(true);
  const queued = tick(act(preparedReliability(), { type: "arm_reliability" }), 9);
  expect(campaignAttention(queued).reason).toBe("activation-promote-spare"); expect(incidentNeedsPause(queued)).toBe(false);
  const failure = pauseTransition(5).incident;
  const restoring = act(failure, { type: "restore_app", appId: failure.campaign!.reliabilityStage!.fault!.targetId });
  expect(incidentNeedsPause(restoring)).toBe(false);
  const other = restoring.campaign!.snapshot.instances!.find(x => x.routed && x.id !== failure.campaign!.reliabilityStage!.fault!.targetId)!;
  other.demand = other.capacity + 1;
  expect(incidentNeedsPause(restoring)).toBe(true); // Restoration does not fix a different server's recorded overload.
});
it("does not interrupt actual qualifying observations even if a remaining bottleneck still warrants optional investigation", () => {
  let g = act(tick(newGame(), 6), { type: "start_db_upgrade" });
  for (let i = 0; i < 30 && !g.campaign!.incident?.stableSteps; i++) g = tick(g);
  const m = g.campaign!.snapshot; m.db.demand = m.db.capacity + 1;
  expect(campaignAttention(g).attention).toBe("hint"); expect(incidentNeedsPause(g)).toBe(false);
});
