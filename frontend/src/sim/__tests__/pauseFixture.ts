import { newGame, type GameState } from "../index";
import { act, tick, spikeCompany } from "./spikeFixtures";
import { dataCompany } from "./dataFixture";
import { reliabilityCompany } from "./reliabilityFixture";
import { checkedCombined, sequence } from "./combinedFixture";

export function nextIncident(g: GameState) {
  for (let i = 0; i < 150; i++) {
    const next = tick(g);
    if (next.campaign!.incident && next.campaign!.incident.id !== g.campaign!.incident?.id) return { before: g, incident: next };
    if (next.phase === "review" || next.phase === "ended" || next.campaign!.step === g.campaign!.step) throw Error("Fixture stopped before its new incident");
    g = next;
  }
  throw Error("Fixture did not open an incident");
}
/** Real engine inputs create later incidents: the original first-incident stop remains consumed.
 * Chapter 1 is an engine/live-host boundary only: normal play() resumes an acknowledged Opening into Scaling.
 */
export function pauseTransition(chapter: number, runId?: string) {
  let g: GameState;
  if (chapter === 1) {
    g = act(tick(newGame(1, runId ?? "pause-opening"), 6), { type: "set_traffic_limit", enabled: true });
    for (let i = 0; i < 100 && g.phase !== "review"; i++) g = tick(g);
    g = act(act(g, { type: "acknowledge_review" }), { type: "acknowledge_milestone", enterScaling: false });
    g = act(g, { type: "set_traffic_limit", enabled: false });
  } else if (chapter === 2) {
    g = act(tick(newGame(1, "pause-scaling"), 6), { type: "start_db_upgrade" });
    for (let i = 0; i < 100 && g.phase !== "review"; i++) g = tick(g);
    g = act(act(act(g, { type: "acknowledge_review" }), { type: "acknowledge_milestone" }), { type: "accept_scaling_risk" });
  } else if (chapter === 3) g = dataCompany();
  else if (chapter === 4) g = spikeCompany(false);
  else if (chapter === 5) g = act(reliabilityCompany(), { type: "arm_reliability" });
  // Health Checks alone leave two apps to carry the failure-under-load wave, which overloads them.
  else g = act(tick(checkedCombined([sequence[2], sequence[0], sequence[1]]), 5), { type: "start_growth_wave" });
  return nextIncident(g);
}
