import type { TourTrack } from "@/game/store";
import { useGame } from "@/game/store";
import Tutorial from "@/components/Tutorial";
import type { SheetState } from "../layout/sheetState";
import { useDockOffset, useGuideSheet } from "../tutorial/coachLayout";
import PhoneChapterZeroGuide from "../tutorial/PhoneChapterZeroGuide";
import "../tutorial/phone-tutorial.css";

/** How far each spotlight guide opens the System metrics sheet: chapter guides point at the chapter's new controls. */
const GUIDE_SHEET: Partial<Record<TourTrack, SheetState>> = { scaling: "half", data: "half", spikes: "half", reliability: "half", combined: "half" };

/**
 * Region: coach. The guide that teaches the game: Chapter 0's lessons, chapter guides and Challenge Mode's first week.
 * Every guide uses the same coach strip, docked directly above the dock, so the room stays in view.
 */
export function PhoneCoach() {
  const started = useGame((s) => s.started);
  if (!started) return null;
  return <Coach />;
}

function Coach() {
  const track = useGame((s) => s.tour?.track);
  useDockOffset();
  // Chapter 0 opens the sheet per lesson itself.
  useGuideSheet(track && track !== "campaign" ? GUIDE_SHEET[track] ?? null : null);
  return <Tutorial chapterZero={PhoneChapterZeroGuide} />;
}
