import { useEffect, useId, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { useGame } from "@/game/store";
import { Icon } from "./icons";
import { confirmingAction, subscribeConfirming } from "./actionConfirmation";

/** Visibility is workspace state; selecting a machine or entering an incident reveals it again. */
export function EquipmentPanel({ children, label, className = "" }: { children: ReactNode; label: string; className?: string }) {
  const open = useGame(s => s.panelOpen), setOpen = useGame(s => s.setPanelOpen);
  const phase = useGame(s => s.game.phase), tour = useGame(s => s.tour), generation = useGame(s => s.generation);
  const selected = useGame(s => s.selected), selectedApp = useGame(s => s.selectedAppId);
  const tab = useGame(s => s.panelTab);
  const content = useRef<HTMLElement>(null);
  const confirming = useSyncExternalStore(subscribeConfirming, confirmingAction);
  const collapse = useRef<HTMLButtonElement>(null), expand = useRef<HTMLButtonElement>(null), focusOnChange = useRef(false);
  const id = useId();
  useEffect(() => { content.current?.scrollTo?.({ top: 0 }); }, [selected, selectedApp, phase]);
  // A new tab starts at its top before anything (such as accepted guidance) reveals a control in it.
  useLayoutEffect(() => { content.current?.scrollTo?.({ top: 0 }); }, [tab]);
  useEffect(() => { setOpen(true); }, [generation, setOpen]);
  useEffect(() => { if (phase === "incident" || tour) setOpen(true); }, [phase, tour, generation, setOpen]);
  useEffect(() => {
    if (!focusOnChange.current) return;
    focusOnChange.current = false;
    (open ? collapse : expand).current?.focus({ preventScroll: true });
  }, [open]);
  const toggle = () => { focusOnChange.current = true; setOpen(!open); };
  return <div className={`equipment-shell${open ? "" : " is-collapsed"}`}>
    {open ? <button ref={collapse} type="button" className="icon-btn panel-toggle" aria-label="Hide equipment and actions" aria-expanded="true" aria-controls={id} disabled={!!tour || !!confirming} onClick={toggle}><Icon name="panelClose" size={20} /></button>
      : <button ref={expand} type="button" className="btn panel-reopen" aria-expanded="false" aria-controls={id} onClick={toggle}><Icon name="panelOpen" size={20} />Equipment &amp; actions</button>}
    <aside ref={content} id={id} hidden={!open} className={`side ${className}`} aria-label={label}>{children}</aside>
  </div>;
}
