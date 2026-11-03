import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Action } from "@/sim";
import type { CampaignInput } from "@/sim/campaignTypes";
import { applyCampaignInput } from "@/sim/step";
import { act, reliabilityReview, tick } from "@/sim/__tests__/completionFixture";
import { CAMPAIGN_SAVE_KEY, decodeSave, makeEnvelope, type SaveEnvelope } from "./saveEnvelope";
import { loadGame, saveGame } from "./persist";
import { beginSession, projectEvents } from "./telemetry";

vi.setConfig({ testTimeout: 30_000 });
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as unknown;
const retired = (type: string) => ({ type }) as unknown as Action;
const backups = () => Object.keys(localStorage).filter(key => key.startsWith(`${CAMPAIGN_SAVE_KEY}.backup.`));

// Stay Online's outcome, before the player acknowledged it; one company shared by every case below.
const review = reliabilityReview();
/** The outcome menu's former Continue: acknowledge Stay Online, then enter Grow the Company. */
const acknowledged = act(review, { type: "acknowledge_reliability" });

/** A save recorded in Grow the Company before it was removed: `company`, then its entry and Chapter 6 decisions. */
function grownSave(company = acknowledged) {
  const entry = company.campaign!.step, e = makeEnvelope(company, 0, 1234);
  const chapter6 = [
    { step: entry, action: retired("enter_combined") },
    { step: entry + 5, action: retired("start_growth_wave") },
    { step: entry + 12, action: { type: "add_server" } },
    { step: entry + 29, action: retired("run_promotion") },
    { step: entry + 400, action: retired("complete_campaign") },
  ] as CampaignInput[];
  const envelope: SaveEnvelope = { ...e, step: entry + 2000, inputs: [...e.inputs, ...chapter6],
    runtime: { ...e.runtime, measurement: { ...e.runtime.measurement, cursor: company.campaign!.trace.length + 50 } } };
  return { envelope, raw: JSON.stringify(envelope) };
}

it("completes the campaign where a company entered Grow the Company, discarding everything it did there", () => {
  const loaded = decodeSave(grownSave().raw);
  if (loaded.status !== "ok") throw Error(loaded.status);
  expect(json(loaded.game)).toEqual(json(act(acknowledged, { type: "complete_campaign" })));
  expect(loaded.game).toMatchObject({ phase: "ended", outcome: "won" });
  expect(loaded.envelope.inputs.at(-1)).toEqual({ step: acknowledged.campaign!.step, action: { type: "complete_campaign" } });
  expect(loaded.retiredChapter).toBe(true);
});

it("keeps Stay Online progress recorded after a refused attempt to enter Grow the Company", () => {
  // Next was pressed before the outcome was acknowledged: the engine refused and recorded it, and play went on.
  const refused = applyCampaignInput(review, retired("enter_combined")).state;
  const company = act(refused, { type: "acknowledge_reliability" });
  const loaded = decodeSave(grownSave(company).raw);
  if (loaded.status !== "ok") throw Error(loaded.status);
  expect(json(loaded.game)).toEqual(json(act(company, { type: "complete_campaign" })));
  expect(loaded.game.campaign!.reliabilityStage!.acknowledged).toBe(true);
});

it("leaves a company that never entered Grow the Company as it was, refused attempts included", () => {
  const company = tick(act(applyCampaignInput(review, retired("enter_combined")).state, { type: "acknowledge_reliability" }), 3);
  const loaded = decodeSave(JSON.stringify(makeEnvelope(company)));
  if (loaded.status !== "ok") throw Error(loaded.status);
  expect(json(loaded.game)).toEqual(json(company));
  expect(loaded.game.phase).toBe("management");
  expect(loaded.retiredChapter).toBe(false);
  // Nothing was discarded, so saving it keeps no backup however often it is saved.
  expect(saveGame(loaded.game)).toBe(true); expect(saveGame(tick(loaded.game))).toBe(true);
  expect(backups()).toEqual([]);
});

it("records nothing new for the discarded chapter or the completion that replaced it", () => {
  const loaded = decodeSave(grownSave().raw);
  if (loaded.status !== "ok") throw Error(loaded.status);
  const { measurement } = loaded.envelope.runtime, at = "2026-11-03T00:00:00Z";
  expect(measurement.cursor).toBe(loaded.game.campaign!.trace.length);
  const projected = projectEvents(beginSession(measurement, loaded.game, "after-removal", at), loaded.game, at);
  expect(projected.pending.filter(e => e.eventId.includes(":trace:"))).toEqual([]);
});

it("keeps the original save as a backup when the completed company is first written", () => {
  const { raw } = grownSave();
  localStorage.setItem(CAMPAIGN_SAVE_KEY, raw);
  const loaded = loadGame();
  if (loaded.status !== "ok") throw Error(loaded.status);
  expect(saveGame(loaded.game, 0, false, loaded.measurement)).toBe(true);
  expect(backups().map(key => localStorage.getItem(key))).toEqual([raw]);
  const again = decodeSave(localStorage.getItem(CAMPAIGN_SAVE_KEY)!);
  if (again.status !== "ok") throw Error(again.status);
  expect(json(again.game)).toEqual(json(loaded.game));
  expect(again.retiredChapter).toBe(false);
});

it.each(["the browser storage is full", "another backup holds that key"])("still saves the completed company when %s", reason => {
  const { envelope, raw } = grownSave();
  localStorage.setItem(CAMPAIGN_SAVE_KEY, raw);
  const key = `${CAMPAIGN_SAVE_KEY}.backup.v${envelope.schemaVersion}.${envelope.runId}.${envelope.savedAt}`;
  const original = Storage.prototype.setItem;
  if (reason.startsWith("another")) localStorage.setItem(key, "another source");
  else vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, k, v) { if (k.includes(".backup.")) throw Error("full"); original.call(this, k, v); });
  const loaded = loadGame();
  if (loaded.status !== "ok") throw Error(loaded.status);
  expect(saveGame(loaded.game)).toBe(true);
  expect(loadGame()).toMatchObject({ status: "ok", game: { phase: "ended", outcome: "won" } });
  expect(localStorage.getItem(key)).toBe(reason.startsWith("another") ? "another source" : null);
});
