// @vitest-environment node
import { expect, it } from "vitest";
import { applyAction, newGame, type Action, type GameState } from "@/sim";
import { advanceSteps } from "@/sim/step";
import { INTRODUCTION_COMPONENTS } from "@/sim/introduction";
import { openingTrafficCue, startsOpeningTraffic } from "./openingTrafficCue";

const act = (g: GameState, a: Action) => { const r = applyAction(g, a); if (!r.ok) throw Error(r.message); return r.state; };
function opening() {
  let g = act(newGame(7, "traffic-cue", 2), { type: "begin_introduction" });
  for (const id of INTRODUCTION_COMPONENTS) g = act(act(g, { type: "incident_inspect", equipment: id }), { type: "acknowledge_introduction", equipment: id });
  return act(g, { type: "complete_introduction", handoff: "opening" });
}

it("announces the Opening's growth from the first second until the jump has been seen", () => {
  const start = opening();
  expect(openingTrafficCue(start.campaign)).toBeNull();
  const seen: { step: number; incoming: number; cue: string | null }[] = [];
  let g = start;
  for (let i = 0; i < 9; i++) {
    g = advanceSteps(g, 1).state;
    seen.push({ step: g.campaign!.step, incoming: g.campaign!.snapshot.incoming, cue: openingTrafficCue(g.campaign) });
  }
  // Rising while the starting demand lasts, risen once the In gate shows the growth, then gone.
  expect(seen.filter(x => x.cue === "rising").every(x => x.incoming === 300)).toBe(true);
  expect(seen.filter(x => x.cue === "risen").every(x => x.incoming === 800)).toBe(true);
  expect(seen.map(x => x.cue)).toEqual(["rising", "rising", "rising", "risen", "risen", "risen", "risen", null, null]);
});

it("starts only on the company's own first second, not on a load or another company", () => {
  const start = opening(), first = advanceSteps(start, 1).state, later = advanceSteps(first, 1).state;
  expect(startsOpeningTraffic(start.campaign, first.campaign)).toBe(true);
  expect(startsOpeningTraffic(first.campaign, later.campaign)).toBe(false);
  const other = advanceSteps(act(newGame(8, "another", 2), { type: "begin_introduction" }), 1).state;
  expect(startsOpeningTraffic(start.campaign, { ...first.campaign!, runId: other.campaign!.runId })).toBe(false);
});

it("leaves scripted Launch Week and historical companies with the guidance they had", () => {
  const launchWeek = advanceSteps(newGame(7, "scripted", 2), 2).state.campaign!;
  expect(launchWeek.launchWeek).toBeTruthy();
  expect(openingTrafficCue(launchWeek)).toBeNull();
  const historical = advanceSteps(newGame(7, "historical", 1), 2).state.campaign!;
  expect(historical.step).toBe(2);
  expect(openingTrafficCue(historical)).toBeNull();
});
