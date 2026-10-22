import { newGame } from "@/sim";
import { act, tick } from "@/sim/__tests__/spikeFixtures";

/** Proactive upgrade, real growth, both inspections and five new full-demand observations. */
export function preventedOpening() {
  let s = tick(act(newGame(0, "verified-opening-prevention"), { type: "start_db_upgrade" }), 4);
  s = act(act(s, { type: "incident_inspect", equipment: "app" }), { type: "incident_inspect", equipment: "db" });
  return tick(s, 5);
}

export function recoveredOpening() {
  let s = act(tick(newGame(0, "verified-opening-recovery"), 6), { type: "start_db_upgrade" });
  for (let i = 0; i < 30 && s.phase !== "review"; i++) s = tick(s);
  if (s.phase !== "review") throw Error("Opening recovery did not verify");
  return s;
}
