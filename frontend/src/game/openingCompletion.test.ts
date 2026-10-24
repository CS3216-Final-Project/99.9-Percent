import { beforeEach, expect, it } from "vitest";
import { applyAction, newGame, newLegacyGame, type GameState } from "@/sim";
import { act, tick } from "@/sim/__tests__/spikeFixtures";
import { verifiedPrevention } from "@/sim/openingPrevention";
import { enterScaling, canEnterData, step } from "@/sim/step";
import { campaignGuidance, campaignObjective, launchResearchPending } from "./campaignGuidance";
import { preventedOpening, recoveredOpening } from "./__fixtures__/openingOutcome";
import { decodeSave, makeEnvelope } from "./saveEnvelope";
import { outcomeSummary } from "./campaignReport";
import { campaignChapters } from "./campaignChapters";
import { chapterAdvance } from "./chapterCompletion";
import { campaignClockAvailable, useGame } from "./store";
import { campaignAttention } from "./campaignAttention";

beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); });

it("requires both prevention and recognition acknowledgements before Chapter 2", () => {
  const qualified = preventedOpening(), before = JSON.stringify(qualified);
  expect(verifiedPrevention(qualified.campaign!)).toBe(false);
  expect(campaignAttention(qualified)).toMatchObject({reason:"review",attention:null});
  expect(applyAction(qualified, { type: "enter_scaling" }).ok).toBe(false);
  const acknowledged = act(qualified, { type: "acknowledge_prevention_review" });
  expect(JSON.stringify(qualified)).toBe(before);
  expect(verifiedPrevention(acknowledged.campaign!)).toBe(true);
  expect(campaignAttention(acknowledged)).toMatchObject({reason:"review",attention:null});
  expect(enterScaling(acknowledged)).toBe(acknowledged);
  expect(applyAction(acknowledged, { type: "enter_scaling" }).ok).toBe(false);
  expect(outcomeSummary(acknowledged.campaign!, "opening").happened).toBe("You spotted the bottleneck early and prevented an outage.");
  const recognised = act(acknowledged, { type: "acknowledge_milestone", enterScaling: false });
  expect(campaignAttention(recognised)).toMatchObject({reason:"next",attention:"progression",target:"next"});
  expect(chapterAdvance(recognised)?.action).toEqual({ type: "enter_scaling" });
  const entered = act(recognised, { type: "enter_scaling" });
  expect(entered.campaign!.scaling).toBeTruthy();
  expect(entered.campaign!.reports).toEqual([]); expect(entered.campaign!.openingRecovered).toBe(false);
  expect(entered.campaign!.cashCents).toBe(qualified.campaign!.cashCents);
  expect(entered.campaign!.step).toBe(qualified.campaign!.step);
  expect(campaignChapters(entered).find(c => c.id === "opening")!.completed).toBe(true);
  expect(applyAction(entered, { type: "acknowledge_milestone" }).ok).toBe(false);
});

it("preserves the actual incident, postmortem and recovery recognition path", () => {
  const recovered = recoveredOpening(), report = recovered.campaign!.reports[0];
  expect(applyAction(recovered, { type: "acknowledge_prevention_review" }).ok).toBe(false);
  const reviewed = act(recovered, { type: "acknowledge_review" });
  expect(reviewed.campaign!.openingMilestone!.incidentId).toBe(report.id);
  expect(outcomeSummary(reviewed.campaign!, "opening").happened).toBe("You diagnosed an outage and restored your service.");
  expect(act(reviewed, { type: "acknowledge_milestone" }).campaign!.scaling).toBeTruthy();
});

it("continues and replays Chapter 2 from prevention without a recovered-incident flag", () => {
  let s = act(act(preventedOpening(), {type:"acknowledge_prevention_review"}), {type:"acknowledge_milestone"});
  s = tick(act(s, {type:"scale_up",appId:"app-1"}), 3);
  s = tick(act(s, {type:"start_db_upgrade"}), 12);
  expect(s.campaign!.scaling!.consumed).toBe(true); expect(canEnterData(s)).toBe(true);
  expect(s.campaign!.reports).toEqual([]); expect(s.campaign!.openingRecovered).toBe(false);
  const loaded = decodeSave(JSON.stringify(makeEnvelope(s))); if (loaded.status !== "ok") throw Error(loaded.status);
  expect(loaded.game).toEqual(s);
});

it.each(["observation", "inspection", "qualification", "acknowledgement"])("rejects fabricated/incomplete prevention %s evidence", missing => {
  const s = act(preventedOpening(), { type: "acknowledge_prevention_review" }), c = s.campaign!;
  if (missing === "observation") c.openingPrevention!.outcome!.snapshots.pop();
  if (missing === "inspection") c.openingPrevention!.appInspectedStep = null;
  if (missing === "qualification") c.trace = c.trace.filter(t => t.type !== "opening-prevention-qualified");
  if (missing === "acknowledgement") c.trace = c.trace.filter(t => t.type !== "opening-prevention-review-acknowledged");
  expect(verifiedPrevention(c)).toBe(false);
  expect(applyAction(s, { type: "acknowledge_milestone" }).ok).toBe(false);
  c.openingMilestone!.acknowledged = true;
  expect(enterScaling(s)).toBe(s);
  expect(applyAction(s, { type: "enter_scaling" }).ok).toBe(false);
});

it("repairs an old acknowledged prevention log after later actions/time, without changing its history or schema", () => {
  const qualified = preventedOpening(), envelope = makeEnvelope(qualified);
  const old = { ...envelope, step: 20, inputs: [...envelope.inputs,
    { step: 9, action: { type: "acknowledge_prevention_review" as const } },
    { step: 13, action: { type: "add_server" as const } },
    { step: 20, action: { type: "incident_inspect" as const, equipment: "app" as const } }] };
  const loaded = decodeSave(JSON.stringify(old)); if (loaded.status !== "ok") throw Error(loaded.status);
  const c = loaded.game.campaign!;
  expect(c.step).toBe(20); expect(c.apps).toHaveLength(2); expect(c.inputs).toEqual(old.inputs);
  expect(c.openingMilestone).toMatchObject({ outcomeId: "opening-prevention", awardedStep: 20, acknowledged: false });
  expect(c.reports).toEqual([]); expect(c.openingRecovered).toBe(false); expect(c.scaling).toBeNull();
  expect(outcomeSummary(c,"opening").response).not.toContain("an added server");
  const resaved = makeEnvelope(loaded.game);
  expect(resaved.schemaVersion).toBe(envelope.schemaVersion);
  const twice = decodeSave(JSON.stringify(resaved)); if (twice.status !== "ok") throw Error(twice.status);
  expect(twice.game).toEqual(loaded.game);
  const entered = act(twice.game, { type: "acknowledge_milestone" });
  const again = decodeSave(JSON.stringify(makeEnvelope(entered))); if (again.status !== "ok") throw Error(again.status);
  expect(again.game).toEqual(entered);
});

/** A Launch Week company whose database incident was fixed by the upgrade and its postmortem acknowledged. */
function launchRecovered() {
  const until = (s: GameState, cond: (s: GameState) => boolean) => {
    for (let i = 0; i < 200 && !cond(s); i++) s = s.phase === "review" ? act(s, { type: "acknowledge_review" }) : step(s).state;
    return s;
  };
  let s = until(newGame(7, "lw-gates", 2), x => !!x.campaign!.incident);
  s = until(act(s, { type: "start_db_upgrade" }), x => x.phase === "review");
  return { s: act(s, { type: "acknowledge_review" }), until };
}

it("offers Complete Opening only once Launch Week is over and its research pick is spent", () => {
  const { s: midWeek, until } = launchRecovered();
  // The milestone is recorded mid-week, but the week is not survived yet.
  expect(midWeek.campaign!.openingMilestone?.acknowledged).toBe(false);
  expect(midWeek.campaign!.launchWeek!.completedStep).toBeNull();
  expect(campaignGuidance(midWeek).pendingAction).toBeNull();
  const over = until(midWeek, x => x.campaign!.launchWeek!.completedStep !== null);
  expect(over.campaign!.launchWeek).toMatchObject({ researchEarned: 1, tech: null });
  expect(launchResearchPending(over)).toBe(true);
  expect(campaignGuidance(over)).toMatchObject({ pendingAction: null, waiting: expect.stringContaining("research pick") });
  expect(campaignObjective(over)).toBe("Spend your free research pick to see your Launch Week score.");
  expect(campaignAttention(over)).toMatchObject({ reason: "launch-research", target: "research" });
  const picked = act(over, { type: "pick_launch_tech", tech: "autoscaling" });
  expect(launchResearchPending(picked)).toBe(false);
  expect(campaignGuidance(picked).pendingAction?.label).toBe("Complete Opening");
  expect(campaignObjective(picked)).toBe("Review your Launch Week score, then stay or continue to Scaling & Routing.");
});

it("lets the store spend Launch Week research while the milestone waits, and nothing else", () => {
  const { s, until } = launchRecovered();
  const over = until(s, x => x.campaign!.launchWeek!.completedStep !== null);
  useGame.setState({ game: over, started: true, hasRun: true });
  expect(useGame.getState().act({ type: "add_server" })).toBe(false);
  expect(useGame.getState().act({ type: "set_traffic_limit", enabled: true })).toBe(false);
  expect(useGame.getState().game).toBe(over);
  expect(useGame.getState().act({ type: "pick_launch_tech", tech: "caching" })).toBe(true);
  expect(useGame.getState().game.campaign!.launchWeek!.tech).toBe("caching");
  // With the pick spent the milestone is the only accepted action again, and it continues into Chapter 2.
  expect(useGame.getState().act({ type: "pick_launch_tech", tech: "autoscaling" })).toBe(false);
  expect(useGame.getState().act({ type: "add_server" })).toBe(false);
  expect(useGame.getState().act({ type: "acknowledge_milestone", enterScaling: true })).toBe(true);
  expect(useGame.getState().game.campaign).toMatchObject({ openingMilestone: { acknowledged: true }, scaling: expect.anything() });
});

/** A Launch Week company that upgrades its database at game second `upgradeStep` (or never), stepped to the week's end. */
function launchWeekEnd(upgradeStep: number | null) {
  let s = newGame(7, "lw-late", 2);
  for (let i = 0; i < 200 && s.campaign!.launchWeek!.completedStep === null && s.phase !== "review"; i++) {
    if (s.campaign!.step === upgradeStep) s = act(s, { type: "start_db_upgrade" });
    s = step(s).state;
  }
  return s;
}
const store = () => useGame.getState();

it("lets a company whose Launch Week ends mid-incident recover, review and then complete the Opening", () => {
  const over = launchWeekEnd(null);
  expect(over).toMatchObject({ phase: "incident", campaign: { step: 60, launchWeek: { completedStep: 60, tech: null }, openingMilestone: { acknowledged: false } } });
  expect(applyAction(over, { type: "acknowledge_milestone" }).ok).toBe(false);
  useGame.setState({ game: over, started: true, hasRun: true });
  // The incident comes first: the milestone cannot be acknowledged yet, so it holds neither the clock nor the response.
  expect(campaignClockAvailable(store())).toBe(true);
  expect(campaignGuidance(over).pendingAction).toBeNull();
  expect(campaignObjective(over)).toBe("Restore stable service while weighing cost and rejected demand.");
  expect(campaignAttention(over).reason).not.toMatch(/^launch-(research|score)$/);
  expect(store().act({ type: "acknowledge_milestone" })).toBe(false);
  expect(store().act({ type: "start_db_upgrade" })).toBe(true);
  let s = store().game;
  for (let i = 0; i < 60 && s.phase !== "review"; i++) s = step(s).state;
  expect(s.phase).toBe("review");
  useGame.setState({ game: s });
  expect(campaignAttention(s).reason).toBe("review");
  expect(store().act({ type: "acknowledge_review" })).toBe(true);
  expect(launchResearchPending(store().game)).toBe(true);
  expect(campaignClockAvailable(store())).toBe(false);
  expect(store().act({ type: "pick_launch_tech", tech: "caching" })).toBe(true);
  expect(store().act({ type: "acknowledge_milestone", enterScaling: true })).toBe(true);
  expect(store().game.campaign!.scaling).toBeTruthy();
});

it("lets the postmortem that lands on Launch Week's last second be acknowledged before the score", () => {
  const over = launchWeekEnd(53);
  expect(over).toMatchObject({ phase: "review", campaign: { step: 60, launchWeek: { completedStep: 60 }, incident: null } });
  useGame.setState({ game: over, started: true, hasRun: true });
  expect(campaignAttention(over)).toMatchObject({ reason: "review", attention: null });
  expect(campaignGuidance(over).pendingAction?.label).toBe("Review postmortem");
  expect(launchResearchPending(over)).toBe(false);
  expect(store().act({ type: "pick_launch_tech", tech: "caching" })).toBe(false);
  expect(store().act({ type: "acknowledge_review" })).toBe(true);
  expect(campaignAttention(store().game).reason).toBe("launch-research");
  expect(store().act({ type: "pick_launch_tech", tech: "autoscaling" })).toBe(true);
  expect(campaignGuidance(store().game).pendingAction?.label).toBe("Complete Opening");
});

it("leaves Classic progression independent of Campaign prevention", () => {
  const classic = newLegacyGame(0);
  expect(classic.campaign).toBeUndefined();
  const rejected = applyAction(classic, { type: "acknowledge_prevention_review" });
  expect(rejected.ok).toBe(false);
  expect(classic.campaign).toBeUndefined();
});

