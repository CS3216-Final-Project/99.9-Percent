import type { Action, GameState } from "@/sim";
import { pendingSpikeAcknowledgement } from "@/sim/autoscaling";
import { canCompleteCampaign, completionGates } from "@/sim/campaignCompletion";
import { canEnterReliability, pendingReliability, reliabilityEntryGates } from "@/sim/reliability";
import { applyCampaignInput } from "@/sim/step";
import { campaignChapters, finishedChapter, isChapterEntry } from "./campaignChapters";
import { campaignGuidance, launchResearchPending, milestoneBlocks } from "./campaignGuidance";
import { entryBlockers } from "./entryGates";
import { FULL_SCOPE, scopeAllows, type PlayScope } from "./scope";

/** A Guided Mode chapter that ends with a choice: one followed by another chapter, or Stay Online, the last. */
export type EndedChapter = "opening" | "scaling" | "data" | "spikes" | "reliability";

/**
 * The end of a chapter, while the company waits for the player to choose: stay and keep operating, or continue into
 * the next chapter. After Stay Online, the last chapter, Continue completes the campaign instead. Recognitions
 * (Opening, Traffic Spikes, Stay Online) are acknowledged by either choice.
 */
export interface ChapterEnd {
  chapter: EndedChapter;
  next: { name: string; description: string };
  /** Continue completes the campaign rather than entering another chapter. */
  final: boolean;
  /** Applied in order for Stay in this chapter; empty when there is nothing to acknowledge. */
  stay: Action[];
  /** Applied in order for Continue; null when this edition's Guided Mode ends here. */
  proceed: Action[] | null;
  label: string;
  /** Why Continue is not possible yet; empty when it is. */
  blockers: string[];
}

/** The control that moves the company into the next chapter, while one is on offer. */
export interface ChapterAdvance { label: string; action: Action; ready: boolean; blockers: string[] }

const NEXT_CHAPTER: Record<Exclude<EndedChapter, "reliability">, string> = { opening: "scaling", scaling: "data", data: "spikes", spikes: "reliability" };
/** What Continue offers after Stay Online, the last chapter. */
const COMPLETION = { name: "Complete campaign", description: "End the run and review the company's final scorecard." };

/** Whether the company has just finished a chapter and waits for the player to stay or continue. */
export function chapterEnd(game: GameState, scope: PlayScope = FULL_SCOPE): ChapterEnd | null {
  const c = game.campaign;
  if (!c || game.phase === "ended") return null;
  const end = (chapter: Exclude<EndedChapter, "reliability">, stay: Action[], proceed: Action[], blockers: string[] = []): ChapterEnd => {
    const next = campaignChapters(game).find(x => x.id === NEXT_CHAPTER[chapter])!;
    return { chapter, next: { name: next.name, description: next.description }, final: false, stay, proceed: scopeAllows(scope, proceed.at(-1)!) ? proceed : null, label: `Continue to ${next.shortName}`, blockers };
  };
  if (pendingReliability(c)) {
    const ack: Action = { type: "acknowledge_reliability" };
    const after = applyCampaignInput(game, ack).state;
    return { chapter: "reliability", next: COMPLETION, final: true, stay: [ack], proceed: [ack, { type: "complete_campaign" }], label: COMPLETION.name,
      blockers: entryBlockers(canCompleteCampaign(after), completionGates(after), "Stay Online") };
  }
  if (pendingSpikeAcknowledgement(c)) {
    const ack: Action = { type: "acknowledge_spikes" };
    const after = applyCampaignInput(game, ack).state;
    return end("spikes", [ack], [ack, { type: "enter_reliability" }], entryBlockers(canEnterReliability(after), reliabilityEntryGates(after), "Traffic Spikes"));
  }
  // Launch Week's score card waits for its research pick.
  if (milestoneBlocks(game) && !launchResearchPending(game))
    return end("opening", [{ type: "acknowledge_milestone", enterScaling: false }], [{ type: "acknowledge_milestone", enterScaling: true }]);
  const finished = finishedChapter(game);
  if (finished) return end(finished, [], [campaignGuidance(game).pendingAction!.action!]);
  return null;
}

/**
 * The next chapter on offer in the chapter bar, or Complete campaign after Stay Online. Stay Online and Complete
 * campaign stay on offer after their predecessor's recognition, disabled with the reasons, until the company is ready.
 */
export function chapterAdvance(game: GameState): ChapterAdvance | null {
  const c = game.campaign!;
  const next = campaignGuidance(game).pendingAction;
  if (next?.action && isChapterEntry(next.action)) return { label: next.label, action: next.action, ready: true, blockers: [] };
  if (game.phase === "ended") return null;
  if (!c.reliabilityStage && c.spikeStage?.acknowledged) return offer("Continue to Stay Online", { type: "enter_reliability" }, canEnterReliability(game), reliabilityEntryGates(game), "Traffic Spikes");
  if (c.reliabilityStage?.acknowledged) return offer(COMPLETION.name, { type: "complete_campaign" }, canCompleteCampaign(game), completionGates(game), "Stay Online");
  return null;
}

function offer(label: string, action: Action, ready: boolean, gates: Record<string, boolean>, previous: string): ChapterAdvance {
  return { label, action, ready, blockers: entryBlockers(ready, gates, previous) };
}
