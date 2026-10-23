import { canEnterCombined } from "@/sim/combinedCampaign";
import type { Action, GameState } from "@/sim";
import { canEnterReliability } from "@/sim/reliability";
import { campaignGuidance } from "./campaignGuidance";
import type { AnnouncedChapter } from "./persist";

/** Presentation only: chapter status follows the existing progression gates. */
export function campaignChapters(game: GameState, tutorialDone = true) {
  const c = game.campaign!;
  const model = campaignGuidance(game);
  const chapters = [
    ...(c.launchWeek
      ? [{ id: "launch-week", name: "Launch Week", shortName: "Launch Week", description: "One week of launch traffic and its first database overload.", completed: model.openingDone, available: true }]
      : [
        { id: "getting-started", name: "Walkthrough", shortName: "Walkthrough", description: "The retired lesson walkthrough, counted complete on version-1 companies.", completed: tutorialDone, available: true },
        { id: "opening", name: "Opening", shortName: "Opening", description: "Inspect your first bottleneck and keep the company serving traffic.", completed: model.openingDone, available: tutorialDone },
      ]),
    { id: "scaling", name: "Scaling & Routing", shortName: "Scaling & Routing", description: "Expand server capacity and make sure traffic reaches it.", completed: !!c.dataStage, available: model.openingDone },
    { id: "data", name: "Data Strategy", shortName: "Data Strategy", description: "Explore how caching and different workloads affect your database.", completed: !!c.spikeStage, available: model.dataAvailable },
    { id: "spikes", name: "Traffic Spikes & Autoscaling", shortName: "Traffic Spikes", description: "Handle changing demand and explore automatic scaling.", completed: !!c.spikeStage?.acknowledged, available: model.spikesAvailable },
    { id: "reliability", name: "Stay Online", shortName: "Stay Online", description: "Prepare for application failures and keep service running.", completed: !!c.reliabilityStage?.acknowledged, available: canEnterReliability(game) },
    { id: "combined", name: "Grow the Company", shortName: "Grow the Company", description: "Serve growing demand, review each growth outcome and complete the company campaign.", completed: !!c.combinedStage?.acknowledged, available: canEnterCombined(game) },
  ];
  return chapters.map((chapter, index) => {
    const current = chapter.name === model.stage;
    const status = chapter.completed ? "Completed" : current ? "Current" : chapter.available ? "Available next" : "Locked";
    return { ...chapter, number: index, current, status };
  });
}

const CHAPTER_ENTRIES: ReadonlySet<Action["type"]> = new Set(["enter_scaling", "enter_data", "enter_spikes", "enter_reliability", "enter_combined"]);

/** Whether an action moves the company into the next chapter. */
export const isChapterEntry = (action: Action) => CHAPTER_ENTRIES.has(action.type);

/** The chapter whose requirements are met while the company waits for the player to continue past it. */
export function finishedChapter(game: GameState): AnnouncedChapter | null {
  const next = campaignGuidance(game).pendingAction?.action?.type;
  return next === "enter_data" ? "scaling" : next === "enter_spikes" ? "data" : null;
}
