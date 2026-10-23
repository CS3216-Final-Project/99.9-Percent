import type { GameState } from "@/sim";
import { chapterInScope, PHONE_SCOPE, scopeComplete, SCOPED_CHAPTERS, type ScopedChapter } from "@/game/scope";
import { savedChapter, type Summary } from "@/components/homeModes";

/** Guided Mode on a phone: the walkthrough and the chapters up to the phone scope's last one. */
export const PHONE_CHAPTERS = SCOPED_CHAPTERS.filter((id) => chapterInScope(PHONE_SCOPE, id)).length;

/** How the phone home screen describes a Guided Mode save: its chapter out of the phone's, or the campaign done. */
export function phoneCampaignSummary(game: GameState | null, tutorialDone: boolean): Summary {
  if (!game?.campaign) return { progress: null, resumable: false, ended: false, tutorialDone, continueLabel: "Start Guided Mode" };
  const ended = game.phase === "ended";
  const { chapter, done } = savedChapter(game, tutorialDone);
  const progress = ended ? "Company closed"
    : scopeComplete(PHONE_SCOPE, game) || (chapter.number > 0 && !chapterInScope(PHONE_SCOPE, chapter.id as ScopedChapter)) ? "Phone campaign complete"
    : chapter.number === 0 ? "Walkthrough in progress" : `Chapter ${chapter.number} of ${PHONE_CHAPTERS}: ${chapter.name}`;
  return { progress, resumable: true, ended, tutorialDone, continueLabel: ended ? "See how it ended" : "Continue company", chapter: chapter.number, chapterDone: done };
}

