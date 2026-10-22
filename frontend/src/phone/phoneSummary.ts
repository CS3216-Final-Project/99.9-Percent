import type { GameState } from "@/sim";
import { campaignChapters } from "@/game/campaignChapters";
import { chapterInScope, PHONE_SCOPE, scopeComplete, SCOPED_CHAPTERS, type ScopedChapter } from "@/game/scope";
import type { Summary } from "@/components/homeModes";

/** Guided Mode on a phone: the walkthrough and the chapters up to the phone scope's last one. */
export const PHONE_CHAPTERS = SCOPED_CHAPTERS.filter((id) => chapterInScope(PHONE_SCOPE, id)).length;

/** How the phone home screen describes a Guided Mode save: its chapter out of the phone's, or the campaign done. */
export function phoneCampaignSummary(game: GameState | null, tutorialDone: boolean): Summary {
  if (!game?.campaign) return { progress: null, resumable: false, ended: false, tutorialDone, continueLabel: "Start Guided Mode" };
  const ended = game.phase === "ended";
  const chapters = campaignChapters(game);
  const chapter = chapters.find((c) => c.current) ?? chapters.filter((c) => c.completed).at(-1) ?? chapters[0];
  const progress = ended ? "Company closed"
    : scopeComplete(PHONE_SCOPE, game) || (chapter.number > 0 && !chapterInScope(PHONE_SCOPE, chapter.id as ScopedChapter)) ? "Phone campaign complete"
    : `Chapter ${chapter.number} of ${PHONE_CHAPTERS}: ${chapter.name}`;
  return { progress, resumable: true, ended, tutorialDone, continueLabel: "Continue company" };
}

