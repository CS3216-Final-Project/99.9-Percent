import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
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
  // Every portrait of the scene is fetched up front, so a new speaker never appears as an empty slot.
  const portraits = [...new Set(lines.map(l => colleaguePortrait(l.speaker, l.mood).src))].join(" ");
  useEffect(() => { for (const src of portraits.split(" ")) new Image().src = src; }, [portraits]);
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
  // Pressing the scene outside its buttons focuses the dialogue itself, so keys never reach the game behind it.
  return createPortal(<div className="dialogue-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) event.preventDefault(); }}>
    <div ref={card} className="dialogue" data-speaker={line.speaker} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} onKeyDown={event => {
      event.stopPropagation();
      if (event.key === "Escape") close();
      if ((event.key === "Enter" || event.key === " ") && event.target === card.current) { event.preventDefault(); primary.current?.click(); }
      if (event.key === "Tab") {
        const buttons = card.current!.querySelectorAll<HTMLButtonElement>("button"), active = document.activeElement;
        if (event.shiftKey && (active === buttons[0] || active === card.current)) { event.preventDefault(); buttons[buttons.length - 1].focus(); }
        else if (!event.shiftKey && active === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus(); }
      }
    }}>
      <img key={portrait.src} className="dialogue-portrait" src={portrait.src} alt={portrait.alt} width={768} height={768} draggable={false} onError={event => { event.currentTarget.dataset.broken = ""; }}/>
      <div className="dialogue-box" data-more={!last || undefined} onClick={event => {
        // Selecting text to copy it is not a request for the next line.
        if ((event.target as Element).closest("button") || window.getSelection()?.isCollapsed === false) return;
        next(); primary.current?.focus();
      }}>
        <p className="dialogue-plate"><strong>{speaker.name}</strong><span>{speaker.role}</span></p>
        <button type="button" className="icon-btn dialogue-close" aria-label={dismissLabel} onClick={close}><Icon name="close"/></button>
        <div className="dialogue-copy" aria-live="polite">
          <p key={index} className="dialogue-line"><span className="visually-hidden">{speaker.name}: </span>{line.text}</p>
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
