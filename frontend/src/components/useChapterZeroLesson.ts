import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { useGame } from "@/game/store";
import type { LessonId } from "@/game/walkthrough";
import { confirmingAction, confirmationCancelCount, setConfirming, subscribeConfirming } from "./actionConfirmation";
import type { ChapterZeroLesson } from "./chapterZeroLessons";
import { useChapterZeroControls, type ChapterZeroControlOptions } from "./useChapterZeroControls";

/** Lessons whose Next waits for the real exercise; the rest are read and continued. */
export const REQUIRED = new Set<LessonId>(["inspect-app", "inspect-db", "run", "quote", "speed"]);
/** Exercises that open the next lesson as soon as they are done. Inspections wait for Next, so the readings can be read.
 * Cancel needs no exercise: Next closes the quote too, but cancelling it moves on just the same. */
const AUTO = new Set<LessonId>(["run", "quote", "cancel", "speed"]);

export interface ChapterZeroLessonOptions extends ChapterZeroControlOptions {
  /** Inspected readings scroll their demand, capacity and backlog rows into view first, as a short screen does. */
  readingsFirst?: boolean;
}

/**
 * The state and rules of Chapter 0's current lesson, shared by every presentation of the guide (the desktop's
 * floating card and the phone's coach strip): which lesson is open, whether its exercise is done, what the spotlight
 * points at, the input boundary, and moving on. `card` and `heading` are the presentation's own elements: the lesson
 * scrolls the card to its top and focuses the heading when it opens.
 */
export function useChapterZeroLesson(lessons: readonly ChapterZeroLesson[], card: RefObject<HTMLElement | null>, heading: RefObject<HTMLElement | null>, { readingsFirst = false, ...controls }: ChapterZeroLessonOptions = {}) {
  const s = useGame(), index = s.tour?.step ?? 0;
  const confirming = useSyncExternalStore(subscribeConfirming, confirmingAction);
  const cancellations = useSyncExternalStore(subscribeConfirming, confirmationCancelCount);
  const [readyFor, setReadyFor] = useState<number | null>(null);
  const [completedThrough, setCompletedThrough] = useState(Math.max(index, s.meta.walkthroughFurthestStep ?? 0) - 1);
  const entry = useRef({ index, speed: s.speed, cancellations });
  const lesson = lessons[index], id = lesson?.id;
  const reviewed = index <= completedThrough;
  const required = !!id && REQUIRED.has(id);
  const ready = !required || reviewed || readyFor === index;
  // A lesson finished just now moves on by itself; one revisited with Back waits for Next. An open Menu holds it.
  const moving = !!id && AUTO.has(id) && !reviewed && readyFor === index && s.view !== "menu";
  useChapterZeroControls(id, confirming, controls);

  useEffect(() => {
    const now = useGame.getState();
    entry.current = { index, speed: now.speed, cancellations: confirmationCancelCount() };
    if (id !== "quote" && id !== "cancel") setConfirming(null);
    if (id === "goal" || id === "inspect-app") now.select(null);
    // Each exercise opens the panel tab it is done in.
    if (id === "quote" || id === "cancel") now.setPanelTab("actions");
    else if (id === "inspect-app" || id === "inspect-db" || id === "warnings") now.setPanelTab("analysis");
    card.current?.scrollTo?.({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, [index, id, card, heading]);

  useEffect(() => {
    if (entry.current.index !== index) return;
    const done = id === "inspect-app" ? s.selected === "app"
      : id === "inspect-db" ? s.selected === "db"
      : id === "run" ? !!s.tour?.clockUntil && s.game.campaign!.step >= s.tour.clockUntil && !s.running
      : id === "quote" ? !!confirming
      : id === "cancel" ? cancellations > entry.current.cancellations && !confirming
      : id === "speed" ? s.speed !== entry.current.speed
      : false;
    if (done) setReadyFor(index);
  }, [index, id, confirming, cancellations, s.selected, s.speed, s.running, s.game.campaign, s.tour]);

  // A reload or an earlier dismissal must never leave the Cancel instruction without a real quote.
  useEffect(() => {
    if (id !== "cancel" || confirming || readyFor === index || cancellations > entry.current.cancellations) return;
    const control = document.querySelector('.campaign-panel .act:not(:disabled)') ?? document.querySelector('.campaign-panel .act');
    const action = control?.closest('[data-campaign-action]')?.getAttribute('data-campaign-action');
    if (action) setConfirming(action);
    // The quote's controls exist once the Actions tab, opened on entry, has rendered.
  }, [id, index, confirming, cancellations, readyFor, s.panelTab]);

  const next = () => {
    const now = useGame.getState(), step = now.tour?.step ?? 0;
    setCompletedThrough(c => Math.max(c, step));
    if (!(lessons[step]?.id === "quote" && confirmingAction())) now.openView(null);
    if (step === lessons.length - 1) now.endTour(true); else now.tourNext();
  };
  const advance = useRef(next);
  useEffect(() => { advance.current = next; });
  useEffect(() => { if (moving) advance.current(); }, [moving]);

  // Once a component is inspected, its readings are what the player should look at.
  const inspected = id === "inspect-app" && s.selected === "app" || id === "inspect-db" && s.selected === "db";
  const target = inspected ? '.campaign-evidence'
    : id === "inspect-app" ? '[data-tutorial="inspect-app"]'
    : id === "inspect-db" ? '[data-tutorial="inspect-db"]'
    : id === "warnings" ? '.incident-symptoms'
    : id === "run" ? '.campaign-play'
    : id === "quote" ? confirming ? '.campaign-action-confirm' : '.campaign-panel .act:not(:disabled)'
    : id === "cancel" ? confirming ? '.campaign-action-confirm .btn-row button:last-child' : null
    : id === "money" ? '.stat-cash'
    : id === "speed" ? '.campaign-clock .time-menu'
    : null;
  // The whole quote is lit while it is being read; its Cancel is the control the reading layer keeps clear of.
  const lit = id === "quote" || id === "cancel" ? confirming ? '.campaign-action-popover' : target : target;

  useEffect(() => {
    if (!target) return;
    const el = document.querySelector<HTMLElement>(target);
    if (!el) return;
    el.classList.add("chapter-zero-target");
    // A short screen shows little of the panel: the numbers themselves go to its top.
    const shown = (inspected && (readingsFirst || window.innerHeight < 500) && el.querySelector<HTMLElement>(".evidence-rows")) || (lit && document.querySelector<HTMLElement>(lit)) || el;
    let frame = 0;
    // Readings start at the top of the panel, leaving the most room for the numbers.
    const block = inspected ? "start" : shown === el && el.closest(".campaign-panel") ? "center" : "nearest";
    const reveal = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => shown.scrollIntoView?.({ block, inline: "nearest" }));
    };
    // The room, responsive panel and local fonts can finish sizing after the first render.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(reveal);
    for (const node of [el, document.querySelector(".stage"), document.querySelector(".campaign-panel")]) if (node) observer?.observe(node);
    reveal();
    return () => { observer?.disconnect(); cancelAnimationFrame(frame); el.classList.remove("chapter-zero-target"); };
    // A lesson's control can be on the panel tab its entry has just brought forward.
  }, [target, lit, inspected, index, readingsFirst, s.panelTab]);
  useEffect(() => () => setConfirming(null), []);

  const why = lesson ? typeof lesson.why === "function" ? lesson.why(s) : lesson.why : undefined;
  const more = lesson ? typeof lesson.more === "function" ? lesson.more(s) : lesson.more : undefined;
  return { s, index, lesson, id, confirming, reviewed, required, ready, done: readyFor === index, moving, inspected, target, lit, why, more, last: index === lessons.length - 1, next };
}
