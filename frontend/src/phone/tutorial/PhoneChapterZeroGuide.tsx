import { useEffect, useId, useRef, useState } from "react";
import LessonVisual from "@/components/ChapterZero";
import { LessonText } from "@/components/ChapterZeroGuide";
import type { ChapterZeroLesson } from "@/components/chapterZeroLessons";
import { Icon } from "@/components/icons";
import { useTargetBox } from "@/components/spotlight";
import { useChapterZeroLesson } from "@/components/useChapterZeroLesson";
import { SHEET_HANDLE } from "../layout/sheetState";
import { PHONE_CTA, PHONE_LESSONS } from "./phoneLessons";
import { readingPlace, useCoachFrame, useGuideSheet } from "./coachLayout";
import "./phone-tutorial.css";


/**
 * Chapter 0 on a phone: a fixed-size coach strip docked above the dock, so the room and the lesson's real control
 * stay in view. The strip says where the player is, the lesson and its one task, with Back, Learn more and Next always
 * in the same places. The longer reason, the labelled example and the explanation open in a reading layer that never
 * covers the lesson's control. Lesson rules are shared with the desktop card through useChapterZeroLesson.
 */
export default function PhoneChapterZeroGuide({ lessons }: { lessons: readonly ChapterZeroLesson[] }) {
  const card = useRef<HTMLElement>(null), heading = useRef<HTMLHeadingElement>(null), toggle = useRef<HTMLButtonElement>(null), layer = useRef<HTMLDivElement>(null);
  const { s, index, lesson, id, confirming, required, ready, done, moving, inspected, target, lit, why, more, last, next } =
    useChapterZeroLesson(lessons, card, heading, { always: SHEET_HANDLE, escapeWithin: ".phone-coach", readingsFirst: true });
  // The lesson whose reading layer is open: each lesson opens with its reading closed.
  const [readingFor, setReadingFor] = useState<number | null>(null);
  const reading = readingFor === index;
  const layerId = useId();
  // Floors are optional in the speed lesson: an open Navigation menu is lit instead.
  // Inspected readings are lit by their demand, capacity and backlog rows: the part of the card the sheet shows.
  const { box, covered, viewport } = useTargetBox(id === "speed" ? ['.room-controls:has(details[open])', lit!] : inspected ? ".campaign-evidence .evidence-rows" : lit);
  const { top, stripTop } = useCoachFrame(card);
  // The reading layer keeps clear of the control itself (a quote's Cancel, the readings' rows), not the whole lit area.
  const control = useTargetBox(reading && target ? inspected ? ".campaign-evidence .evidence-rows" : target : null).box;
  useGuideSheet(id ? PHONE_LESSONS[id].sheet : null);

  useEffect(() => { if (reading) layer.current?.focus({ preventScroll: true }); }, [reading]);
  // The speed lesson opens the dock's speed menu; once it is done, the menu closes so the room is clear again.
  const previous = useRef(id);
  useEffect(() => {
    if (previous.current === "speed" && id !== "speed") document.querySelectorAll<HTMLDetailsElement>(".phone-dock details[open]").forEach(menu => { menu.open = false; });
    previous.current = id;
  }, [id]);

  if (!s.started || !lesson || !id) return null;
  const phone = PHONE_LESSONS[id];
  const task = phone.task({ ready, done, quoting: !!confirming });
  const close = () => { setReadingFor(null); toggle.current?.focus({ preventScroll: true }); };
  const pointing = !!(box && target);
  return <>
    {!covered && <div className={`cz-spotlight${pointing ? "" : " is-full"}`} aria-hidden="true"
      style={pointing ? { left: box!.x, top: box!.y, width: box!.w, height: box!.h } : undefined}>
      {pointing && PHONE_CTA[id] && !ready && <span className={`cz-cta${box!.y < 60 ? " is-below" : ""}`}>{PHONE_CTA[id]}</span>}
    </div>}
    <section ref={card} role="dialog" aria-modal="false" aria-label={`Walkthrough, step ${index + 1} of ${lessons.length}`}
      data-lesson={index} data-lesson-id={id} data-inspected={inspected || undefined} hidden={covered}
      className="chapter-zero-guide phone-coach"
      onKeyDown={event => {
        if (event.key === "Escape") {
          // Escape belongs to the reading layer; it never reaches the game's shortcuts from here.
          event.preventDefault(); event.stopPropagation();
          if (reading) close();
          return;
        }
        if (event.key !== "Tab" || event.shiftKey || event.target !== heading.current || ready || !target) return;
        const highlighted = document.querySelector<HTMLElement>(target);
        const control = highlighted?.matches("button:not(:disabled)") ? highlighted
          : highlighted?.querySelector<HTMLElement>("summary, button:not(:disabled)");
        if (control) { event.preventDefault(); control.focus(); }
      }}>
      <header className="phone-coach-meta">
        <span className="phone-coach-kicker">{s.tutorialCompany ? "Practice" : "Walkthrough"}</span>
        <span className="phone-coach-count" aria-label={`Lesson ${index + 1} of ${lessons.length}`}>
          {!s.meta.tutorialDone && <span className="phone-coach-progress" aria-hidden="true"><i style={{ width: `${(index + 1) / lessons.length * 100}%` }} /></span>}
          {index + 1}/{lessons.length}
        </span>
        {s.meta.tutorialDone && <button type="button" className="phone-coach-return" onClick={() => { s.openView(null); s.endTour(false); }}>Skip tutorial</button>}
      </header>
      <h3 ref={heading} tabIndex={-1}>{lesson.title}</h3>
      <p className="phone-coach-task" aria-live="polite" data-done={ready && required || undefined}>
        <Icon name={ready && required ? "check" : "eye"} size={18} /><span><LessonText text={task} terms={lesson.emphasis} /></span>
      </p>
      <footer className="phone-coach-actions">
        {/* The first lesson has no Back; its slot stays so Learn more and Next keep their places. */}
        <button type="button" className="btn phone-coach-back" style={index === 0 ? { visibility: "hidden" } : undefined} onClick={() => { s.openView(null); s.tourBack(); }}>
          <Icon className="lesson-back-arrow" name="next" size={16} /><span className="phone-coach-label">Back</span>
        </button>
        <button ref={toggle} type="button" className="btn phone-coach-more" aria-expanded={reading} aria-controls={layerId} onClick={() => setReadingFor(reading ? null : index)}>
          <Icon name="info" size={16} />Learn more
        </button>
        <button type="button" className="btn btn-primary phone-coach-next" disabled={!ready || moving || s.running} onClick={next}
          aria-label={last ? "Finish walkthrough" : undefined}>
          {last ? "Finish" : "Next"}<Icon name={last ? "check" : "next"} size={16} />
        </button>
      </footer>
      <div ref={layer} id={layerId} role="region" aria-label={`About ${lesson.title}`} tabIndex={-1} hidden={!reading}
        className="phone-coach-reading" style={readingPlace(control, top, stripTop, viewport.h)}>
        <div className="phone-coach-reading-head">
          <strong>{lesson.title}</strong>
          <button type="button" className="icon-btn phone-coach-close" aria-label="Close" onClick={close}><Icon name="close" size={18} /></button>
        </div>
        <p className="lesson-why">{why}</p>
        {s.tutorialCompany && index === 0 && <p className="lesson-note">This is a practice company. Your saved company is paused and comes back when you finish or exit.</p>}
        {phone.example && <LessonVisual id={id} />}
        {more && <p className="phone-coach-more-text">{more}</p>}
      </div>
    </section>
  </>;
}
