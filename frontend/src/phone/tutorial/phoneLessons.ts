import type { LessonId } from "@/game/walkthrough";
import type { SheetState } from "../layout/sheetState";

/** What the coach strip needs to know about the lesson's state to word its one-line task. */
export interface TaskState {
  /** The lesson's exercise is done (or it has nothing to do). */
  ready: boolean;
  /** The lesson's exercise was just done, as opposed to having nothing to do. */
  done: boolean;
  /** A real purchase quote is open. */
  quoting: boolean;
}

/**
 * The phone's presentation of a Chapter 0 lesson. The lesson itself (its title, reason, exercise and spotlight) is
 * shared with the desktop in chapterZeroLessons.ts and useChapterZeroLesson.ts; this only says how a phone shows it.
 */
export interface PhoneLesson {
  /** The strip's one-line task: at most about 48 characters, so it fits two lines at 320 px. Touch wording. */
  task: (state: TaskState) => string;
  /** How far the System metrics sheet opens so the lesson's real control is in view. */
  sheet: SheetState;
  /** Whether the lesson's small labelled example appears under Learn more. Live readings stay in the real panel. */
  example?: boolean;
}

export const PHONE_LESSONS: Record<LessonId, PhoneLesson> = {
  goal: { task: () => "Keep it fast and online without running out of cash.", sheet: "peek", example: true },
  "inspect-app": {
    task: ({ ready }) => ready ? "Read its demand and capacity in the panel." : "Tap the highlighted App Server.",
    sheet: "half",
  },
  "inspect-db": {
    task: ({ ready }) => ready ? "Compare it with the App Server." : "Now tap Database and compare.",
    sheet: "half",
  },
  warnings: { task: () => "Find Latency, Errors and Backlog in the panel.", sheet: "half", example: true },
  run: { task: () => "Press Run. Time stops after one game second.", sheet: "peek" },
  quote: { task: () => "Tap any action under Actions to see its quote.", sheet: "half" },
  cancel: {
    task: ({ done, quoting }) => quoting ? "Press Next to close the quote without buying." : done ? "Quote closed. Your cash is unchanged." : "Reopening a quote for you…",
    sheet: "half",
  },
  money: { task: () => "Cash is in the top bar.", sheet: "peek" },
  speed: { task: () => "Open the speed menu and pick another speed.", sheet: "peek" },
  ready: { task: () => "Inspect, decide, run. Press Finish to begin.", sheet: "peek", example: true },
};

/** The short label pinned to the lit control on a touch screen. */
export const PHONE_CTA: Partial<Record<LessonId, string>> = { "inspect-app": "Tap", "inspect-db": "Tap", run: "Press Run", quote: "Open one", speed: "Change speed" };
