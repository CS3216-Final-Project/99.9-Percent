import { campaignChapters } from "@/game/campaignChapters";
import { chapterAdvance } from "@/game/chapterCompletion";
import { campaignGuidance, campaignObjective } from "@/game/campaignGuidance";
import { useGame } from "@/game/store";
import { chapterInScope, scopeAllows, SCOPED_CHAPTERS, type ScopedChapter } from "@/game/scope";

/** Small counts as words, for sentences such as "play two chapters". */
export const COUNT_WORDS = ["no", "one", "two", "three", "four", "five", "six"];

/**
 * What the chapter bar shows, in every edition: Launch Week or the chapter in progress, its goal, and Next while the
 * existing progression gates offer it. Chapters beyond the edition's scope are left out, except the one the company
 * is in: a save continued from a larger screen can already be past the phone's last chapter, and the bar then names
 * the engine's chapter (the one the panel's checklist is headed with), counted out of all of Guided Mode's chapters.
 */
export function useChapterBar() {
  const game = useGame((s) => s.game);
  const tutorialDone = useGame(s => s.meta.tutorialDone);
  // Launch Week is replayed on a practice company while the real one waits.
  const replaying = useGame(s => !!s.tutorialCompany);
  const scope = useGame(s => s.scope);
  const all = campaignChapters(game, tutorialDone);
  const current = all.find((chapter) => chapter.current) ?? all.at(-1)!;
  const chapters = all.filter(chapter => chapter === current || chapter.number === 0 || chapterInScope(scope, chapter.id as ScopedChapter));
  /** The chapters this edition plays, for sentences such as "play two chapters". */
  const total = SCOPED_CHAPTERS.filter(id => chapterInScope(scope, id)).length;
  /** What the current chapter is counted out of: the edition's chapters, or all of them once the company is past those. */
  const of = current.number > total ? SCOPED_CHAPTERS.length : total;
  // A chapter beyond this edition's Guided Mode is never offered as Next.
  const offered = replaying ? null : chapterAdvance(game);
  const advance = offered && scopeAllows(scope, offered.action) ? offered : null;
  const guidance = campaignGuidance(game);
  const reason = advance && !advance.ready ? guidance.notice ?? guidance.lockReason : null;
  const goal = replaying ? "Replay Launch Week on a practice company; your real company is paused." : campaignObjective(game);
  return { replaying, tutorialDone, chapters, current, total, of, advance, reason, goal };
}
