import { campaignChapters } from "@/game/campaignChapters";
import { chapterAdvance } from "@/game/chapterCompletion";
import { campaignGuidance, campaignObjective } from "@/game/campaignGuidance";
import { useGame } from "@/game/store";
import { chapterInScope, scopeAllows, SCOPED_CHAPTERS, type ScopedChapter } from "@/game/scope";

/** Small counts as words, for sentences such as "play two chapters". */
export const COUNT_WORDS = ["no", "one", "two", "three", "four", "five", "six"];

/**
 * What the chapter bar shows, in every edition: Launch Week or the chapter in progress, its goal, and Next while the
 * existing progression gates offer it. Chapters beyond the edition's scope are left out.
 */
export function useChapterBar() {
  const game = useGame((s) => s.game);
  const tutorialDone = useGame(s => s.meta.tutorialDone);
  // Launch Week is replayed on a practice company while the real one waits.
  const replaying = useGame(s => !!s.tutorialCompany);
  const scope = useGame(s => s.scope);
  const chapters = campaignChapters(game, tutorialDone)
    .filter(chapter => chapter.number === 0 || chapterInScope(scope, chapter.id as ScopedChapter));
  const current = chapters.find((chapter) => chapter.current) ?? chapters.at(-1)!;
  const total = SCOPED_CHAPTERS.filter(id => chapterInScope(scope, id)).length;
  // A chapter beyond this edition's Guided Mode is never offered as Next.
  const offered = replaying ? null : chapterAdvance(game);
  const advance = offered && scopeAllows(scope, offered.action) ? offered : null;
  const guidance = campaignGuidance(game);
  const reason = advance && !advance.ready ? guidance.notice ?? guidance.lockReason : null;
  const goal = replaying ? "Replay Launch Week on a practice company; your real company is paused." : campaignObjective(game);
  return { replaying, tutorialDone, chapters, current, total, advance, reason, goal };
}
