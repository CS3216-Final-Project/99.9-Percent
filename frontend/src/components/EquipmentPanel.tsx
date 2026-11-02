import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useGame } from "@/game/store";
import { Icon } from "./icons";
import { confirmingAction, subscribeConfirming } from "./actionConfirmation";

/**
 * Visibility is workspace state; selecting a machine or entering an incident reveals it again. A panel whose contents
 * change with the selection starts again at its top. Hiding plays the panel's leave animation before it collapses to
 * its reopen button; where no animation runs (phones, reduced motion) it collapses at once.
 */
export function EquipmentPanel({ children, label, className = "" }: { children: ReactNode; label: string; className?: string }) {
  const open = useGame(s => s.panelOpen), setOpen = useGame(s => s.setPanelOpen);
  const phase = useGame(s => s.game.phase), tour = useGame(s => s.tour), generation = useGame(s => s.generation);
  const selected = useGame(s => s.selected), selectedApp = useGame(s => s.selectedAppId);
  const campaign = useGame(s => !!s.game.campaign);
  const content = useRef<HTMLElement>(null);
  const confirming = useSyncExternalStore(subscribeConfirming, confirmingAction);
  const collapse = useRef<HTMLButtonElement>(null), expand = useRef<HTMLButtonElement>(null), focusOnChange = useRef(false);
  const id = useId();
  // Leaving: closed, but still on screen while the leave animation plays.
  const [leaving, setLeaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    setLeaving(!open);
  }
  const collapsed = !open && !leaving;
  useEffect(() => {
    if (!leaving || !content.current) return;
    const name = getComputedStyle(content.current).animationName;
    if (!name || name === "none") setLeaving(false);
  }, [leaving]);
  // Guided Mode keeps its dashboard in place while a separate dialog owns the readings.
  // Challenge Mode still replaces the panel content when equipment changes.
  useEffect(() => { if (!campaign) content.current?.scrollTo?.({ top: 0 }); }, [selected, selectedApp, campaign]);
  useEffect(() => { content.current?.scrollTo?.({ top: 0 }); }, [phase]);
  useEffect(() => { setOpen(true); }, [generation, setOpen]);
  useEffect(() => { if (phase === "incident" || tour) setOpen(true); }, [phase, tour, generation, setOpen]);
  useEffect(() => {
    if (!focusOnChange.current || leaving) return;
    focusOnChange.current = false;
    (open ? collapse : expand).current?.focus({ preventScroll: true });
  }, [open, leaving]);
  const toggle = () => { focusOnChange.current = true; setOpen(!open); };
  return <div className={`equipment-shell${collapsed ? " is-collapsed" : ""}${leaving ? " is-leaving" : ""}`}>
    {!collapsed ? <button ref={collapse} type="button" className="icon-btn panel-toggle" aria-label="Hide equipment and actions" aria-expanded="true" aria-controls={id} disabled={!!tour || !!confirming || leaving} onClick={toggle}><Icon name="panelClose" size={20} /></button>
      : <button ref={expand} type="button" className="btn panel-reopen" aria-expanded="false" aria-controls={id} onClick={toggle}><Icon name="panelOpen" size={20} />Equipment &amp; actions</button>}
    <aside ref={content} id={id} hidden={collapsed} inert={leaving} className={`side ${className}`} aria-label={label}
      onAnimationEnd={e => { if (e.target === e.currentTarget && e.animationName === "panel-leave") setLeaving(false); }}>{children}</aside>
  </div>;
}
