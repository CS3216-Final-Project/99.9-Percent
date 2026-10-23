import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { LessonId } from "@/game/walkthrough";
import { Icon } from "./icons";
import LessonVisual from "./ChapterZero";
import type { ChapterZeroLesson } from "./chapterZeroLessons";
import { useChapterZeroLesson } from "./useChapterZeroLesson";
import { cardStyle, placeFor, useTargetBox } from "./spotlight";
import "./ChapterZero.css";

/** The short label pinned to the lit control. */
const CTA: Partial<Record<LessonId, string>> = { "inspect-app": "Click", "inspect-db": "Click", run: "Press Run", quote: "Open one", speed: "Change speed" };
const KEYS: Partial<Record<LessonId, ReactNode>> = {
  run: <><kbd className="lesson-keycap">P</kbd> also runs and pauses.</>,
  speed: <><kbd className="lesson-keycap">Q</kbd> / <kbd className="lesson-keycap">E</kbd> rotate the view; <kbd className="lesson-keycap" aria-label="Page Up">PgUp</kbd> / <kbd className="lesson-keycap" aria-label="Page Down">PgDn</kbd> switch floors.</>,
};
const CARD_WIDTH = 360;

/** A lesson's instruction with its key controls and concepts in bold. */
export function LessonText({ text, terms = [] }: { text?: string; terms?: readonly string[] }) {
  if (!text || !terms.length) return text;
  const phrases = [...terms].sort((a, b) => b.length - a.length).map(term => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`\\b(${phrases.join("|")})\\b`, "gi"));
  return parts.map((part, i) => i % 2 ? <strong className="lesson-key" key={i}>{part}</strong> : part);
}

/**
 * Nonmodal guidance beside the real, playable game: everything but the current lesson's control is dimmed, and a
 * card next to that control says what to do. The game's own dialogs and keyboard controls keep working.
 */
export default function ChapterZeroGuide({ lessons }: { lessons: readonly ChapterZeroLesson[] }) {
  const card = useRef<HTMLElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const [cardHeight, setCardHeight] = useState(260);
  const { s, index, lesson, id, confirming, required, ready, done, moving, inspected, target, lit, why, more, last, next } = useChapterZeroLesson(lessons, card, heading);
  // Floors are optional in the speed lesson: an open Navigation menu is lit instead, so the card stays clear of it.
  const { box, covered, viewport } = useTargetBox(id === "speed" ? ['.room-controls:has(details[open])', lit!] : lit);

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
  const task = id === "inspect-app" ? ready ? null : "Click the highlighted App Server."
    : id === "inspect-db" ? ready ? "Compare its numbers with the App Server's." : "Now click Database and compare."
    : id === "warnings" ? "Find Latency, Errors and Backlog in the panel."
    : id === "run" ? "Press Run. Time stops again after one game second."
    : id === "quote" ? "Open any action under Actions to see its quote."
    : id === "cancel" ? confirming ? "Press Next to close the quote without buying." : done ? "Quote closed. Your cash is unchanged." : "Reopening a quote for you…"
    : id === "money" ? "Cash is in the top bar."
    : id === "speed" ? "Open the speed menu and pick another speed."
    : null;
  // A real dialog over the game (Menu, Finance) has the player's attention; the guide waits behind it.
  // Menu and sound stay reachable above a card docked to the top of a phone.
  const topbar = typeof document === "undefined" ? undefined : document.querySelector(".topbar")?.getBoundingClientRect().bottom;
  // A phone on its side leaves the readings only the top of the panel; the card then sits over the locked bottom bar.
  const position = inspected && viewport.w < 900 && viewport.h < 500 ? { left: 12, right: 12, bottom: 12, maxHeight: 120 } : cardStyle(target ? box : null, placeFor(inspected ? ".campaign-panel" : lit ?? ""), viewport.w, viewport.h, viewport.w, cardHeight, CARD_WIDTH, topbar ? Math.round(topbar) + 8 : 12);
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
        <span className="lesson-section">{s.tutorialCompany ? "Practice" : "Walkthrough"}</span>
        <span className="lesson-count" aria-label={`Lesson ${index + 1} of ${lessons.length}`}>
          <span className="lesson-dots" aria-hidden="true">{lessons.map((l, i) => <i key={l.id} className={i < index ? "is-done" : i === index ? "is-now" : ""} />)}</span>
          {index + 1} / {lessons.length}
        </span>
      </header>
      {s.meta.tutorialDone && <button className="btn btn-small lesson-return" onClick={() => { s.openView(null); s.endTour(false); }}><Icon name="next" size={16} />Skip tutorial</button>}
      <h3 ref={heading} tabIndex={-1}>{lesson.title}</h3>
      {task && <p className="lesson-task" aria-live="polite"><Icon name={ready && required ? "check" : "eye"} size={20} /><span><LessonText text={task} terms={lesson.emphasis} /></span></p>}
      <p className="lesson-why">{why}</p>
      {s.tutorialCompany && index === 0 && <p className="lesson-note">This is a practice company. Your saved company is paused and comes back when you finish or exit.</p>}
      <LessonVisual id={id!} />
      {(more || KEYS[id!]) && <details className="lesson-more"><summary>Learn more</summary>{more && <p>{more}</p>}{KEYS[id!] && <p>{KEYS[id!]}</p>}</details>}
      <footer className="lesson-footer">
        {index > 0 && <button className="btn" onClick={() => { s.openView(null); s.tourBack(); }}><Icon className="lesson-back-arrow" name="next" size={16} />Back</button>}
        <button className="btn btn-primary" disabled={!ready || moving || s.running} onClick={next}>{last ? "Finish walkthrough" : "Next"}<Icon name={last ? "check" : "next"} size={16} /></button>
      </footer>
    </section>
  </>;
}
