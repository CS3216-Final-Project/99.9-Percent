// @vitest-environment node
import { expect, it } from "vitest";
import { applyAction, newGame } from "../index";
import { advanceSteps, canEnterData } from "../step";
import { launchAct, launchCompany, preparedLaunchCompany } from "./scalingLaunchFixture";
import { makeEnvelope, validateEnvelope } from "@/game/saveEnvelope";

it("lets a prepared company keep earning at baseline until its explicit launch", () => {
  const original = preparedLaunchCompany(), before = structuredClone(original);
  const waiting = advanceSteps(original, 120).state;
  expect(original).toEqual(before);
  expect(waiting.campaign!.incomingRate).toBe(800);
  expect(waiting.campaign!.scaling!.dueStep).toBeNull();
  expect(waiting.campaign!.settlements.length).toBeGreaterThan(0);
  expect(waiting.campaign!.revenueCents).toBeGreaterThan(0);
  expect(canEnterData(waiting)).toBe(false);
  const launched = launchAct(waiting, { type: "launch_scaling" });
  expect(launched.campaign!.cashCents).toBe(waiting.campaign!.cashCents);
  expect(launched.campaign!.step).toBe(waiting.campaign!.step);
  expect(advanceSteps(launched, 2).state.campaign!.incomingRate).toBe(800);
  const grown = advanceSteps(launched, 3).state;
  expect(grown.campaign!.incomingRate).toBe(1400);
  expect(grown.campaign!.snapshot.successful).toBe(1400);
  expect(grown.campaign!.incident).toBeNull();
  expect(canEnterData(grown)).toBe(true);
  expect(applyAction(grown, { type: "launch_scaling" }).ok).toBe(false);
});

it("accepts an underprepared launch and models the resulting overload without granting capacity", () => {
  const before = launchCompany(), launched = launchAct(before, { type: "launch_scaling" });
  const unchanged = structuredClone(launched);
  const duplicate = applyAction(launched, { type: "launch_scaling" });
  expect(duplicate.ok).toBe(false);
  expect(launched).toEqual(unchanged);
  const grown = advanceSteps(launched, 5).state;
  expect(grown.campaign!.incident?.primaryComponent).toBe("app-1");
  expect(grown.campaign!.dbCapacity).toBe(1000);
  expect(grown.campaign!.apps[0].capacity).toBe(1000);
  expect(grown.campaign!.snapshot.app.backlog).toBeGreaterThan(0);
  expect(applyAction(grown, { type: "launch_scaling" }).ok).toBe(false);
});

it("keeps a launch deadline through a paused save and deterministic continuation", () => {
  let game = launchAct(preparedLaunchCompany(), { type: "launch_scaling" });
  game = advanceSteps(game, 1).state;
  const loaded = validateEnvelope(JSON.parse(JSON.stringify(makeEnvelope(game))));
  expect(loaded.status).toBe("ok");
  if (loaded.status !== "ok") throw Error("Expected a replayable save");
  expect(loaded.game.campaign!.scaling).toEqual(game.campaign!.scaling);
  expect(advanceSteps(loaded.game, 2).state.campaign).toEqual(advanceSteps(game, 2).state.campaign);
});

it("preserves recorded automatic growth and rejects a launch before Scaling", () => {
  expect(applyAction(newGame(), { type: "launch_scaling" }).ok).toBe(false);
  let game = launchCompany(1);
  expect(applyAction(game, { type: "launch_scaling" }).ok).toBe(false);
  game = advanceSteps(launchAct(game, { type: "start_db_upgrade" }), 6).state;
  expect(game.campaign!.incomingRate).toBe(1400);
  const loaded = validateEnvelope(makeEnvelope(game));
  expect(loaded.status).toBe("ok");
  if (loaded.status === "ok") expect(loaded.game.campaign!.scaling!.version).toBe(1);
});

it("commits growth even while a purchased upgrade is still installing", () => {
  let game = launchAct(launchCompany(), { type: "start_db_upgrade" });
  game = launchAct(game, { type: "launch_scaling" });
  expect(game.campaign!.pending).toHaveLength(1);
  const grown = advanceSteps(game, 3).state;
  expect(grown.campaign!.dbCapacity).toBe(2000);
  expect(grown.campaign!.incomingRate).toBe(1400);
});
