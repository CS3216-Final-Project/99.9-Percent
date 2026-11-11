import { afterEach, describe, expect, it, vi } from "vitest";
import { boothPage, loadVisitor, saveVisitor, submissionFor, tidyName, type BoothVisitor } from "./booth";
import type { EndReport } from "@/sim/report";

const visitor: BoothVisitor = { name: "Ada", submissionId: "5d0c2b9e-3f6a-4b8e-9c1d-2a7f0e4b6c11", runSeed: 42, posted: null, pending: null };
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe("boothPage", () => {
  it("reads the booth paths and the query fallback", () => {
    expect(boothPage("/steps", "")).toBe("play");
    expect(boothPage("/STEPS/", "")).toBe("play");
    expect(boothPage("/steps/board", "")).toBe("board");
    expect(boothPage("/leaderboard", "")).toBe("board");
    expect(boothPage("/", "?steps")).toBe("play");
    expect(boothPage("/", "?steps=board")).toBe("board");
  });
  it("leaves every other address to the normal game", () => {
    for (const [path, search] of [["/", ""], ["/stepsx", ""], ["/steps/other", ""], ["/", "?graphics=low"]]) {
      expect(boothPage(path, search)).toBeNull();
    }
  });
});

describe("tidyName", () => {
  it("collapses spaces and keeps readable names in any script", () => {
    expect(tidyName("  Ada   Lovelace ")).toBe("Ada Lovelace");
    expect(tidyName("陈小明")).toBe("陈小明");
    expect(tidyName("O'Brien")).toBe("O'Brien");
  });
  it("refuses empty, long, markup and emoji names", () => {
    for (const raw of ["", "   ", "x".repeat(17), "<b>hi</b>", "party 🎉", "-dash"]) expect(tidyName(raw)).toBeNull();
  });
});

describe("visitor storage", () => {
  it("round-trips a visitor and clears it for the next player", () => {
    saveVisitor(visitor);
    expect(loadVisitor()).toEqual(visitor);
    saveVisitor(null);
    expect(loadVisitor()).toBeNull();
  });
  it("treats corrupt or tampered storage as no visitor", () => {
    for (const raw of ["{", "null", "[]", JSON.stringify({ ...visitor, name: "<script>" }), JSON.stringify({ ...visitor, runSeed: "x" }),
      JSON.stringify({ ...visitor, posted: { rank: "1" } }), JSON.stringify({ ...visitor, pending: { id: "other", name: "Ada", score: 1 } })]) {
      localStorage.setItem("nn.booth.v1", raw);
      expect(loadVisitor()).toBeNull();
    }
  });
  it("keeps working when storage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => saveVisitor(visitor)).not.toThrow();
    expect(loadVisitor()).toBeNull();
  });
});

describe("submissionFor", () => {
  const report = { score: 72, grade: "B", weeks: 18, peakUsers: 51_234.6, users: 40_000, outcome: "won" } as EndReport;
  it("sends the report score, peak users and outcome", () => {
    expect(submissionFor(visitor, report, true)).toEqual({
      id: visitor.submissionId, name: "Ada", score: 72, grade: "B", weeks: 18, users: 51_235, outcome: "won",
    });
  });
  it("marks a run ended early and keeps values inside the board's ranges", () => {
    const wild = { ...report, score: 140, weeks: 900, peakUsers: 5e12 } as EndReport;
    expect(submissionFor(visitor, wild, false)).toMatchObject({ score: 100, weeks: 520, users: 1_000_000_000, outcome: "unfinished" });
    expect(submissionFor(visitor, { ...report, peakUsers: Number.NaN } as EndReport, true).users).toBe(0);
  });
});
