// @vitest-environment node
import { describe, expect, it } from "vitest";
import { advanceTurn, applyAction, BALANCE, needsAppProfile, dbLoadFactor, equipmentInfo, forecast, newGame, newLegacyGame, promoUsers, type AppProfileId, type GameState } from "../index";
import { act, handleIncident } from "./bots";

const chosen = (profile: AppProfileId, seed = 1) => act(newLegacyGame(seed), { type: "choose_app_profile", profile });
/** A company with a warm, tuned read cache, so only the profile decides how much database work it absorbs. */
const cached = (s: GameState): GameState => ({ ...s, techDone: [...s.techDone, "caching", "cache_tuning"], cacheWarmth: 1 });

describe("choosing what the company builds", () => {
  it("starts a new Challenge company undecided and a Guided Mode company without one", () => {
    expect(newLegacyGame(1).appProfile).toBeNull();
    expect(newGame(1).appProfile).toBeUndefined();
  });

  it("accepts one choice in the first two weeks and refuses another, an unknown one or a late one", () => {
    const s = chosen("gaming");
    expect(s.appProfile).toBe("gaming");
    expect(s.log.at(-1)!.text).toContain("Online game");
    expect(applyAction(s, { type: "choose_app_profile", profile: "social" })).toMatchObject({ ok: false, reason: "already_done" });
    expect(applyAction(newLegacyGame(1), { type: "choose_app_profile", profile: "general" })).toMatchObject({ ok: false, reason: "invalid" });
    expect(applyAction(newLegacyGame(1), { type: "choose_app_profile", profile: "nonsense" as AppProfileId })).toMatchObject({ ok: false, reason: "invalid" });
    const weeks = (n: number) => {
      let s = newLegacyGame(1);
      while (s.phase !== "management" || s.turn < n) s = s.phase === "management" ? advanceTurn(s) : s.phase === "review" ? act(s, { type: "acknowledge_review" }) : handleIncident(s, "expert");
      return s;
    };
    expect(needsAppProfile(weeks(2))).toBe(true);
    expect(applyAction(weeks(2), { type: "choose_app_profile", profile: "social" }).ok).toBe(true);
    expect(needsAppProfile(weeks(3))).toBe(false);
    expect(applyAction(weeks(3), { type: "choose_app_profile", profile: "social" })).toMatchObject({ ok: false, reason: "already_done" });
    expect(applyAction(newGame(1), { type: "choose_app_profile", profile: "social" }).ok).toBe(false);
  });

  it("plays a run saved before profiles exactly like an undecided one", () => {
    const legacy = newLegacyGame(7);
    delete legacy.appProfile;
    expect(advanceTurn(legacy)).toEqual({ ...advanceTurn(newLegacyGame(7)), appProfile: undefined });
  });
});

describe("what each kind of app asks of the infrastructure", () => {
  it("makes checkouts lean on the database even with a tuned cache, and lets a catalogue cache absorb the most", () => {
    const relief = (p: AppProfileId) => 1 - dbLoadFactor(cached(chosen(p))) / dbLoadFactor(chosen(p));
    expect(relief("ecommerce")).toBeCloseTo(0.35);
    expect(relief("streaming")).toBeCloseTo(0.5);
    expect(dbLoadFactor(cached(chosen("ecommerce")))).toBeGreaterThan(dbLoadFactor(cached(chosen("streaming"))) * 1.5);
  });

  it("labels the cache with the share of database work it removes, whatever each request costs", () => {
    // A warm, tuned cache removes 50% of a catalogue's database work but only 35% of a store's (its writes never cache).
    expect(equipmentInfo(cached(chosen("streaming")), "cache").summary).toBe("-50% database load");
    expect(equipmentInfo(cached(chosen("ecommerce")), "cache").summary).toBe("-35% database load");
    expect(equipmentInfo(cached(chosen("gaming")), "cache").summary).toBe("-50% database load");
    // A cold cache on a database-heavy store removes nothing yet; it never reads as extra load.
    expect(equipmentInfo({ ...cached(chosen("ecommerce")), cacheWarmth: 0 }, "cache").summary).toBe("-0% database load");
  });

  it("gives gaming the most traffic per user and the store the least", () => {
    const peak = (p: AppProfileId) => forecast(chosen(p)).peakLow;
    expect(peak("gaming")).toBeGreaterThan(peak("social"));
    expect(peak("ecommerce")).toBeLessThan(peak("social"));
  });

  it("makes each promotion land differently", () => {
    const gained = (p: AppProfileId, promo: "social" | "launch" | "targeted") => promoUsers(chosen(p), promo);
    expect(gained("social", "social")).toBeGreaterThan(gained("ecommerce", "social"));
    expect(gained("gaming", "launch")).toBeGreaterThan(gained("streaming", "launch"));
    expect(gained("ecommerce", "targeted")).toBeGreaterThan(gained("social", "targeted"));
  });

  it("loses gamers to lag at a load listeners shrug off", () => {
    // The same first week on one server, with the newsletter surge out of the way: both apps run it at 50-80% load,
    // past the game's latency knee and short of streaming's, so only the players notice.
    const week = (p: AppProfileId) => advanceTurn({ ...chosen(p, 3), upcomingSurge: null });
    const gaming = week("gaming"), streaming = week("streaming");
    for (const s of [gaming, streaming]) {
      const util = s.live.peakRps / BALANCE.server.capacity;
      expect(util).toBeGreaterThan(0.5);
      expect(util).toBeLessThan(0.8);
    }
    expect(gaming.satisfaction).toBeLessThan(streaming.satisfaction);
  });
});
