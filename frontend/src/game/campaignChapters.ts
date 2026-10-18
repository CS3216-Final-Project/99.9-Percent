import { canEnterCombined } from "@/sim/combinedCampaign";
import type { Action, GameState } from "@/sim";
import { canEnterReliability } from "@/sim/reliability";
import { campaignGuidance } from "./campaignGuidance";
import type { ChapterCompletion } from "./persist";

/** Presentation only: chapter status follows the existing progression gates. */
export function campaignChapters(game: GameState, learning = false, tutorialDone = true) {
  const c = game.campaign!;
  const model = campaignGuidance(game);
  const chapters = [
    { id: "getting-started", name: "Getting started", shortName: "Getting started", description: "Chapter 0: learn the room, game seconds, weekly finances, controls, purchases, incidents and the route through the game. Replay without resetting your company.", completed: tutorialDone && !learning, available: true },
    { id: "opening", name: "Opening", shortName: "Opening", description: "Inspect your first bottleneck and keep the company serving traffic.", completed: model.openingDone, available: tutorialDone },
    { id: "scaling", name: "Scaling & Routing", shortName: "Scaling & Routing", description: "Expand server capacity and make sure traffic reaches it.", completed: !!c.dataStage, available: model.openingDone },
    { id: "data", name: "Data Strategy", shortName: "Data Strategy", description: "Explore how caching and different workloads affect your database.", completed: !!c.spikeStage, available: model.dataAvailable },
    { id: "spikes", name: "Traffic Spikes & Autoscaling", shortName: "Traffic Spikes", description: "Handle changing demand and explore automatic scaling.", completed: !!c.spikeStage?.acknowledged, available: model.spikesAvailable },
    { id: "reliability", name: "Stay Online", shortName: "Stay Online", description: "Prepare for application failures and keep service running.", completed: !!c.reliabilityStage?.acknowledged, available: canEnterReliability(game) },
    { id: "combined", name: "Grow the Company", shortName: "Grow the Company", description: "Serve growing demand, review each growth outcome and complete the company campaign.", completed: !!c.combinedStage?.acknowledged, available: canEnterCombined(game) },
  ];
  return chapters.map((chapter, index) => {
    const current = chapter.id === "getting-started" ? learning : !learning && chapter.name === model.stage;
    const status = chapter.id === "getting-started" && current && tutorialDone ? "In progress" : chapter.completed ? "Completed" : current ? "Current" : chapter.available ? "Available next" : "Locked";
    const objectives: Record<string, string> = {
      "getting-started": "Learn the controls, game time and finances before running your company.",
      opening: "Understand how bottlenecks affect reliable service.",
      scaling: "Understand how server capacity and routing work together.",
      data: "Understand how workloads and caching affect database demand.",
      spikes: "Keep your company reliable during sudden traffic spikes.",
      reliability: "Keep service available when application servers fail.",
      combined: "Keep a growing company reliable while serving full demand.",
    };
    return { ...chapter, objective: objectives[chapter.id], number: index, current, status };
  });
}

const CHAPTER_ENTRIES: ReadonlySet<Action["type"]> = new Set(["enter_scaling", "enter_data", "enter_spikes", "enter_reliability", "enter_combined"]);

/** Whether an action moves the company into the next chapter. */
export const isChapterEntry = (action: Action) => CHAPTER_ENTRIES.has(action.type);

/** The control that moves the company into the next chapter, while one is on offer. */
export function chapterAdvance(game: GameState): { label: string; action: Action; ready: boolean } | null {
  const c = game.campaign!;
  const next = campaignGuidance(game).pendingAction;
  if (next?.action && isChapterEntry(next.action)) return { label: next.label, action: next.action, ready: true };
  // Stay Online is announced once the spike response is acknowledged, and opens when the company is ready for it.
  if (!c.reliabilityStage && c.spikeStage?.acknowledged) return { label: "Continue to reliability", action: { type: "enter_reliability" }, ready: canEnterReliability(game) };
  return null;
}

/** The chapter whose requirements are met while the company waits for the player to continue past it. */
export function finishedChapter(game: GameState): ChapterCompletion | null {
  const next = campaignGuidance(game).pendingAction?.action?.type;
  return next === "enter_data" ? "scaling" : next === "enter_spikes" ? "data" : null;
}
