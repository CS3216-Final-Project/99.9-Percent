import { act, tick, reliabilityCompany, preparedReliability } from "@/sim/__tests__/reliabilityFixture";

/** A reliability outcome reached with a server still installing: one queued just before the last stable second. */
export function reliabilityOutcomeWithQueuedChange() {
  let s = act(reliabilityCompany(), { type: "arm_reliability" });
  for (let i = 0; i < 150 && s.campaign!.reliabilityStage!.completedStep === null; i++) {
    const d = s.campaign!.reliabilityStage!;
    if (s.phase === "review") s = act(s, { type: "acknowledge_review" });
    else if (d.fault?.restoredStep != null && d.stableSteps === 4 && !s.campaign!.pending.length) s = act(s, { type: "add_server" });
    s = tick(s);
  }
  if (s.campaign!.reliabilityStage!.completedStep === null || !s.campaign!.pending.length) throw Error("Reliability outcome did not complete with a queued change");
  return s;
}

export function reliabilityOutcome(manual = false, protectedCompany = false) {
  let s = protectedCompany ? preparedReliability() : reliabilityCompany();
  if (protectedCompany) s = tick(act(s, { type: "set_traffic_limit", enabled: true }));
  s = act(s, { type: "arm_reliability" });
  for (let i = 0; i < 150 && s.campaign!.reliabilityStage!.completedStep === null; i++) {
    const c = s.campaign!, f = c.reliabilityStage!.fault!;
    if (s.phase === "review") s = act(s, { type: "acknowledge_review" });
    else if (manual && f.startedStep !== null && f.restoredStep === null && !c.pending.some(a => a.type === "restore-app")) s = act(s, { type: "restore_app", appId: f.targetId });
    else if (protectedCompany && c.incident && c.limit === null && !c.pending.some(a => a.type === "limit")) s = act(s, { type: "set_traffic_limit", enabled: true });
    s = tick(s);
  }
  if (s.campaign!.reliabilityStage!.completedStep === null) throw Error("Reliability outcome did not complete");
  return s;
}

