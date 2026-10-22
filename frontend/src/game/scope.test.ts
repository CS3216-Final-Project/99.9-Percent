import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { newGame } from "@/sim";
import { dataCompany, finishingScaling } from "@/sim/__tests__/dataFixture";
import { loadMeta } from "./persist";
import { chapterInScope, FULL_SCOPE, PHONE_SCOPE, scopeAllows, scopeComplete, type PlayScope } from "./scope";
import { challengeAvailable, useGame } from "./store";

beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); });
afterEach(() => localStorage.clear());

describe("scope rules", () => {
  it("plays every chapter in full and stops the phone after Scaling & Routing", () => {
    expect(chapterInScope(FULL_SCOPE, "combined")).toBe(true);
    expect(chapterInScope(PHONE_SCOPE, "opening")).toBe(true);
    expect(chapterInScope(PHONE_SCOPE, "scaling")).toBe(true);
    for (const later of ["data", "spikes", "reliability", "combined"] as const) expect(chapterInScope(PHONE_SCOPE, later)).toBe(false);
  });

  it("refuses only the entries into chapters beyond the scope", () => {
    expect(scopeAllows(PHONE_SCOPE, { type: "enter_scaling" })).toBe(true);
    expect(scopeAllows(PHONE_SCOPE, { type: "enter_data", profile: "read-heavy" })).toBe(false);
    expect(scopeAllows(PHONE_SCOPE, { type: "enter_reliability" })).toBe(false);
    expect(scopeAllows(PHONE_SCOPE, { type: "add_server" })).toBe(true);
    expect(scopeAllows(FULL_SCOPE, { type: "enter_data", profile: "read-heavy" })).toBe(true);
  });

  it("completes the phone campaign once Scaling & Routing is finished, and never the full one", () => {
    expect(scopeComplete(PHONE_SCOPE, newGame(1, "fresh"))).toBe(false);
    expect(scopeComplete(PHONE_SCOPE, finishingScaling())).toBe(false);
    const ready = dataCompany("read-heavy", false);
    expect(scopeComplete(PHONE_SCOPE, ready)).toBe(true);
    // A company already past the phone's chapters, from another edition, counts as complete too.
    expect(scopeComplete(PHONE_SCOPE, dataCompany("read-heavy", true))).toBe(true);
    expect(scopeComplete(FULL_SCOPE, ready)).toBe(false);
  });
});

/** Run the store's Guided Mode company through the game second that finishes Scaling & Routing. */
function finishScalingIn(scope: PlayScope) {
  useGame.setState({ scope, game: finishingScaling(), ready: true, hasRun: true, started: true, onboarding: false, running: true });
  useGame.getState().advance();
}

describe("the store in each scope", () => {
  it("boots with the edition's scope, and the full scope by default", () => {
    useGame.getState().boot();
    expect(useGame.getState().scope).toBe(FULL_SCOPE);
    useGame.setState(useGame.getInitialState(), true);
    useGame.getState().boot(PHONE_SCOPE);
    expect(useGame.getState().scope).toBe(PHONE_SCOPE);
  });

  it("on a phone, ends Guided Mode after Scaling & Routing and unlocks Challenge Mode for good", () => {
    expect(challengeAvailable(useGame.getState())).toBe(false);
    finishScalingIn(PHONE_SCOPE);
    const s = useGame.getState();
    expect(s.chapterComplete).toBe("scaling");
    expect(s.running).toBe(false);
    expect(s.meta.challengeUnlocked).toBe(true);
    expect(loadMeta("campaign").challengeUnlocked).toBe(true);
    expect(challengeAvailable(s)).toBe(true);

    // Chapter 3 cannot be reached: the entry is refused with an explanation and the company stays in Scaling.
    expect(s.act({ type: "enter_data", profile: "read-heavy" })).toBe(false);
    expect(useGame.getState().game.campaign!.dataStage).toBeNull();
    expect(useGame.getState().toast?.text).toBe(PHONE_SCOPE.endOfGuided);

    // The company keeps operating, and Challenge Mode is open from here.
    expect(useGame.getState().act({ type: "set_traffic_limit", enabled: useGame.getState().game.campaign!.limit === null })).toBe(true);
    expect(useGame.getState().switchMode("classic")).toBe(true);
    expect(useGame.getState().mode).toBe("classic");
  });

  it("keeps Challenge Mode locked on a phone until then, with the phone's reason", () => {
    useGame.setState({ scope: PHONE_SCOPE, game: finishingScaling(), ready: true, hasRun: true, started: true, onboarding: false });
    expect(useGame.getState().switchMode("classic")).toBe(false);
    expect(useGame.getState().mode).toBe("campaign");
    expect(useGame.getState().toast?.text).toBe(PHONE_SCOPE.challengeLocked);
  });

  it("on the desktop, finishing Scaling & Routing neither unlocks Challenge Mode nor blocks Data Strategy", () => {
    finishScalingIn(FULL_SCOPE);
    const s = useGame.getState();
    expect(s.chapterComplete).toBe("scaling");
    expect(s.meta.challengeUnlocked).toBe(false);
    expect(challengeAvailable(s)).toBe(false);
    expect(s.switchMode("classic")).toBe(false);
    expect(useGame.getState().toast?.text).toBe(FULL_SCOPE.challengeLocked);
    expect(useGame.getState().act({ type: "enter_data", profile: "read-heavy" })).toBe(true);
    expect(useGame.getState().game.campaign!.dataStage).not.toBeNull();
  });
});
