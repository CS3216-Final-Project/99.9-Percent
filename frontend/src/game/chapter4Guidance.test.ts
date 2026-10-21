import { expect, it } from "vitest";
import { chapter4Stage } from "./chapter4Guidance";
import { campaignAttention } from "./campaignAttention";
import { act, tick, spikeCompany, untilOffset } from "@/sim/__tests__/spikeFixtures";
import { newGame, newLegacyGame } from "@/sim";

const initial = spikeCompany(false);
const limited = act(initial, { type: "set_traffic_limit", enabled: true });
it.each([[0, "prepare"], [8, "spike1"], [28, "between"], [48, "spike2"], [68, "recover"]] as const)("reads stage %s from consumed engine events", (offset, stage) => {
  const game = offset ? untilOffset(limited, offset) : initial, before = structuredClone(game);
  expect(chapter4Stage(game)?.stage).toBe(stage);
  expect(chapter4Stage(game)?.cues[0].message.length).toBeLessThan(130);
  expect(game).toEqual(before);
});
it("offers Respond only when an observed pulse bottleneck exists", () => {
  expect(chapter4Stage(untilOffset(initial, 8))?.cues.map(c => c.title)).toEqual(["Spike 1", "Respond"]);
  expect(chapter4Stage(untilOffset(limited, 8))?.cues.map(c => c.title)).toEqual(["Spike 1"]);
});
it("leaves other chapters and modes outside the stage model", () => {
  expect(chapter4Stage(newGame())).toBeNull(); expect(chapter4Stage(newLegacyGame())).toBeNull();
  expect(chapter4Stage(act(untilOffset(limited, 72), { type: "acknowledge_spikes" }))).toBeNull();
});
it("transfers Prepare inspection to genuine scheduled Run without forcing an upgrade", () => {
  expect(campaignAttention(initial)).toMatchObject({ attention: "hint", target: "app" });
  expect(campaignAttention(act(initial, { type: "incident_inspect", equipment: "app" }))).toMatchObject({ attention: "run", target: "run" });
});
it("uses Network for a capped spike and Monitoring for a healthy uncapped spike", () => {
  const capped = untilOffset(limited, 8);
  expect(campaignAttention(capped)).toMatchObject({ attention: "hint", target: "network" });
  expect(campaignAttention(capped).message).toContain("rejects");
  const inspected = act(capped, { type: "incident_inspect", equipment: "gateway" });
  expect(campaignAttention(inspected)).toMatchObject({ attention: "run", reason: "spike-pulses" });
  let healthy = tick(act(initial, { type: "add_server" }), 2);
  healthy = tick(act(healthy, { type: "scale_up", appId: "app-3" }), 3);
  healthy = untilOffset(tick(act(healthy, { type: "set_routing", mode: "balanced", targets: ["app-1", "app-2", "app-3"] })), 8);
  expect(campaignAttention(healthy)).toMatchObject({ attention: "hint", target: "monitoring" });
});
it("prepares an unrouted small server before routing instead of returning to traffic limiting", () => {
  let game = act(untilOffset(initial, 8), { type: "add_server" });
  expect(campaignAttention(game)).toMatchObject({ attention: "run", reason: "activation-add-app" });
  game = tick(game, 2);
  expect(campaignAttention(game)).toMatchObject({ attention: "hint", reason: "unrouted", action: { action: { type: "scale_up", appId: "app-3" } } });
  expect(campaignAttention(game).message).not.toContain("is overloaded");
  game = act(game, { type: "scale_up", appId: "app-3" });
  expect(campaignAttention(game)).toMatchObject({ attention: "run", reason: "activation-scale-up" });
  game = tick(game, 3);
  expect(campaignAttention(game).action?.action.type).toBe("set_routing");
  game = tick(act(game, { type: "set_routing", mode: "balanced", targets: ["app-1", "app-2", "app-3"] }));
  expect(campaignAttention(game)).toMatchObject({ attention: "run", reason: "draining" });
});
it("uses the first pulse's observed weakness for optional preparation between pulses", () => {
  let game = untilOffset(initial, 10);
  game = act(game, { type: "set_traffic_limit", enabled: true });
  while (game.phase !== "review") game = tick(game);
  game = untilOffset(act(game, { type: "acknowledge_review" }), 28);
  expect(campaignAttention(game)).toMatchObject({ reason: "spike-plan", attention: "hint", action: { action: { type: "add_server" } } });
  const broke = structuredClone(game); broke.campaign!.cashCents = 100000;
  expect(campaignAttention(broke).action).toBeUndefined();
  game = tick(act(game, { type: "add_server" }), 2);
  expect(campaignAttention(game).action?.action).toEqual({ type: "scale_up", appId: "app-3" });
  game = tick(act(game, { type: "scale_up", appId: "app-3" }), 3);
  expect(campaignAttention(game).action?.action.type).toBe("set_routing");
  game = tick(act(game, { type: "set_routing", mode: "balanced", targets: ["app-1", "app-2", "app-3"] }));
  expect(campaignAttention(game).action).toBeUndefined();
});
it("keeps recovery verification and mandatory reviews ahead of stage inspections", () => {
  const baseline = untilOffset(limited, 68);
  expect(campaignAttention(baseline)).toMatchObject({ attention: "run", reason: "spike-stability" });
  expect(campaignAttention(baseline).message).toContain("1 of 5");
  expect(campaignAttention(tick(baseline, 4))).toMatchObject({ attention: null, reason: "review" });
});
