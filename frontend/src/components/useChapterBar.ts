import { campaignChapters, chapterAdvance } from "@/game/campaignChapters";
import { campaignGuidance, campaignObjective } from "@/game/campaignGuidance";
import { useGame } from "@/game/store";
import { chapterInScope, scopeAllows, SCOPED_CHAPTERS, type ScopedChapter } from "@/game/scope";

/** Small counts as words, for sentences such as "play two chapters". */
export const COUNT_WORDS = ["no", "one", "two", "three", "four", "five", "six"];

/**
 * What the chapter bar shows, in every edition: the walkthrough or chapter in progress, its goal, and Next while the
 * existing progression gates offer it. Chapters beyond the edition's scope are left out.
 */
export function useChapterBar() {
  const game = useGame((s) => s.game);
  const tutorialDone = useGame(s => s.meta.tutorialDone);
  const learning = useGame(s => s.tour?.track === "campaign");
  const scope = useGame(s => s.scope);
  const chapters = campaignChapters(game, learning, tutorialDone)
    .filter(chapter => chapter.number === 0 || chapterInScope(scope, chapter.id as ScopedChapter));
  const current = chapters.find((chapter) => chapter.current) ?? chapters.at(-1)!;
  const total = SCOPED_CHAPTERS.filter(id => chapterInScope(scope, id)).length;
  // A chapter beyond this edition's Guided Mode is never offered as Next.
  const offered = learning ? null : chapterAdvance(game);
  const advance = offered && scopeAllows(scope, offered.action) ? offered : null;
  const guidance = campaignGuidance(game);
  const reason = advance && !advance.ready ? guidance.notice ?? guidance.lockReason : null;
  const goal = learning ? "Learn the controls, game time and finances before running your company." : campaignObjective(game);
  return { learning, tutorialDone, chapters, current, total, advance, reason, goal };
}
