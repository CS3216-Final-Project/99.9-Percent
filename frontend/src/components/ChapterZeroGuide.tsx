import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useGame } from "@/game/store";
import { Icon } from "./icons";
import LessonVisual from "./ChapterZero";
import { confirmingAction, confirmationCancelCount, setConfirming, subscribeConfirming } from "./actionConfirmation";
import type { ChapterZeroLesson } from "./chapterZeroLessons";
import { useChapterZeroControls } from "./useChapterZeroControls";
import "./ChapterZero.css";

const REQUIRED = new Set([0, 1, 2, 5, 6, 7, 11, 13, 14, 15]);
const TIPS: Partial<Record<number, ReactNode>> = {
  2: "A queue means work is waiting. Compare the evidence before spending money.",
  4: "Pending revenue becomes spendable cash when the operating week settles.",
  5: <><kbd className="lesson-keycap">P</kbd> also toggles Run/Pause. In this lesson, the clock stops after one game second so you can look at the result before continuing.</>,
  10: "Idle equipment still costs money. Leave enough cash for the next bill.",
  12: <><kbd className="lesson-keycap">Q</kbd> / <kbd className="lesson-keycap">E</kbd> rotate the view. <kbd className="lesson-keycap" aria-label="Page Up">PgUp</kbd> / <kbd className="lesson-keycap" aria-label="Page Down">PgDn</kbd> switch floors. Walking is optional; you can always select equipment directly.</>,
  13: "Unlocked does not mean deployed. Check the activation delay.",
  15: "Browser saves stay on this device. Keep a backup or an explicit cloud save before changing devices.",
  17: "A failing second resets the recovery streak. Inspect, choose a response, then run to observe it.",
};

function LessonText({ text, terms = [] }: { text?: string; terms?: readonly string[] }) {
  if (!text || !terms.length) return text;
  const phrases = [...terms].sort((a, b) => b.length - a.length).map(term => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`\\b(${phrases.join("|")})\\b`, "gi"));
  return parts.map((part, i) => i % 2 ? <strong className="lesson-key" key={i}>{part}</strong> : part);
}

/** Nonmodal guidance keeps the real game operable, including its own dialogs and keyboard controls. */
export default function ChapterZeroGuide({ lessons }: { lessons: readonly ChapterZeroLesson[] }) {
  const s = useGame(), index = s.tour?.step ?? 0;
  const confirming = useSyncExternalStore(subscribeConfirming, confirmingAction);
  const cancellations = useSyncExternalStore(subscribeConfirming, confirmationCancelCount);
  const appCompared = useRef(false);
  const [readyFor, setReadyFor] = useState<number | null>(null);
  const [completedThrough, setCompletedThrough] = useState(Math.max(index, s.meta.walkthroughFurthestStep ?? 0) - 1);
  const entry = useRef({ index, speed: s.speed, floor: s.floor, toast: s.toast?.id, cancellations });
  const viewSeen = useRef(false);
  const reading = useRef<HTMLDivElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const lesson = lessons[index], reviewed = index <= completedThrough;
  const ready = !REQUIRED.has(index) || reviewed || readyFor === index;
  useChapterZeroControls(index, confirming, s.view);

  useEffect(() => {
    const now = useGame.getState();
    entry.current = { index, speed: now.speed, floor: now.floor, toast: now.toast?.id, cancellations: confirmationCancelCount() };
    viewSeen.current = false;
    appCompared.current = false;
    if (index !== 6 && index !== 7) setConfirming(null);
    if (index <= 2) now.select(null);
    if (reading.current) reading.current.scrollTop = 0;
    heading.current?.focus({ preventScroll: true });
  }, [index]);

  useEffect(() => {
    if (entry.current.index !== index) return;
    if ((index === 13 && s.view === "tech") || (index === 14 && s.view === "history")) viewSeen.current = true;
    const selected = useGame.getState().selected;
    if (index === 2 && selected === "app") appCompared.current = true;
    const done = index === 0 ? s.selected === "app"
      : index === 1 ? s.selected === "db"
      : index === 2 ? appCompared.current && selected === "db"
      : index === 5 ? !!s.tour?.clockUntil && s.game.campaign!.step >= s.tour.clockUntil && !s.running
      : index === 6 ? !!confirming
      : index === 7 ? cancellations > entry.current.cancellations && !confirming
      : index === 11 ? s.speed !== entry.current.speed
      : index === 12 ? s.floor !== entry.current.floor
      : index === 13 || index === 14 ? viewSeen.current && s.view === null
      : index === 15 ? s.toast?.id !== entry.current.toast && (s.toast?.text === "Saved" || s.toast?.text === "Could not save: browser storage is unavailable.")
      : false;
    if (done) setReadyFor(index);
  }, [index, confirming, cancellations, s.selected, s.speed, s.floor, s.view, s.running, s.game.campaign, s.tour, s.toast]);

  // A reload or an earlier dismissal must never leave the Cancel instruction without a real quote.
  useEffect(() => {
    if (index !== 7 || confirming || readyFor === index || cancellations > entry.current.cancellations) return;
    const control = document.querySelector('.campaign-panel .act:not(:disabled)') ?? document.querySelector('.campaign-panel .act');
    const action = control?.closest('[data-campaign-action]')?.getAttribute('data-campaign-action');
    if (action) setConfirming(action);
  }, [index, confirming, cancellations, readyFor]);

  const target = index === 0 ? '[data-tutorial="inspect-app"]'
    : index === 1 ? '[data-tutorial="inspect-db"]'
    : index === 2 ? `[data-tutorial="inspect-${s.selected !== "app" && !ready ? "app" : "db"}"]`
    : index === 3 ? '.stat-health'
    : [4, 8, 9, 10].includes(index) ? '.stat-cash'
    : index === 5 ? '.campaign-play'
    : index === 6 ? confirming ? '.campaign-action-confirm' : '.campaign-panel .act:not(:disabled)'
    : index === 7 ? confirming ? '.campaign-action-confirm .btn-row button:last-child' : null
    : index === 11 ? '.campaign-clock .time-menu'
    : index === 12 ? '.room-controls'
    : index === 13 || index === 14 ? s.view ? '.sheet-head button' : `.view-tabs button[data-view="${index === 13 ? "tech" : "history"}"]`
    : index === 15 ? s.view === "menu" ? '[data-tutorial="save-now"]' : '.menu-btn'
    : index === 19 ? '.chapter-bar' : null;
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

  if (!s.started || !lesson) return null;
  const text = typeof lesson.why === "function" ? lesson.why(s) : lesson.why;
  const instructions: Partial<Record<number, string>> = {
    0: "In Inspect equipment, click App Server. Read its live demand, capacity and backlog.",
    1: "In Inspect equipment, click Database. Its readings appear in the game panel.",
    2: s.selected !== "app" && !ready ? "Click App Server in Inspect equipment. Compare its demand and capacity." : "Now click Database in Inspect equipment. Compare its demand and capacity too.",
    5: "Press Run in the game’s bottom bar. Watch one real game second pass; the tutorial then pauses it for you.",
    6: "Choose an available action under Actions in the game. Read the actual quote. Leave it open and press Next here.",
    7: confirming ? "Press Cancel on the game’s purchase quote. Keep your cash for now." : ready ? "Your quote is closed and your cash is unchanged. Press Next to continue." : "The game is reopening a purchase quote so you can practise Cancel.",
    11: "Open the speed menu in the bottom bar and choose a different speed.",
    12: "Open the floor selector (Navigation on phones) and switch to the other floor.",
    13: s.view === "tech" ? "Explore the technology tree, then press its Close button." : "Open Tech from the game’s bottom bar, then close the tree to return.",
    14: s.view === "history" ? "Look at Charts, Events and Incidents, then close History." : "Open History in the game’s bottom bar, then close it to return.",
    15: s.view === "menu" ? "Choose Save now under Run in the real Menu." : "Open the game’s Menu, then choose Save now under Run.",
  };
  return <section role="dialog" aria-modal="false" aria-label={`Walkthrough, step ${index + 1} of ${lessons.length}`} data-lesson={index} className="chapter-zero-modal chapter-zero-guide" onKeyDown={event => {
    if (event.key !== "Tab" || event.shiftKey || event.target !== heading.current || ready || !target) return;
    const highlighted = document.querySelector<HTMLElement>(target);
    const control = highlighted?.matches("button:not(:disabled)") ? highlighted
      : highlighted?.querySelector<HTMLElement>(index === 7 ? ".btn-row button:last-child" : "summary, button:not(:disabled)");
    if (control) { event.preventDefault(); control.focus(); }
  }}>
    <header className="modal-head"><h2>Walkthrough</h2></header>
    {s.meta.tutorialDone && <button className="btn lesson-return" onClick={() => { s.openView(null); s.endTour(false); }}><Icon name="next" size={18} />Return to game</button>}
    <div className="modal-body">
      <div className="lesson-meta"><span>{s.tutorialCompany ? "Practice · In progress · " : ""}Lesson {index + 1} of {lessons.length}</span><span className="lesson-paused"><Icon name={s.running ? "play" : "pause"} size={14} />{s.running ? "Company running" : "Company paused"}</span></div>
      <progress className="lesson-progress" aria-label="Walkthrough progress" value={index + 1} max={lessons.length} />
      <div className="lesson-reading" ref={reading}>
        <h3 ref={heading} tabIndex={-1}>{lesson.title}</h3>
        {instructions[index] && <p className="lesson-task"><Icon name="eye" size={20} /><span><LessonText text={instructions[index]} terms={lesson.emphasis} /></span></p>}
        {ready && REQUIRED.has(index) && <p className="lesson-result" role="status"><Icon name="check" size={20} />{reviewed ? "Completed earlier. You can try it again." : "Done in your game. Continue when you’re ready."}</p>}
        {index === 15 && ready && s.toast?.text === "Could not save: browser storage is unavailable." && <p role="status">Browser storage is unavailable. Keep this tab open to preserve this session; saving will need working browser storage.</p>}
        {index === 2 && <LessonVisual key={index} index={index} />}
        <p className="lesson-intro">{text}</p>
        {s.tutorialCompany && index === 0 && <p className="lesson-intro">Practise on a fresh company. Your saved company is paused; finishing or exiting the walkthrough returns you to it.</p>}
        {index !== 2 && <LessonVisual key={index} index={index} />}
        {TIPS[index] && <aside className="lesson-tip"><Icon name="bulb" size={24} /><p><strong>Keep in mind</strong>{TIPS[index]}</p></aside>}
      </div>
      <footer className="lesson-footer"><button className="btn" disabled={index === 0} onClick={() => { s.openView(null); s.tourBack(); }}><Icon className="lesson-back-arrow" name="next" size={18} />Back</button><button className="btn btn-primary" disabled={!ready || s.running} onClick={() => { setCompletedThrough(Math.max(completedThrough, index)); if (!(index === 6 && confirming)) s.openView(null); if (index === lessons.length - 1) s.endTour(true); else s.tourNext(); }}>{index === lessons.length - 1 ? "Finish walkthrough" : "Next"}<Icon name={index === lessons.length - 1 ? "check" : "next"} size={18} /></button></footer>
    </div>
  </section>;
}
