import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AVATARS, DEFAULT_AVATAR, isAvatar } from "./avatars";
import { DEFAULT_META, loadAvatar, readAnalytics, saveAvatar, saveMeta, saveMode } from "./persist";
import { useGame } from "./store";

beforeEach(() => {
  localStorage.clear();
  // Challenge Mode, which keeps its analytics in the browser, opens once Guided Mode is done.
  saveMeta({ ...DEFAULT_META, challengeUnlocked: true });
  saveMode("classic");
  useGame.setState(useGame.getInitialState(), true);
});
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("the player's avatars", () => {
  it("are eighteen cube animals, none of them one the crew already are", () => {
    expect(AVATARS).toHaveLength(18);
    expect(new Set(AVATARS.map((a) => a.id)).size).toBe(18);
    for (const crew of ["cat", "chick", "bunny", "bee", "parrot", "monkey"]) expect(isAvatar(crew), crew).toBe(false);
    expect(isAvatar(DEFAULT_AVATAR)).toBe(true);
  });

  it("are remembered in the browser, falling back to the default when nothing usable is stored", () => {
    expect(loadAvatar()).toBe(DEFAULT_AVATAR);
    saveAvatar("panda");
    expect(loadAvatar()).toBe("panda");
    localStorage.setItem("nn.avatar.v1", "unicorn");
    expect(loadAvatar()).toBe(DEFAULT_AVATAR);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadAvatar()).toBe(DEFAULT_AVATAR);
  });

  it("change at once and for the next visit, recorded for the analytics, and never in the save", () => {
    useGame.getState().boot();
    useGame.getState().setAvatar("tiger");
    expect(useGame.getState().avatar).toBe("tiger");
    expect(loadAvatar()).toBe("tiger");
    expect(localStorage.getItem("nn.classic.save.v1") ?? "").not.toContain("tiger");
    useGame.setState(useGame.getInitialState(), true);
    useGame.getState().boot();
    expect(useGame.getState().avatar).toBe("tiger");
    expect(readAnalytics().filter((e) => e.name === "avatar_changed").map((e) => e.data?.avatar)).toEqual(["tiger"]);
  });

  it("keep working when the browser cannot store the choice", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    useGame.getState().setAvatar("koala");
    expect(useGame.getState().avatar).toBe("koala");
  });
});

describe("walk mode", () => {
  it("records how long it lasted, is never saved, and ends when the title screen comes back", () => {
    useGame.getState().boot();
    useGame.getState().play();
    useGame.getState().setWalking(true);
    expect(useGame.getState().walking).toBe(true);
    useGame.getState().saveNow(true);
    expect(localStorage.getItem("nn.classic.save.v1") ?? "").not.toContain("walking");
    useGame.setState({ started: false });
    expect(useGame.getState().walking).toBe(false);
    expect(readAnalytics().filter((e) => e.name.startsWith("walk_")).map((e) => e.name)).toEqual(["walk_started", "walk_ended"]);
  });
});
