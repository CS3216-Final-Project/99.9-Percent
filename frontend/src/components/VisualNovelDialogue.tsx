import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { COLLEAGUES, colleaguePortrait, type DialogueLine } from "@/game/colleagues";
import { Icon } from "./icons";
import "./VisualNovelDialogue.css";

/**
 * Modal visual novel scene: the speaker's portrait stands above a dialogue box the
 * player reads one line at a time. The ending joins the last line with the final button.
 */
export function VisualNovelDialogue({ label, lines, ending, endLabel, dismissLabel, close }: {
  label: string; lines: readonly DialogueLine[]; ending?: ReactNode; endLabel: string; dismissLabel: string; close: () => void;
}) {
  const card = useRef<HTMLDivElement>(null), primary = useRef<HTMLButtonElement>(null);
  const [read, setRead] = useState(0);
  const index = Math.min(read, lines.length - 1), last = index === lines.length - 1;
  const line = lines[index], speaker = COLLEAGUES[line.speaker], portrait = colleaguePortrait(line.speaker, line.mood);
  const next = () => { if (!last) setRead(index + 1); };
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const backdrop = card.current!.parentElement!;
    // A higher-priority modal remains available and causes the narrative coordinator to yield.
    const background = Array.from(document.body.children).filter((node): node is HTMLElement => node instanceof HTMLElement && node !== backdrop && !node.matches(".modal-backdrop"));
    const prior = background.map(node => node.inert);
    background.forEach(node => { node.inert = true; });
    primary.current?.focus();
    return () => {
      background.forEach((node, i) => { node.inert = prior[i]; });
      if (previous?.isConnected && !previous.closest("[inert]")) previous.focus();
    };
  }, []);
  return createPortal(<div className="dialogue-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) event.preventDefault(); }}>
    <div ref={card} className="dialogue" data-speaker={line.speaker} role="dialog" aria-modal="true" aria-label={label} onMouseDown={event => {
      // Pressing the scene outside its buttons keeps keyboard focus on the dialogue's controls.
      if (!(event.target as Element).closest("button")) event.preventDefault();
    }} onKeyDown={event => {
      event.stopPropagation();
      if (event.key === "Escape") close();
      if (event.key === "Tab") {
        const buttons = card.current!.querySelectorAll<HTMLButtonElement>("button");
        if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus(); }
        else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus(); }
      }
    }}>
      <img key={portrait.src} className="dialogue-portrait" src={portrait.src} alt={portrait.alt} width={768} height={768} draggable={false}/>
      <div className="dialogue-box" data-more={!last || undefined} onClick={event => { if (!(event.target as Element).closest("button")) next(); }}>
        <p className="dialogue-plate"><strong>{speaker.name}</strong><span>{speaker.role}</span></p>
        <button type="button" className="icon-btn dialogue-close" aria-label={dismissLabel} onClick={close}><Icon name="close"/></button>
        <div className="dialogue-copy" aria-live="polite">
          <p key={index} className="dialogue-line">{line.text}</p>
          {last && ending}
        </div>
        <div className="dialogue-foot">
          <span className="dialogue-progress" role="img" aria-label={`Line ${index + 1} of ${lines.length}`}>
            {lines.map((_, i) => <span key={i} data-read={i <= index || undefined}/>)}
          </span>
          <button ref={primary} type="button" className="btn btn-primary" onClick={last ? close : next}>{last ? endLabel : <>Next<Icon name="next"/></>}</button>
        </div>
      </div>
    </div>
  </div>, document.body);
}
