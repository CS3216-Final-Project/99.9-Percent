import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { loadExploration, saveExploration, type ExplorationState } from "./exploration";

const CAMPAIGN = "nn.campaign.exploration.v1";
const CLASSIC = "nn.classic.exploration.v1";

const AVATAR = { floor: "office", x: -6.6, z: 11.8, yaw: 2.3 } as const;
const CAMERA = { target: { x: -1.5, z: 3.2 }, offset: { x: 14.1, y: 12.7, z: 14.1 }, zoom: 42 } as const;

beforeEach(() => {
  localStorage.clear();
  // The visit's memory survives a cleared store only until a successful read says it is gone.
  loadExploration("campaign");
  loadExploration("classic");
});
afterEach(() => vi.restoreAllMocks());

describe("exploration persistence", () => {
  it("round-trips a full state", () => {
    const full = { floor: "office", walking: true, viewpoint: "follow", avatar: AVATAR, camera: CAMERA } as const;
    expect(saveExploration("campaign", full)).toBe(true);
    expect(loadExploration("campaign")).toEqual({ version: 1, ...full });
    expect(JSON.parse(localStorage.getItem(CAMPAIGN)!)).toMatchObject(full);
  });

  it("keeps the modes' records independent", () => {
    saveExploration("campaign", { floor: "office", walking: true });
    saveExploration("classic", { floor: "servers", walking: false });
    expect(loadExploration("campaign")).toMatchObject({ floor: "office", walking: true });
    expect(loadExploration("classic")).toMatchObject({ floor: "servers", walking: false });
    expect(localStorage.getItem(CLASSIC)).not.toBe(localStorage.getItem(CAMPAIGN));
  });

  it("starts from defaults and merges patches", () => {
    expect(loadExploration("campaign")).toEqual({ version: 1, floor: "servers", walking: false, viewpoint: "overview", avatar: null, camera: null });
    saveExploration("campaign", { walking: true });
    saveExploration("campaign", { avatar: AVATAR });
    expect(loadExploration("campaign")).toMatchObject({ floor: "servers", walking: true, avatar: AVATAR, camera: null });
  });

  it.each([
    ["malformed JSON", "{not json"],
    ["the wrong version", JSON.stringify({ version: 2, floor: "office", walking: true })],
    ["a non-object", JSON.stringify(7)],
  ])("falls back to defaults for %s", (_name, raw) => {
    localStorage.setItem(CAMPAIGN, raw);
    const state = loadExploration("campaign");
    expect(state).toEqual({ version: 1, floor: "servers", walking: false, viewpoint: "overview", avatar: null, camera: null });
    // A corrupt read also clears the visit's memory: a later write does not resurrect it.
    saveExploration("campaign", { walking: true });
    expect(loadExploration("campaign")).toMatchObject({ floor: "servers", walking: true });
  });

  it("reads a record from before the views as the overview, and an unknown view as the overview too", () => {
    localStorage.setItem(CAMPAIGN, JSON.stringify({ version: 1, floor: "office", walking: true, avatar: AVATAR, camera: CAMERA }));
    expect(loadExploration("campaign")).toMatchObject({ floor: "office", walking: true, viewpoint: "overview", avatar: AVATAR });
    localStorage.setItem(CAMPAIGN, JSON.stringify({ version: 1, floor: "office", walking: true, viewpoint: "roof" }));
    expect(loadExploration("campaign")).toMatchObject({ walking: true, viewpoint: "overview" });
    saveExploration("campaign", { viewpoint: "first" });
    saveExploration("campaign", { viewpoint: "sideways" as never });
    expect(loadExploration("campaign").viewpoint).toBe("first");
  });

  it("drops invalid fields without losing the valid ones", () => {
    const bad = (avatar: unknown, camera: unknown): ExplorationState =>
      JSON.parse(JSON.stringify({ version: 1, floor: "office", walking: true, avatar, camera }));
    for (const [avatar, camera] of [
      [{ ...AVATAR, x: 500 }, CAMERA],
      [{ ...AVATAR, floor: "roof" }, CAMERA],
      [{ ...AVATAR, yaw: NaN }, CAMERA],
      [AVATAR, { ...CAMERA, zoom: 5 }],
      [AVATAR, { ...CAMERA, zoom: 200 }],
      [AVATAR, { ...CAMERA, target: { x: 999, z: 0 } }],
      [AVATAR, { ...CAMERA, offset: { x: 0, y: 0, z: 0 } }],
      [AVATAR, { ...CAMERA, offset: { x: 1e4, y: 0, z: 0 } }],
    ] as const) {
      localStorage.setItem(CAMPAIGN, JSON.stringify(bad(avatar, camera)));
      const state = loadExploration("campaign");
      expect(state.floor).toBe("office");
      expect(state.walking).toBe(true);
      expect(state.avatar === null || Number.isFinite(state.avatar.yaw)).toBe(true);
    }
    localStorage.setItem(CAMPAIGN, JSON.stringify(bad({ ...AVATAR, x: 500 }, { ...CAMERA, zoom: 5 })));
    expect(loadExploration("campaign")).toMatchObject({ avatar: null, camera: null });
    localStorage.setItem(CAMPAIGN, JSON.stringify({ version: 1, floor: "roof", walking: "yes", avatar: AVATAR }));
    expect(loadExploration("campaign")).toMatchObject({ floor: "servers", walking: false, avatar: AVATAR });
  });

  it("is harmless when storage cannot be read or written", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadExploration("campaign")).toEqual({ version: 1, floor: "servers", walking: false, viewpoint: "overview", avatar: null, camera: null });
    vi.restoreAllMocks();

    // Storage already holds an older record; a failed write still leaves memory ahead of it.
    expect(saveExploration("campaign", { floor: "servers", walking: false })).toBe(true);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    expect(saveExploration("campaign", { floor: "office", walking: true })).toBe(false);
    expect(JSON.parse(localStorage.getItem(CAMPAIGN)!)).toMatchObject({ floor: "servers", walking: false });
    expect(loadExploration("campaign")).toMatchObject({ floor: "office", walking: true });
    vi.restoreAllMocks();
    // Once a write does reach storage, a cleared store is honoured again: an empty slot resets the memory.
    expect(saveExploration("campaign", { floor: "servers", walking: false })).toBe(true);
    localStorage.clear();
    expect(loadExploration("campaign")).toMatchObject({ floor: "servers", walking: false });
  });

  it("returns defensive copies", () => {
    saveExploration("campaign", { avatar: AVATAR, camera: CAMERA });
    const a = loadExploration("campaign");
    a.avatar!.x = 999;
    a.camera!.zoom = 140;
    const b = loadExploration("campaign");
    expect(b.avatar!.x).toBe(AVATAR.x);
    expect(b.camera!.zoom).toBe(CAMERA.zoom);
  });
});
