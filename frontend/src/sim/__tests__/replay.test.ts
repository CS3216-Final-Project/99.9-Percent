import { describe, it, expect } from "vitest";
import { applyAction, newGame, replayCampaign, MAX_REPLAY_INPUTS, type Action, type GameState } from "../index";
import { advanceSteps, applyCampaignInput } from "../step";

const MOVES: Action[] = [
  { type: "add_server" },
  { type: "start_db_upgrade" },
  { type: "set_traffic_limit", enabled: true },
  { type: "set_traffic_limit", enabled: false },
  { type: "incident_inspect", equipment: "db" },
  { type: "incident_inspect", equipment: "standby" },
  { type: "acknowledge_review" },
  { type: "launch_promotion", promo: "social" },
];

/** Play like a person would: bursts of steps between decisions, some of them invalid. */
function play(seed: number, decisions: number): GameState {
  let rng = seed;
  const next = (n: number) => { rng = (rng * 1103515245 + 12345) % 2 ** 31; return rng % n; };
  let s = newGame(seed, `run-${seed}`);
  for (let i = 0; i < decisions; i++) {
    s = advanceSteps(s, next(40)).state;
    s = applyCampaignInput(s, MOVES[next(MOVES.length)]).state;
  }
  return advanceSteps(s, next(40)).state;
}

const roundTrip = (s: GameState) => JSON.parse(JSON.stringify(s)) as GameState;

describe("campaign replay", () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])("rebuilds the exact state of seed %i from its inputs", seed => {
    const live = play(seed, 30);
    const c = live.campaign!;
    expect(c.inputs).toHaveLength(30);
    expect(roundTrip(replayCampaign(live.seed, c.runId, roundTrip(live).campaign!.inputs, c.step))).toEqual(roundTrip(live));
  });
  it("records an accepted decision through applyAction", () => {
    const s = advanceSteps(newGame(), 2).state;
    const ok = applyAction(s, { type: "add_server" });
    if (!ok.ok) throw Error(ok.message);
    expect(ok.state.campaign!.inputs).toEqual([{ step: 2, action: { type: "add_server" } }]);
  });
  it("records a rejected decision through applyCampaignInput", () => {
    const s = applyCampaignInput(advanceSteps(newGame(), 2).state, { type: "add_server" }).state;
    const { state, result } = applyCampaignInput(s, { type: "add_server" });
    expect(result.ok).toBe(false);
    expect(state.campaign!.inputs).toEqual([{ step: 2, action: { type: "add_server" } }, { step: 2, action: { type: "add_server" } }]);
    expect(state.campaign!.trace.at(-1)).toMatchObject({ type: "action-rejected", data: { action: "add_server" } });
  });
  it("advances many steps the same as one step at a time", () => {
    let one = newGame(3, "steps");
    for (let i = 0; i < 200; i++) one = advanceSteps(one, 1).state;
    // A batch stops at the first incident, so it resumes until it reaches the same step.
    let batch = newGame(3, "steps");
    while (batch.campaign!.step < 200) batch = advanceSteps(batch, 200 - batch.campaign!.step).state;
    expect(batch).toEqual(one);
  });
  it.each([
    ["an input after the final step", [{ step: 5, action: { type: "add_server" } }], 4],
    ["inputs out of order", [{ step: 3, action: { type: "add_server" } }, { step: 2, action: { type: "add_server" } }], 4],
    ["a step past an unacknowledged review", [{ step: 6, action: { type: "start_db_upgrade" } }], 100],
    ["a negative step", [], -1],
    ["an absurd step", [], 1e12],
    ["too many inputs", Array.from({ length: MAX_REPLAY_INPUTS + 1 }, () => ({ step: 0, action: { type: "add_server" } })), 0],
  ] as const)("refuses %s", (_, inputs, step) => {
    expect(() => replayCampaign(1, "r", inputs as never, step)).toThrow();
  });
});
