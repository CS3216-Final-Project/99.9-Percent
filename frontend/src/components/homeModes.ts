import { useMemo, useState } from "react";
import { BALANCE, type GameState } from "@/sim";
import { campaignChapters } from "@/game/campaignChapters";
import { loadClassicGame, loadGame, loadMeta, type GameMode } from "@/game/persist";
import { isFreshRun, useGame } from "@/game/store";
import { num } from "@/game/format";
import type { IconName } from "./icons";

/** What a mode's card says about its saved game. Nothing here changes a save. */
export interface Summary { progress: string | null; resumable: boolean; ended: boolean; tutorialDone: boolean; continueLabel: string; chapter?: number }

/** How a home screen describes a Guided Mode save. */
export type CampaignSummarizer = (game: GameState | null, tutorialDone: boolean) => Summary;

export function campaignSummary(game: GameState | null, tutorialDone: boolean): Summary {
  if (!game?.campaign) return { progress: null, resumable: false, ended: false, tutorialDone, continueLabel: "Start Guided Mode" };
  // A save made before the walkthrough ends is still in Chapter 0, not the Opening.
  const chapters = campaignChapters(game, !tutorialDone, tutorialDone);
  const chapter = chapters.find((c) => c.current) ?? chapters.filter((c) => c.completed).at(-1) ?? chapters[0];
  const ended = game.phase === "ended";
  const progress = ended ? (game.outcome === "won" ? "All chapters complete" : "Company closed")
    : chapter.number === 0 ? "Walkthrough in progress" : `Chapter ${chapter.number} of ${chapters.length - 1}: ${chapter.name}`;
  // A finished company opens on its final report; nothing is left to continue.
  return { progress, resumable: true, ended, tutorialDone, continueLabel: ended ? "See how it ended" : "Continue company", chapter: chapter.number };
}

export function classicSummary(game: GameState | null, tutorialDone: boolean): Summary {
  if (!game || game.campaign || isFreshRun(game)) return { progress: null, resumable: false, ended: false, tutorialDone, continueLabel: "Start Challenge Mode" };
  const ended = game.phase === "ended";
  return { progress: ended ? (game.outcome === "won" ? "Last company reached the goal" : "Last company closed") : `Week ${game.turn} of ${BALANCE.maxTurns}`, resumable: !ended, ended, tutorialDone,
    continueLabel: ended ? "Start Challenge Mode" : `Continue week ${game.turn}` };
}

/**
 * Both modes' summaries for a home screen: the loaded mode from the store, the other read straight from storage
 * without loading or writing it.
 */
export function useModeSummaries(summarizeCampaign: CampaignSummarizer = campaignSummary): (mode: GameMode) => Summary {
  const mode = useGame((s) => s.mode);
  const game = useGame((s) => s.game);
  const hasRun = useGame((s) => s.hasRun);
  const meta = useGame((s) => s.meta);
  const generation = useGame((s) => s.generation);
  const other = useMemo(() => {
    if (mode === "campaign") {
      const loaded = loadClassicGame();
      return classicSummary(loaded.status === "ok" ? loaded.game : null, loadMeta("classic").tutorialDone);
    }
    const loaded = loadGame();
    return summarizeCampaign(loaded.status === "ok" ? loaded.game : null, loadMeta("campaign").tutorialDone);
    // A new generation means the active game was replaced, which can change the other mode's save too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, generation]);
  const active = mode === "campaign" ? summarizeCampaign(hasRun ? game : null, meta.tutorialDone) : classicSummary(game, meta.tutorialDone);
  return (m: GameMode) => (m === mode ? active : other);
}

/** What a mode card says about its mode. The desktop home leaves out the pace line; the phone home shows it. */
export type ModeInfo = { name: string; icon: IconName; pace?: string; about: string };

export const MODES: Record<GameMode, ModeInfo> = {
  campaign: {
    name: "Guided Mode", icon: "server",
    about: "Begin with the walkthrough to learn the controls, game time and finances, then tackle six infrastructure chapters. Inspect problems, upgrade servers and pause whenever you need.",
  },
  classic: {
    name: "Challenge Mode", icon: "week",
    about: `Apply what you learned on your own. Grow to ${num(BALANCE.targetUsers)} users in ${BALANCE.maxTurns} weeks while handling outages and keeping the business afloat.`,
  },
};

/** Guided Mode's pitch once its company has started: finish the walkthrough, then the chapters. */
export function campaignAbout(summary: Summary): string {
  if (!summary.resumable) return MODES.campaign.about;
  if (!summary.tutorialDone) return "Finish the walkthrough to learn the controls, game time and finances, then tackle six infrastructure chapters. Inspect problems, upgrade servers and pause whenever you need.";
  return "Work through six infrastructure chapters at your own pace. Inspect problems, upgrade servers and pause whenever you need.";
}

/** A home screen's mode controls: play or continue a mode, start a new one and replay its tutorial. */
export function useModeLauncher(summary: (mode: GameMode) => Summary) {
  const [unsaved, setUnsaved] = useState<GameMode | null>(null);

  /** Run `then` in mode `m`, switching first when it is not the loaded mode. */
  const inMode = (m: GameMode, then?: () => void) => {
    const s = useGame.getState();
    if (m !== s.mode && !s.switchMode(m, { discard: unsaved === m })) {
      if (!useGame.getState().cloudBusy) setUnsaved(m);
      return;
    }
    setUnsaved(null);
    then?.();
  };
  const fresh = () => {
    const s = useGame.getState();
    if (s.meta.tutorialDone) s.newRun({});
    else s.startTutorialRun();
  };
  const playMode = (m: GameMode) => {
    const info = summary(m);
    if (m === "classic" && info.ended) { inMode(m, fresh); return; }
    // Switching starts the other mode already; only the loaded mode needs Play.
    if (m !== useGame.getState().mode) { inMode(m); return; }
    useGame.getState().play();
  };
  // Challenge Mode restarts its first week; Guided Mode starts separate practice and keeps the saved company.
  const replayTutorial = (m: GameMode) => inMode(m, () => {
    if (m === "classic") { useGame.getState().startTutorialRun("home"); return; }
    useGame.getState().play();
    useGame.getState().startTour("campaign", "home");
  });
  return { unsaved, playMode, newGame: (m: GameMode) => inMode(m, fresh), replayTutorial };
}
