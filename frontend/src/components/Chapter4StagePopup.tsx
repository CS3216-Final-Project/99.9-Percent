import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
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

/** Shared small card; only colleague introductions block background interaction. */
export function ChapterMessageCard({ title, label, className, tone = "prepare", close, children, company = false }: {
  title: string; label: string; className: string; tone?: "prepare" | "pressure" | "recovery";
  close: () => void; children: ReactNode; company?: boolean;
}) {
  const card = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!company) return;
    const previous = document.activeElement as HTMLElement | null;
    const backdrop = card.current!.parentElement!;
    // Keep the existing card and chapter-cue priority. A higher-priority modal
    // remains available and causes the narrative coordinator to yield as before.
    const background = Array.from(document.body.children).filter((node): node is HTMLElement => node instanceof HTMLElement && node !== backdrop && !node.matches(".modal-backdrop"));
    const prior = background.map(node => node.inert);
    background.forEach(node => { node.inert = true; });
    card.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      background.forEach((node, i) => { node.inert = prior[i]; });
      if (previous?.isConnected && !previous.closest("[inert]")) previous.focus();
    };
  }, [company]);
  const content = <div ref={card} className={`campaign-hint-card chapter-stage-popup ${className}`} data-tone={tone} role="dialog" aria-modal={company} aria-label={label} onKeyDown={event => {
    if (company) event.stopPropagation();
    if (event.key === "Escape") { event.stopPropagation(); close(); }
    if (company && event.key === "Tab") {
      const buttons = card.current!.querySelectorAll<HTMLButtonElement>("button");
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus(); }
    }
  }}>
    <div className="campaign-hint-heading"><h3><Icon name={company ? "mail" : "bulb"} />{title}</h3><button type="button" className="icon-btn" aria-label={company ? "Dismiss company message" : "Dismiss chapter guidance"} onClick={close}><Icon name="close" /></button></div>
    <div className="campaign-hint-copy" aria-live="polite">{children}</div>
    <button type="button" className="btn" onClick={close}>Got it</button>
  </div>;
  return createPortal(company ? <div className="company-message-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) event.preventDefault(); }}>{content}</div> : content, document.body);
}
