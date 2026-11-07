import { expect, it } from "vitest";
import { changeFeedback } from "./changeFeedback";
import { advanceSteps } from "@/sim/step";
import { launchAct, launchCompany } from "@/sim/__tests__/scalingLaunchFixture";
import { dataCompany } from "@/sim/__tests__/dataFixture";

it("explains an installed server without claiming it serves traffic or fixes the database", () => {
  let game = launchAct(launchCompany(), { type: "add_server" });
  expect(changeFeedback(game.campaign!)?.title).toBe("Database upgrade");
  game = advanceSteps(game, 2).state;
  const feedback = changeFeedback(game.campaign!)!;
  expect(feedback.note).toContain("needs a routing change");
  expect(feedback.after!.instances!.find(a => a.id === "app-2")!.demand).toBe(0);
  expect(feedback.before!.step + 1).toBe(feedback.after!.step);
  expect(feedback.after!.successful).toBe(feedback.before!.successful);
});

it("retains database overload after an ineffective application purchase", () => {
  const growth = advanceSteps(launchAct(launchCompany(), { type: "launch_scaling" }), 5).state;
  const game = advanceSteps(launchAct(growth, { type: "scale_up", appId: "app-1" }), 3).state;
  expect(changeFeedback(game.campaign!)!.warning).toContain("Database demand still exceeds");
});

it("shows a cold cache warming using measured hits, never its future target", () => {
  let game = advanceSteps(launchAct(advanceSteps(dataCompany(), 3).state, { type: "deploy_cache" }), 2).state;
  expect(changeFeedback(game.campaign!)!.cache!.hits).toBe(0);
  game = advanceSteps(game, 1).state;
  expect(changeFeedback(game.campaign!)!.cache!.hits).toBeGreaterThan(0);
  expect(changeFeedback(game.campaign!)!.cache!.effectiveHitRateUsed).toBeLessThan(changeFeedback(game.campaign!)!.cache!.target);
});
