import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";
import type { chapter4Stage } from "@/game/chapter4Guidance";
import type { chapter6Stage } from "@/game/chapter6Guidance";
import { presentationReceipts, recordPresentationReceipt } from "@/game/presentationReceipts";

export function Chapter4StagePopup({ model }: { model: NonNullable<ReturnType<typeof chapter4Stage>> }) {
  return <ChapterStagePopup chapter={4} model={model} />;
}
export function Chapter6StagePopup({ model }: { model: NonNullable<ReturnType<typeof chapter6Stage>> }) {
  return <ChapterStagePopup chapter={6} model={model} />;
}
interface StageModel { key: string; cues: { id: string; title: string; message: string; tone?: "prepare" | "pressure" | "recovery" }[] }
function ChapterStagePopup({ chapter, model }: { chapter: number; model: StageModel }) {
  const key = `99.99.chapter${chapter}-cues:${model.key}`;
  const [dismissed, setDismissed] = useState(() => presentationReceipts(key));
  const cue = model.cues.find(x => !dismissed.includes(x.id));
  const id = cue?.id;
  useEffect(() => {
    if (!id) return;
    recordPresentationReceipt(key, id);
  }, [key, id]);
  if (!cue) return null;
  const tone = cue.tone ?? (cue.id === "prepare" ? "prepare" : cue.id === "between" || cue.id === "recover" ? "recovery" : "pressure");
  const close = () => setDismissed(previous => [...previous, cue.id]);
  return <ChapterMessageCard title={cue.title} label={`Chapter ${chapter}: ${cue.title}`} className={`chapter${chapter}-stage-popup`} tone={tone} close={close}><p>{cue.message}</p></ChapterMessageCard>;
}

/** Shared small nonmodal card for chapter stage cues. */
function ChapterMessageCard({ title, label, className, tone = "prepare", close, children }: {
  title: string; label: string; className: string; tone?: "prepare" | "pressure" | "recovery";
  close: () => void; children: ReactNode;
}) {
  return createPortal(<div className={`campaign-hint-card chapter-stage-popup ${className}`} data-tone={tone} role="dialog" aria-modal={false} aria-label={label} onKeyDown={event => {
    if (event.key === "Escape") { event.stopPropagation(); close(); }
  }}>
    <div className="campaign-hint-heading"><h3><Icon name="bulb" />{title}</h3><button type="button" className="icon-btn" aria-label="Dismiss chapter guidance" onClick={close}><Icon name="close" /></button></div>
    <div className="campaign-hint-copy" aria-live="polite">{children}</div>
    <button type="button" className="btn" onClick={close}>Got it</button>
  </div>, document.body);
}
