import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useGame } from "@/game/store";
import type { LessonId } from "@/game/walkthrough";
import { Icon } from "./icons";
import LessonVisual from "./ChapterZero";
import { confirmingAction, confirmationCancelCount, setConfirming, subscribeConfirming } from "./actionConfirmation";
import type { ChapterZeroLesson } from "./chapterZeroLessons";
import { useChapterZeroControls } from "./useChapterZeroControls";
import { cardStyle, placeFor, useTargetBox } from "./spotlight";
import "./ChapterZero.css";

/** Lessons whose Next waits for the real exercise; the rest are read and continued. */
const REQUIRED = new Set<LessonId>(["inspect-app", "inspect-db", "run", "quote", "cancel", "speed"]);
/** The short label pinned to the lit control. */
const CTA: Partial<Record<LessonId, string>> = { "inspect-app": "Click", "inspect-db": "Click", run: "Press Run", quote: "Open one", cancel: "Cancel", speed: "Change speed" };
const KEYS: Partial<Record<LessonId, ReactNode>> = {
  run: <><kbd className="lesson-keycap">P</kbd> also runs and pauses.</>,
  speed: <><kbd className="lesson-keycap">Q</kbd> / <kbd className="lesson-keycap">E</kbd> rotate the view; <kbd className="lesson-keycap" aria-label="Page Up">PgUp</kbd> / <kbd className="lesson-keycap" aria-label="Page Down">PgDn</kbd> switch floors.</>,
};
/** How long a finished exercise shows its tick before the next lesson opens. */
const CELEBRATE_MS = 900;
const CARD_WIDTH = 360;

function LessonText({ text, terms = [] }: { text?: string; terms?: readonly string[] }) {
  if (!text || !terms.length) return text;
  const phrases = [...terms].sort((a, b) => b.length - a.length).map(term => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`\\b(${phrases.join("|")})\\b`, "gi"));
  return parts.map((part, i) => i % 2 ? <strong className="lesson-key" key={i}>{part}</strong> : part);
}

const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Nonmodal guidance beside the real, playable game: everything but the current lesson's control is dimmed, and a
 * card next to that control says what to do. The game's own dialogs and keyboard controls keep working.
 */
export default function ChapterZeroGuide({ lessons }: { lessons: readonly ChapterZeroLesson[] }) {
  const s = useGame(), index = s.tour?.step ?? 0;
  const confirming = useSyncExternalStore(subscribeConfirming, confirmingAction);
  const cancellations = useSyncExternalStore(subscribeConfirming, confirmationCancelCount);
  const [readyFor, setReadyFor] = useState<number | null>(null);
  const [completedThrough, setCompletedThrough] = useState(Math.max(index, s.meta.walkthroughFurthestStep ?? 0) - 1);
  const entry = useRef({ index, speed: s.speed, cancellations });
  const card = useRef<HTMLElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const [cardHeight, setCardHeight] = useState(260);
  const lesson = lessons[index], id = lesson?.id;
  const reviewed = index <= completedThrough;
  const required = !!id && REQUIRED.has(id);
  const ready = !required || reviewed || readyFor === index;
  // A lesson finished just now moves on by itself; one revisited with Back waits for Next. An open Menu holds it.
  const celebrating = required && !reviewed && readyFor === index && s.view !== "menu";
  useChapterZeroControls(id, confirming);

  useEffect(() => {
    const now = useGame.getState();
    entry.current = { index, speed: now.speed, cancellations: confirmationCancelCount() };
    if (id !== "quote" && id !== "cancel") setConfirming(null);
    if (id === "goal" || id === "inspect-app") now.select(null);
    if (card.current) card.current.scrollTop = 0;
    heading.current?.focus({ preventScroll: true });
  }, [index, id]);

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
  }, [id, index, confirming, cancellations, readyFor]);

  const next = () => {
    const now = useGame.getState(), step = now.tour?.step ?? 0;
    setCompletedThrough(c => Math.max(c, step));
    if (!(lessons[step]?.id === "quote" && confirmingAction())) now.openView(null);
    if (step === lessons.length - 1) now.endTour(true); else now.tourNext();
  };
  const advance = useRef(next);
  useEffect(() => { advance.current = next; });
  useEffect(() => {
    if (!celebrating) return;
    const timer = window.setTimeout(() => advance.current(), reducedMotion() ? 0 : CELEBRATE_MS);
    return () => window.clearTimeout(timer);
  }, [celebrating]);

  const target = id === "inspect-app" ? '[data-tutorial="inspect-app"]'
    : id === "inspect-db" ? '[data-tutorial="inspect-db"]'
    : id === "warnings" ? '.incident-symptoms'
    : id === "run" ? '.campaign-play'
    : id === "quote" ? confirming ? '.campaign-action-confirm' : '.campaign-panel .act:not(:disabled)'
    : id === "cancel" ? confirming ? '.campaign-action-confirm .btn-row button:last-child' : null
    : id === "money" ? '.stat-cash'
    : id === "speed" ? '.campaign-clock .time-menu'
    : null;
  // The whole quote is lit while it is being read; its Cancel is what the ring points at.
  const lit = id === "quote" || id === "cancel" ? confirming ? '.campaign-action-popover' : target : target;
  const { box, covered, viewport } = useTargetBox(lit);

  useEffect(() => {
    if (!target) return;
    const el = document.querySelector<HTMLElement>(target);
    if (!el) return;
    el.classList.add("chapter-zero-target");
    let frame = 0;
    const reveal = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => el.scrollIntoView?.({ block: el.closest(".campaign-panel") ? "center" : "nearest", inline: "nearest" }));
    };
    // The room, responsive panel and local fonts can finish sizing after the first render.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(reveal);
    for (const node of [el, document.querySelector(".stage"), document.querySelector(".campaign-panel")]) if (node) observer?.observe(node);
    reveal();
    return () => { observer?.disconnect(); cancelAnimationFrame(frame); el.classList.remove("chapter-zero-target"); };
  }, [target, index]);
  useEffect(() => () => setConfirming(null), []);
  // The card's height decides whether it fits above or below the lit control.
  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    const measure = () => { const height = el.getBoundingClientRect().height; if (height) setCardHeight(h => Math.abs(h - height) > 1 ? height : h); };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(el);
    return () => observer?.disconnect();
  }, [index, s.started]);

  if (!s.started || !lesson) return null;
  const why = typeof lesson.why === "function" ? lesson.why(s) : lesson.why;
  const more = typeof lesson.more === "function" ? lesson.more(s) : lesson.more;
  const task = id === "inspect-app" ? "Click App Server under Inspect equipment."
    : id === "inspect-db" ? "Now click Database and compare."
    : id === "warnings" ? "Find Latency, Errors and Backlog in the panel."
    : id === "run" ? "Press Run. Time stops again after one game second."
    : id === "quote" ? "Open any action under Actions to see its quote."
    : id === "cancel" ? confirming ? "Press Cancel on the quote." : ready ? "Quote closed. Your cash is unchanged." : "Reopening a quote for you…"
    : id === "money" ? "Cash is in the top bar."
    : id === "speed" ? "Open the speed menu and pick another speed."
    : null;
  const last = index === lessons.length - 1;
  // A real dialog over the game (Menu, Finance) has the player's attention; the guide waits behind it.
  // Menu and sound stay reachable above a card docked to the top of a phone.
  const topbar = typeof document === "undefined" ? undefined : document.querySelector(".topbar")?.getBoundingClientRect().bottom;
  const position = cardStyle(target ? box : null, placeFor(lit ?? ""), viewport.w, viewport.h, viewport.w, cardHeight, CARD_WIDTH, topbar ? Math.round(topbar) + 8 : 12);
  return <>
    {!covered && <div className={`cz-spotlight${box && target ? "" : " is-full"}`} aria-hidden="true"
      style={box && target ? { left: box.x, top: box.y, width: box.w, height: box.h } : undefined}>
      {box && target && CTA[id!] && !ready && <span className={`cz-cta${box.y < 60 ? " is-below" : ""}`}>{CTA[id!]}</span>}
    </div>}
    <section ref={card} role="dialog" aria-modal="false" aria-label={`Walkthrough, step ${index + 1} of ${lessons.length}`}
      data-lesson={index} data-lesson-id={id} hidden={covered} style={position}
      className={`chapter-zero-guide${target && box ? " is-pointing" : " is-centred"}`} onKeyDown={event => {
        if (event.key !== "Tab" || event.shiftKey || event.target !== heading.current || ready || !target) return;
        const highlighted = document.querySelector<HTMLElement>(target);
        const control = highlighted?.matches("button:not(:disabled)") ? highlighted
          : highlighted?.querySelector<HTMLElement>("summary, button:not(:disabled)");
        if (control) { event.preventDefault(); control.focus(); }
      }}>
      <header className="lesson-meta">
        <span className="lesson-section">{s.tutorialCompany ? "Practice · " : ""}{lesson.section}</span>
        <span className="lesson-count" aria-label={`Lesson ${index + 1} of ${lessons.length}`}>
          <span className="lesson-dots" aria-hidden="true">{lessons.map((l, i) => <i key={l.id} className={i < index ? "is-done" : i === index ? "is-now" : ""} />)}</span>
          {index + 1} / {lessons.length}
        </span>
      </header>
      {s.meta.tutorialDone && <button className="btn btn-small lesson-return" onClick={() => { s.openView(null); s.endTour(false); }}><Icon name="next" size={16} />Return to game</button>}
      <h3 ref={heading} tabIndex={-1}>{lesson.title}</h3>
      {task && <p className="lesson-task"><Icon name={celebrating || (ready && required) ? "check" : "eye"} size={20} /><span><LessonText text={task} terms={lesson.emphasis} /></span></p>}
      {required && ready && <p className="lesson-result" role="status">{celebrating ? "Nice. Moving on…" : reviewed ? "Completed earlier. You can try it again." : "Done."}</p>}
      <p className="lesson-why">{why}</p>
      {s.tutorialCompany && index === 0 && <p className="lesson-note">This is a practice company. Your saved company is paused and comes back when you finish or exit.</p>}
      <LessonVisual id={id!} />
      {(more || KEYS[id!]) && <details className="lesson-more"><summary>Learn more</summary>{more && <p>{more}</p>}{KEYS[id!] && <p>{KEYS[id!]}</p>}</details>}
      <footer className="lesson-footer">
        <button className="btn" disabled={index === 0} onClick={() => { s.openView(null); s.tourBack(); }}><Icon className="lesson-back-arrow" name="next" size={16} />Back</button>
        <button className="btn btn-primary" disabled={!ready || celebrating || s.running} onClick={next}>{last ? "Finish walkthrough" : "Next"}<Icon name={last ? "check" : "next"} size={16} /></button>
      </footer>
    </section>
  </>;
}
