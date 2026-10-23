import { newGame } from "@/sim";
import { advanceSteps } from "@/sim/step";
import { act, tick } from "@/sim/__tests__/spikeFixtures";

/** Proactive upgrade, real growth, both inspections and five new full-demand observations. */
export function preventedOpening() {
  let s = tick(act(newGame(0, "verified-opening-prevention"), { type: "start_db_upgrade" }), 4);
  s = act(act(s, { type: "incident_inspect", equipment: "app" }), { type: "incident_inspect", equipment: "db" });
  return tick(s, 5);
}

/** A Launch Week company whose week and research pick are done, so its score card awaits the player. */
export function finishedLaunchWeek(pick = true) {
  let s = act(advanceSteps(newGame(7, "finished-launch-week", 2), 20).state, { type: "start_db_upgrade" });
  for (let i = 0; i < 200 && s.campaign!.launchWeek!.completedStep === null; i++) {
    if (s.phase === "review") s = act(s, { type: "acknowledge_review" });
    else if (pick && s.campaign!.launchWeek!.researchEarned && !s.campaign!.launchWeek!.tech) s = act(s, { type: "pick_launch_tech", tech: "caching" });
    else s = tick(s);
  }
  if (s.campaign!.launchWeek!.completedStep === null) throw Error("Launch Week did not complete");
  return s;
}

export function recoveredOpening() {
  let s = act(tick(newGame(0, "verified-opening-recovery"), 6), { type: "start_db_upgrade" });
  for (let i = 0; i < 30 && s.phase !== "review"; i++) s = tick(s);
  if (s.phase !== "review") throw Error("Opening recovery did not verify");
  return s;
}
