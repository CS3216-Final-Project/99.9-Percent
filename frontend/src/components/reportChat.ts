import type { CSSProperties } from "react";
import { avatarPicture } from "@/game/avatars";
import { reportSpeaker } from "@/game/chapterCompanyMessage";
import { colleaguePortrait } from "@/game/colleagues";
import { useGame } from "@/game/store";

/** A bubble's turn in the popup's chat-like entrance: each question, then its answer. */
export const chatTurn = (turn: number) => ({ "--turn": turn }) as CSSProperties;
/**
 * The colleague of the chapter the report is about asks the questions and the player's avatar answers them, so each
 * bubble carries a small picture of its speaker. `at` is the game second the report speaks for.
 */
export function useReportSpeakers(at: number) {
  const colleague = useGame(s => s.game.campaign ? reportSpeaker(s.game.campaign, at) : null);
  const avatar = useGame(s => s.avatar);
  if (!colleague) return {};
  return { "data-speaker": colleague, style: { "--report-player": `url("${avatarPicture(avatar)}")`, "--report-colleague": `url("${colleaguePortrait(colleague).src}")` } as CSSProperties };
}
