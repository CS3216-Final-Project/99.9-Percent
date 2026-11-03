import { beforeEach, expect, it, vi } from "vitest";
import type { CampaignInput } from "@/sim/campaignTypes";
import { completedReliability } from "@/sim/__tests__/completionFixture";
import { CAMPAIGN_SAVE_KEY, SCHEMA_VERSION, decodeSave, makeEnvelope, type SaveEnvelope } from "./saveEnvelope";
import { loadGame, saveGame } from "./persist";
import { chapterAdvance } from "./chapterCompletion";

vi.setConfig({ testTimeout: 30_000 });
beforeEach(() => localStorage.clear());

const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as unknown;

/** A save recorded in Grow the Company before it was removed: the Stay Online company, then its Chapter 6 decisions. */
function grownSave() {
  const g = completedReliability(), entry = g.campaign!.step, e = makeEnvelope(g, 0, 1234);
  const retired = [
    { step: entry, action: { type: "enter_combined" } },
    { step: entry + 5, action: { type: "start_growth_wave" } },
    { step: entry + 29, action: { type: "run_promotion" } },
  ] as unknown as CampaignInput[];
  const envelope: SaveEnvelope = { ...e, step: entry + 40, inputs: [...e.inputs, ...retired],
    runtime: { ...e.runtime, measurement: { ...e.runtime.measurement, cursor: g.campaign!.trace.length + 50 } } };
  return { g, entry, envelope, raw: JSON.stringify(envelope) };
}

it("resumes a company recorded in Grow the Company at the end of Stay Online", () => {
  const { g, entry, envelope, raw } = grownSave();
  const loaded = decodeSave(raw);
  if (loaded.status !== "ok") throw Error(loaded.status);
  expect(json(loaded.game)).toEqual(json(g));
  expect(loaded.envelope).toMatchObject({ step: entry, inputs: envelope.inputs.slice(0, g.campaign!.inputs.length) });
  // Later playtest progress is clamped to the rewound record instead of making the save unreadable.
  expect(loaded.envelope.runtime.measurement.cursor).toBe(g.campaign!.trace.length);
  expect(chapterAdvance(loaded.game)).toMatchObject({ label: "Complete campaign", ready: true });
});

it("keeps the original Grow the Company save when the rewound company is first written", () => {
  const { g, raw } = grownSave();
  localStorage.setItem(CAMPAIGN_SAVE_KEY, raw);
  const loaded = loadGame();
  if (loaded.status !== "ok") throw Error(loaded.status);
  expect(saveGame(loaded.game)).toBe(true);
  expect(localStorage.getItem(`${CAMPAIGN_SAVE_KEY}.backup.v${SCHEMA_VERSION}.${g.campaign!.runId}.1234`)).toBe(raw);
  const again = loadGame();
  if (again.status !== "ok") throw Error(again.status);
  expect(json(again.game)).toEqual(json(g));
});

it("refuses to replace the slot when a different backup already holds that original", () => {
  const { g, raw } = grownSave();
  localStorage.setItem(CAMPAIGN_SAVE_KEY, raw);
  localStorage.setItem(`${CAMPAIGN_SAVE_KEY}.backup.v${SCHEMA_VERSION}.${g.campaign!.runId}.1234`, "another source");
  const loaded = loadGame();
  if (loaded.status !== "ok") throw Error(loaded.status);
  expect(saveGame(loaded.game)).toBe(false);
  expect(localStorage.getItem(CAMPAIGN_SAVE_KEY)).toBe(raw);
});
