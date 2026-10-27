import { act, tick, reliabilityCompany, preparedReliability, checkedReliability } from "@/sim/__tests__/reliabilityFixture";
import { pendingRetry } from "@/sim/errorBudget";
import type { GameState } from "@/sim/types";

/** A reliability outcome reached with a server still installing: one queued just before the last stable second. */
export function reliabilityOutcomeWithQueuedChange() {
  let s = act(checkedReliability(), { type: "arm_reliability" });
  for (let i = 0; i < 150 && s.campaign!.reliabilityStage!.completedStep === null; i++) {
    const d = s.campaign!.reliabilityStage!;
    if (s.phase === "review") s = act(s, { type: "acknowledge_review" });
    else if (d.fault?.restoredStep != null && d.stableSteps === 4 && !s.campaign!.pending.length) s = act(s, { type: "add_server" });
    s = tick(s);
  }
  if (s.campaign!.reliabilityStage!.completedStep === null || !s.campaign!.pending.length) throw Error("Reliability outcome did not complete with a queued change");
  return s;
}

/** Run the Stay Online test to its end: the outcome review, or the retry an unprepared company's error budget forces. */
function runTest(s: GameState, manual: boolean, protectedCompany: boolean) {
  s = act(s, { type: "arm_reliability" });
  for (let i = 0; i < 150 && s.campaign!.reliabilityStage!.completedStep === null && !pendingRetry(s.campaign); i++) {
    const c = s.campaign!, f = c.reliabilityStage!.fault!;
    if (s.phase === "review") s = act(s, { type: "acknowledge_review" });
    else if (manual && f.startedStep !== null && f.restoredStep === null && !c.pending.some(a => a.type === "restore-app")) s = act(s, { type: "restore_app", appId: f.targetId });
    else if (protectedCompany && c.incident && c.limit === null && !c.pending.some(a => a.type === "limit")) s = act(s, { type: "set_traffic_limit", enabled: true });
    s = tick(s);
  }
  if (s.campaign!.reliabilityStage!.completedStep === null && !pendingRetry(s.campaign)) throw Error("Reliability test did not end");
  return s;
}

/** The recorded evidence of a Stay Online test. Without Health Checks it ends over its error budget, awaiting a retry. */
export function reliabilityOutcome(manual = false, protectedCompany = false) {
  let s = protectedCompany ? preparedReliability() : reliabilityCompany();
  if (protectedCompany) s = tick(act(s, { type: "set_traffic_limit", enabled: true }));
  return runTest(s, manual, protectedCompany);
}

/** A completed Stay Online outcome awaiting acknowledgement: Health Checks keep the test within its error budget. */
export function completedReliabilityOutcome(manual = false) {
  const s = runTest(checkedReliability(), manual, false);
  if (s.campaign!.reliabilityStage!.completedStep === null) throw Error("Reliability outcome did not complete");
  return s;
}
