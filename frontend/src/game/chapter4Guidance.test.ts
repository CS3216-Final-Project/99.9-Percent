import { expect, it } from "vitest";
import { chapter4Stage, chapter4Performance } from "./chapter4Guidance";
import { campaignAttention } from "./campaignAttention";
import { act, tick, preparedSpikes, spikeCompany, untilOffset } from "@/sim/__tests__/spikeFixtures";
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
  expect(chapter4Stage(act(untilOffset(preparedSpikes(), 72), { type: "acknowledge_spikes" }))).toBeNull();
});
it("transfers Prepare inspection to genuine scheduled Run without forcing an upgrade", () => {
  expect(campaignAttention(initial)).toMatchObject({ attention: "hint", target: "app" });
  expect(campaignAttention(act(initial, { type: "incident_inspect", equipment: "app" }))).toMatchObject({ attention: "run", target: "run" });
});
it("keeps a protective cap for an undersized spike and uses Monitoring for a healthy uncapped spike", () => {
  const capped = untilOffset(limited, 8);
  expect(campaignAttention(capped)).toMatchObject({ attention: "run", target: "run" });
  expect(campaignAttention(capped).message).toContain("rejects");
  const inspected = act(capped, { type: "incident_inspect", equipment: "gateway" });
  expect(campaignAttention(inspected)).toMatchObject({ attention: "run", reason: "spike-pulses" });
  let healthy = tick(act(initial, { type: "add_server" }), 2);
  healthy = tick(act(healthy, { type: "scale_up", appId: "app-3" }), 3);
  healthy = untilOffset(tick(act(healthy, { type: "set_routing", mode: "balanced", targets: ["app-1", "app-2", "app-3"] })), 8);
  expect(campaignAttention(healthy)).toMatchObject({ attention: "hint", target: "monitoring" });
});

it("targets actual limit removal only when routed capacity fits the announced peak, then recalculates after activation", () => {
  let game = tick(act(initial, { type: "add_server" }), 2);
  game = tick(act(game, { type: "scale_up", appId: "app-3" }), 3);
  game = tick(act(game, { type: "set_routing", mode: "balanced", targets: ["app-1", "app-2", "app-3"] }));
  game = untilOffset(tick(act(game, { type: "set_traffic_limit", enabled: true })), 8);
  const before = structuredClone(game);
  expect(game.campaign!.snapshot.incoming).toBeGreaterThan(game.campaign!.snapshot.admitted);
  const advice = campaignAttention(game);
  expect(advice).toMatchObject({ attention: "hint", target: "network", action: { action: { type: "set_traffic_limit", enabled: false } } });
  expect(game).toEqual(before);
  game = act(game, { type: "set_traffic_limit", enabled: false });
  expect(campaignAttention(game)).toMatchObject({ attention: "run", reason: "activation-unlimit" });
  expect(campaignAttention(game).action).toBeUndefined();
  game = act(tick(game), { type: "incident_inspect", equipment: "monitoring" });
  expect(game.campaign!.limit).toBeNull();
  expect(campaignAttention(game)).toMatchObject({ attention: "run", reason: "spike-pulses" });
  expect(campaignAttention(game).action).toBeUndefined();

  const dbLimited = structuredClone(before); dbLimited.campaign!.dbCapacity = 100;
  expect(campaignAttention(dbLimited).action?.action).not.toEqual({ type: "set_traffic_limit", enabled: false });
});

it("does not remove protection in the quiet interval when capacity cannot serve the next announced spike", () => {
  const game = untilOffset(limited, 28);
  expect(game.campaign!.snapshot.app.capacity).toBeGreaterThan(game.campaign!.snapshot.incoming);
  expect(campaignAttention(game)).toMatchObject({ attention: "hint", target: "app", action: { action: { type: "add_server" } } });
  expect(campaignAttention(game).message).toContain("Changes are optional");
  expect(campaignAttention(game).action?.action).not.toEqual({ type: "set_traffic_limit", enabled: false });
});

it("offers enabling the existing limit only for actual uncapped pressure when paid responses are unavailable", () => {
  const game = untilOffset(initial, 8); game.campaign!.cashCents = 1;
  expect(campaignAttention(game)).toMatchObject({ action: { action: { type: "set_traffic_limit", enabled: true } } });
  const accepted = act(game, { type: "set_traffic_limit", enabled: true });
  expect(campaignAttention(accepted)).toMatchObject({ attention: "run", reason: "activation-limit" });
  expect(campaignAttention(tick(accepted)).action?.action).not.toEqual({ type: "set_traffic_limit", enabled: true });
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
  expect(campaignAttention(game).action?.action).toEqual({ type: "set_traffic_limit", enabled: false });
});
it("keeps recovery verification and mandatory reviews ahead of stage inspections", () => {
  const baseline = untilOffset(limited, 68);
  expect(campaignAttention(baseline)).toMatchObject({ attention: "run", reason: "spike-stability" });
  expect(campaignAttention(baseline).message).toContain("1 of 5");
  expect(campaignAttention(tick(baseline, 4))).toMatchObject({ attention: null, reason: "review" });
});

it("explains served/rejected trade-offs from deduplicated observations and honours a decision to keep the strategy", () => {
  const game = untilOffset(limited, 28), performance = chapter4Performance(game)!;
  expect(performance.served).toBeGreaterThan(0); expect(performance.rejected).toBeGreaterThan(performance.served);
  expect(performance.incidents).toBe(0);
  expect(campaignAttention(game).message).toContain(performance.summary);
  const poor = structuredClone(game); poor.campaign!.cashCents = 1;
  expect(campaignAttention(poor)).toMatchObject({ attention: "hint", target: "monitoring" });
  const evaluated = act(poor, { type: "incident_inspect", equipment: "monitoring" });
  expect(campaignAttention(evaluated)).toMatchObject({ attention: "run", target: "run" });
  expect(campaignAttention(evaluated).message).toContain("Keep your strategy");
  expect(tick(evaluated).campaign!.limit).toBe(500);
  const duplicated = structuredClone(game); duplicated.campaign!.reports[0].snapshots.push(...game.campaign!.recent);
  expect(chapter4Performance(duplicated)?.served).toBe(performance.served);
  expect(chapter4Performance(duplicated)?.rejected).toBe(performance.rejected);
});

it("does not treat an enabled autoscaler as proof that rejected demand is being served", () => {
  const game = untilOffset(act(spikeCompany(true), { type: "set_traffic_limit", enabled: true }), 28);
  expect(game.campaign!.spikeStage!.controller?.enabled).toBe(true);
  const advice = campaignAttention(game);
  expect(advice.attention).toBe("hint");
  expect(advice.message).toContain("rejected");
  expect(advice.action?.action.type).toMatch(/add_server|scale_up|set_routing/);
  expect(advice.message).toContain("optional");
});
