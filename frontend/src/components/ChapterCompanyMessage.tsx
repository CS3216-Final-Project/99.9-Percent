import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { ChapterCompanyMessage as Message } from "@/game/chapterCompanyMessage";
import { presentationReceipts, recordPresentationReceipt } from "@/game/presentationReceipts";
import { Icon } from "./icons";

/** One optional narrative slot: introduction first, then the still-current stage cue. */
export function ChapterCompanyMessage({ model, enabled, children, onOpen }: { model: Message; enabled: boolean; children?: ReactNode; onOpen?: (open: boolean) => void }) {
  const [state, setState] = useState(() => ({ enabled, dismissed: presentationReceipts(model.key).includes("intro") }));
  // An already-shown optional message yields permanently when a higher priority
  // takes over; an unseen message stays pending. No effect-driven render cascade.
  const interrupted = state.enabled && !enabled && presentationReceipts(model.key).includes("intro");
  const dismissed = state.dismissed || interrupted;
  if (state.enabled !== enabled) setState({ enabled, dismissed });
  useLayoutEffect(() => {
    if (enabled && !dismissed && !document.querySelector(".modal-backdrop")) {
      recordPresentationReceipt(model.key, "intro");
    }
  }, [enabled, dismissed, model.key]);
  // Owners that must wait for the introduction learn when it is on screen.
  const open = enabled && !dismissed;
  useLayoutEffect(() => { onOpen?.(open); }, [open, onOpen]);
  useLayoutEffect(() => () => onOpen?.(false), [onOpen]);
  if (!enabled) return null;
  if (dismissed) return children;
  return <CompanyDialogue model={model} close={() => setState({ enabled, dismissed: true })}/>;
}

/** Visual novel scene: the colleague's portrait above a dialogue box the player reads line by line. */
function CompanyDialogue({ model, close }: { model: Message; close: () => void }) {
  const card = useRef<HTMLDivElement>(null), primary = useRef<HTMLButtonElement>(null);
  const [read, setRead] = useState(0);
  const line = Math.min(read, model.lines.length - 1), last = line === model.lines.length - 1;
  const next = () => { if (!last) setRead(line + 1); };
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
  return createPortal(<div className="company-message-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) event.preventDefault(); }}>
    <div ref={card} className="company-message" data-speaker={model.speaker} role="dialog" aria-modal="true" aria-label="Company Message" onMouseDown={event => {
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
      <img className="company-message-portrait" src={model.portrait} alt={`${model.name}, ${model.character}`} width={768} height={768} draggable={false}/>
      <div className="company-message-box" data-more={!last || undefined} onClick={event => { if (!(event.target as Element).closest("button")) next(); }}>
        <p className="company-message-plate"><strong>{model.name}</strong><span>{model.role}</span></p>
        <button type="button" className="icon-btn company-message-close" aria-label="Dismiss company message" onClick={close}><Icon name="close"/></button>
        <div className="company-message-copy" aria-live="polite">
          <p key={line} className="company-message-line">{model.lines[line]}</p>
          {last && <p className="company-message-mission"><strong>Your mission:</strong> {model.mission}</p>}
        </div>
        <div className="company-message-foot">
          <span className="company-message-progress" role="img" aria-label={`Line ${line + 1} of ${model.lines.length}`}>
            {model.lines.map((_, i) => <span key={i} data-read={i <= line || undefined}/>)}
          </span>
          <button ref={primary} type="button" className="btn btn-primary" onClick={last ? close : next}>{last ? "Got it" : <>Next<Icon name="next"/></>}</button>
        </div>
      </div>
    </div>
  </div>, document.body);
}
