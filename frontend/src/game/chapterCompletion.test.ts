// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { applyAction, type Action, type GameState } from "@/sim";
import { pendingSpikeAcknowledgement } from "@/sim/autoscaling";
import { act, dataCompany, preparedSpikes, tick } from "@/sim/__tests__/spikeFixtures";
import { finishingScaling } from "@/sim/__tests__/dataFixture";
import { step } from "@/sim/step";
import { finishedLaunchWeek, recoveredOpening } from "./__fixtures__/openingOutcome";
import { completedReliabilityOutcome as reliabilityOutcome, reliabilityOutcomeWithQueuedChange } from "./__fixtures__/reliabilityOutcome";
import { chapterAdvance, chapterEnd } from "./chapterCompletion";
import { PHONE_SCOPE } from "./scope";

// Several cases play a company through four chapters.
vi.setConfig({ testTimeout: 20_000 });

const apply = (g: GameState, actions: Action[]) => actions.reduce(act, g);
function spikeRecognition() {
  let g = preparedSpikes();
  for (let i = 0; i < 300 && !pendingSpikeAcknowledgement(g.campaign!); i++) g = g.phase === "review" ? act(g, { type: "acknowledge_review" }) : tick(g);
  expect(pendingSpikeAcknowledgement(g.campaign!)).toBe(true);
  return g;
}

describe("the end of each chapter", () => {
  it("offers Launch Week's company Stay or Continue into Scaling & Routing, once its research is picked", () => {
    expect(chapterEnd(finishedLaunchWeek(false))).toBeNull();
    const g = finishedLaunchWeek();
    const end = chapterEnd(g)!;
    expect(end).toMatchObject({ chapter: "opening", label: "Continue to Scaling & Routing", blockers: [], next: { name: "Scaling & Routing" } });
    const stayed = apply(g, end.stay);
    expect(stayed.campaign!.openingMilestone!.acknowledged).toBe(true);
    expect(stayed.campaign!.scaling).toBeNull();
    expect(chapterEnd(stayed)).toBeNull();
    expect(chapterAdvance(stayed)).toMatchObject({ action: { type: "enter_scaling" }, ready: true });
    expect(apply(g, end.proceed!).campaign!.scaling).toBeTruthy();
  });

  it("offers a version-1 Opening the same choice after its postmortem", () => {
    const g = act(recoveredOpening(), { type: "acknowledge_review" });
    const end = chapterEnd(g)!;
    expect(end.chapter).toBe("opening");
    expect(apply(g, end.proceed!).campaign!.scaling).toBeTruthy();
    expect(apply(g, end.stay).campaign!.scaling).toBeNull();
  });

  it("continues Scaling & Routing and Data Strategy with their entry actions and nothing to acknowledge", () => {
    expect(chapterEnd(finishingScaling())).toBeNull();
    const scaling = step(finishingScaling()).state;
    expect(chapterEnd(scaling)).toMatchObject({ chapter: "scaling", stay: [], proceed: [{ type: "enter_data" }], label: "Continue to Data Strategy", next: { name: "Data Strategy" } });
    expect(chapterEnd(dataCompany())).toMatchObject({ chapter: "data", stay: [], proceed: [{ type: "enter_spikes" }], label: "Continue to Traffic Spikes" });
  });

  it("acknowledges the spike response either way, and Continue also enters Stay Online", () => {
    const g = spikeRecognition();
    const end = chapterEnd(g)!;
    expect(end).toMatchObject({ chapter: "spikes", label: "Continue to Stay Online", blockers: [], next: { name: "Stay Online" } });
    const entered = apply(g, end.proceed!);
    expect(entered.campaign!.spikeStage!.acknowledged).toBe(true);
    expect(entered.campaign!.reliabilityStage).toBeTruthy();
    const stayed = apply(g, end.stay);
    expect(stayed.campaign!.reliabilityStage).toBeFalsy();
    expect(chapterEnd(stayed)).toBeNull();
    expect(chapterAdvance(stayed)).toMatchObject({ label: "Continue to Stay Online", action: { type: "enter_reliability" }, ready: true, blockers: [] });
  });

  it("does not change the company while it judges what the next chapter waits for", () => {
    const g = spikeRecognition(), before = JSON.stringify(g);
    chapterEnd(g);
    expect(JSON.stringify(g)).toBe(before);
  });

  it("offers Grow the Company after the reliability outcome, and names what a stayed company still waits for", () => {
    const g = reliabilityOutcome();
    const end = chapterEnd(g)!;
    expect(end).toMatchObject({ chapter: "reliability", label: "Continue to Grow the Company", blockers: [], next: { name: "Grow the Company" } });
    expect(apply(g, end.proceed!).campaign!.combinedStage).toBeTruthy();
    // A change queued after staying keeps Next on offer, disabled with the reason.
    const queued = act(apply(g, end.stay), { type: "add_server" });
    expect(chapterAdvance(queued)).toMatchObject({ label: "Continue to Grow the Company", ready: false, blockers: ["queued changes have finished"] });
    expect(applyAction(queued, { type: "enter_combined" }).ok).toBe(false);
  });

  it("holds Continue while a change queued before the outcome is still installing", () => {
    const g = reliabilityOutcomeWithQueuedChange();
    const end = chapterEnd(g)!;
    expect(end).toMatchObject({ chapter: "reliability", blockers: ["queued changes have finished"] });
    expect(apply(g, end.stay).campaign!.reliabilityStage!.acknowledged).toBe(true);
  });

  it("offers no Continue past the last chapter of a smaller edition", () => {
    expect(chapterEnd(dataCompany(), PHONE_SCOPE)!.proceed).toBeNull();
    expect(chapterEnd(step(finishingScaling()).state, PHONE_SCOPE)!.proceed).toBeNull();
  });
});
