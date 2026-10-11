import { newGame, type GameState } from "@/sim";
import { advanceSteps, applyCampaignInput } from "@/sim/step";

/** A run with every kind of input: accepted, rejected, inspection and acknowledgement. */
export function playedRun(): GameState {
  let s = advanceSteps(newGame(4, "played"), 6).state;
  for (const action of [
    { type: "incident_inspect", equipment: "db" },
    { type: "start_db_upgrade" },
    { type: "add_server" },
    { type: "set_traffic_limit", enabled: false },
    { type: "incident_inspect", equipment: "standby" },
  ] as const) s = applyCampaignInput(advanceSteps(s, 1).state, action).state;
  s = advanceSteps(s, 30).state;
  s = applyCampaignInput(s, { type: "acknowledge_review" }).state;
  return advanceSteps(s, 70).state;
}

