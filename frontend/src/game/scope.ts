import type { Action, GameState } from "@/sim";
import { finishedChapter } from "./campaignChapters";

/**
 * How much of the game an edition offers. The desktop edition plays everything; the phone edition plays Launch Week
 * and Scaling & Routing of Guided Mode, then Challenge Mode. A scope only gates what the player can
 * reach: the chapters themselves, the simulation and the saves stay the same in every edition.
 */
export interface PlayScope {
  id: "full" | "phone";
  /** The last Guided Mode chapter this edition plays, or null for all of them. */
  lastChapter: ScopedChapter | null;
  /** Why Challenge Mode is still locked, shown wherever it is offered. */
  challengeLocked: string;
  /** What the player is told when they try to go past `lastChapter`. */
  endOfGuided: string;
}

/** Guided Mode's gameplay chapters after the walkthrough, in the order a company enters them. */
export const SCOPED_CHAPTERS = ["opening", "scaling", "data", "spikes", "reliability", "combined"] as const;
export type ScopedChapter = (typeof SCOPED_CHAPTERS)[number];

/**
 * The chapters a company plays after Launch Week (Chapter 0), numbered from 1. Launch Week replaced the Opening,
 * which only a version-1 company still plays.
 */
export const NUMBERED_CHAPTERS = SCOPED_CHAPTERS.filter(id => id !== "opening");
/** A chapter's number as the chapter bar shows it after Launch Week. */
export const chapterNumber = (id: Exclude<ScopedChapter, "opening">) => NUMBERED_CHAPTERS.indexOf(id) + 1;
/** Finishing Stay Online unlocks Challenge Mode. */
export const UNLOCK_CHAPTER = chapterNumber("reliability");
export const CHALLENGE_LOCKED = `Finish Chapter ${UNLOCK_CHAPTER}, Stay Online, in Guided Mode to unlock Challenge Mode.`;

/** The action that moves a company into each chapter after the Opening. */
const ENTRIES: Partial<Record<Action["type"], ScopedChapter>> = {
  enter_scaling: "scaling",
  enter_data: "data",
  enter_spikes: "spikes",
  enter_reliability: "reliability",
  enter_combined: "combined",
};

export const FULL_SCOPE: PlayScope = {
  id: "full",
  lastChapter: null,
  challengeLocked: CHALLENGE_LOCKED,
  endOfGuided: "",
};

export const PHONE_SCOPE: PlayScope = {
  id: "phone",
  lastChapter: "scaling",
  challengeLocked: "Complete Scaling & Routing in Guided Mode to unlock Challenge Mode.",
  endOfGuided: "On a phone, Guided Mode ends with Scaling & Routing. Its remaining four chapters are played on a larger screen, such as a tablet or computer.",
};

/** Whether `chapter` is played in this scope. */
export function chapterInScope(scope: PlayScope, chapter: ScopedChapter): boolean {
  return scope.lastChapter === null || SCOPED_CHAPTERS.indexOf(chapter) <= SCOPED_CHAPTERS.indexOf(scope.lastChapter);
}

/** Whether this scope lets the player take `action`: only entering a chapter beyond the scope is refused. */
export function scopeAllows(scope: PlayScope, action: Action): boolean {
  const chapter = ENTRIES[action.type];
  return chapter === undefined || chapterInScope(scope, chapter);
}

/**
 * Whether the company has finished everything this scope's Guided Mode offers. The full scope ends with the
 * campaign's own completion, which unlocks Challenge Mode separately, so it never reports completion here.
 * A phone company is complete once Scaling & Routing's requirements are met (the company is waiting to enter Data
 * Strategy), or if it is already further on, for example a save that reached later chapters in another edition.
 */
export function scopeComplete(scope: PlayScope, game: GameState): boolean {
  const c = game.campaign;
  if (scope.lastChapter === null || !c) return false;
  const next = SCOPED_CHAPTERS[SCOPED_CHAPTERS.indexOf(scope.lastChapter) + 1] as ScopedChapter | undefined;
  if (!next) return false;
  return finishedChapter(game) === scope.lastChapter || chapterReached(game, next);
}

/** Whether the company has entered `chapter` already. */
function chapterReached(game: GameState, chapter: ScopedChapter): boolean {
  const c = game.campaign!;
  switch (chapter) {
    case "opening": return true;
    case "scaling": return !!c.scaling;
    case "data": return !!c.dataStage;
    case "spikes": return !!c.spikeStage;
    case "reliability": return !!c.reliabilityStage;
    case "combined": return !!c.combinedStage;
  }
}
