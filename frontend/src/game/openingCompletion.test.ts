import { beforeEach, expect, it } from "vitest";
import { applyAction, newLegacyGame } from "@/sim";
import { act, tick } from "@/sim/__tests__/spikeFixtures";
import { verifiedPrevention } from "@/sim/openingPrevention";
import { enterScaling, canEnterData } from "@/sim/step";
import { preventedOpening, recoveredOpening } from "./__fixtures__/openingOutcome";
import { decodeSave, makeEnvelope } from "./saveEnvelope";
import { outcomeSummary } from "./campaignReport";
import { chapterAdvance, campaignChapters } from "./campaignChapters";
import { useGame, walkthroughHoldsClock } from "./store";
import { DEFAULT_META, saveMeta } from "./persist";
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

it("leaves Classic progression independent of Campaign prevention", () => {
  const classic = newLegacyGame(0);
  expect(classic.campaign).toBeUndefined();
  const rejected = applyAction(classic, { type: "acknowledge_prevention_review" });
  expect(rejected.ok).toBe(false);
  expect(classic.campaign).toBeUndefined();
});

it("keeps Chapter 0 clock hold and practice-company isolation", () => {
  saveMeta({ ...DEFAULT_META, tutorialDone: true });
  useGame.getState().boot();
  const original = act(preventedOpening(), { type: "acknowledge_prevention_review" });
  useGame.setState({ game: original, ready: true, started: true, onboarding: false });
  useGame.getState().startTour("campaign");
  expect(useGame.getState().tutorialCompany?.game).toEqual(original);
  expect(walkthroughHoldsClock(useGame.getState())).toBe(true);
  useGame.getState().setRunning(true); useGame.getState().tick(100);
  expect(useGame.getState().game.campaign!.step).toBe(0);
  expect(useGame.getState().game.campaign!.openingMilestone).toBeNull();
  useGame.getState().endTour(false);
  expect(useGame.getState().game).toEqual(original);
  expect(useGame.getState().game.campaign!.scaling).toBeNull();
});
