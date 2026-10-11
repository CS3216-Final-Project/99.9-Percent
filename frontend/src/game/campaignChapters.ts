import type { GameState } from "@/sim";
import { canEnterReliability } from "@/sim/reliability";
import { campaignGuidance } from "./campaignGuidance";

/** Presentation only: chapter status follows the existing progression gates. */
export function campaignChapters(game: GameState) {
  const c = game.campaign!;
  const model = campaignGuidance(game);
  const chapters = [
    { id: "opening", name: "Opening", shortName: "Opening", description: "Inspect your first bottleneck and keep the company serving traffic.", completed: model.openingDone, available: false },
    { id: "scaling", name: "Scaling & Routing", shortName: "Scaling & Routing", description: "Expand server capacity and make sure traffic reaches it.", completed: !!c.dataStage, available: model.openingDone },
    { id: "data", name: "Data Strategy", shortName: "Data Strategy", description: "Explore how caching and different workloads affect your database.", completed: !!c.spikeStage, available: model.dataAvailable },
    { id: "spikes", name: "Traffic Spikes & Autoscaling", shortName: "Traffic Spikes", description: "Handle changing demand and explore automatic scaling.", completed: !!c.spikeStage?.acknowledged, available: model.spikesAvailable },
    { id: "reliability", name: "Stay Online", shortName: "Stay Online", description: "Prepare for application failures and keep service running.", completed: !!c.reliabilityStage?.acknowledged, available: canEnterReliability(game) },
  ];
  return chapters.map((chapter, index) => {
    const current = chapter.name === model.stage;
    const status = chapter.completed ? "Completed" : current ? "Current" : chapter.available ? "Available next" : "Locked";
    return { ...chapter, number: index + 1, current, status };
  });
}
