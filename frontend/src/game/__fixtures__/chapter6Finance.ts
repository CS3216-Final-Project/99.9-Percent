import { newGame, type GameState } from "@/sim";
import { act, tick } from "@/sim/__tests__/spikeFixtures";
import { advanceSteps, canEnterData } from "@/sim/step";
import { canEnterSpikes } from "@/sim/autoscaling";
import { combinedCompany } from "@/sim/__tests__/combinedFixture";
import { operatingCharges } from "@/sim/settlement";

/** Public decisions only: keep the original equipment and rely on admission relief. */
export function cappedFinancialPredecessor() {
  let s = act(tick(newGame(0, "chapter6-financial-trap"), 11), { type: "set_traffic_limit", enabled: true });
  const until = (done: (s: GameState) => boolean) => {
    for (let i = 0; i < 200 && !done(s); i++) {
      if (s.phase === "review") s = act(s, { type: "acknowledge_review" });
      s = tick(s);
    }
    if (!done(s)) throw Error("Financial fixture failed to reach its actual stage");
  };
  until(s => s.phase === "review");
  s = act(act(s, { type: "acknowledge_review" }), { type: "acknowledge_milestone" });
  s = act(s, { type: "accept_scaling_risk" }); until(canEnterData);
  s = act(s, { type: "enter_data", profile: "read-heavy" }); until(canEnterSpikes);
  s = act(s, { type: "enter_spikes" }); until(s => s.campaign!.spikeStage!.completedStep !== null);
  s = act(act(s, { type: "acknowledge_spikes" }), { type: "enter_reliability" });
  s = act(s, { type: "arm_reliability" }); until(s => s.campaign!.reliabilityStage!.completedStep !== null);
  return act(s, { type: "acknowledge_reliability" });
}

export function financiallyTrappedCompany() {
  const predecessor = cappedFinancialPredecessor();
  const s = advanceSteps(predecessor, 660 - predecessor.campaign!.step).state;
  if (s.campaign!.cashCents !== 56000) throw Error(`Unexpected financial boundary: ${s.campaign!.cashCents}, step ${s.campaign!.step}`);
  return act(s, { type: "enter_combined" });
}

/** A small cash buffer with already paid-for capacity: removal is safe and free. */
export function recoverableFinancialCompany() {
  let s = tick(act(combinedCompany(), { type: "set_traffic_limit", enabled: true }));
  const periodCosts = Object.values(operatingCharges(s.campaign!)).reduce((sum, cost) => sum + cost, 0);
  for (let i = 0; i < 20 && s.campaign!.cashCents > periodCosts; i++)
    s = advanceSteps(s, 60-s.campaign!.step%60).state;
  if (s.phase !== "management" || s.campaign!.cashCents <= 0 || s.campaign!.cashCents > periodCosts) throw Error("Recoverable buffer fixture failed");
  return s;
}
