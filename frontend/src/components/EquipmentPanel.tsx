import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { useGame } from "@/game/store";
import { Icon } from "./icons";
import { confirmingAction, subscribeConfirming } from "./actionConfirmation";

/**
 * Visibility is workspace state; selecting a machine or entering an incident reveals it again. A panel whose contents
 * change with the selection starts again at its top. Hiding plays the panel's leave animation before it collapses to
 * its reopen button; where no animation runs (phones, reduced motion) it collapses at once. The hide and reopen
 * buttons are one button that stays in full view and glides between its two places.
 */
export function EquipmentPanel({ children, label, className = "" }: { children: ReactNode; label: string; className?: string }) {
  const open = useGame(s => s.panelOpen), setOpen = useGame(s => s.setPanelOpen);
  const phase = useGame(s => s.game.phase), tour = useGame(s => s.tour), generation = useGame(s => s.generation);
  const selected = useGame(s => s.selected), selectedApp = useGame(s => s.selectedAppId);
  const campaign = useGame(s => !!s.game.campaign);
  const content = useRef<HTMLElement>(null);
  const confirming = useSyncExternalStore(subscribeConfirming, confirmingAction);
  const button = useRef<HTMLButtonElement>(null), focusOnChange = useRef(false);
  const id = useId();
  // Leaving: closed, but still on screen while the leave animation plays.
  const [leaving, setLeaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    setLeaving(!open);
  }
  const collapsed = !open && !leaving;
  // From the moment Hide is pressed the button is the reopen button, so it can travel while the panel leaves.
  const reopen = !open || leaving;
  const capture = useGlide(button, reopen ? `reopen:${collapsed}` : "hide");
  // An interrupted leave (the layout switching to phone or reduced motion mid-slide) cancels instead of ending.
  useEffect(() => {
    const el = content.current;
    if (!leaving || !el) return;
    const cancel = (e: AnimationEvent) => { if (e.target === el && e.animationName === "panel-leave") setLeaving(false); };
    el.addEventListener("animationcancel", cancel);
    return () => el.removeEventListener("animationcancel", cancel);
  }, [leaving]);
  // Before paint, so phones and reduced motion collapse without a frame of the inert, leaving panel.
  useLayoutEffect(() => {
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
    button.current?.focus({ preventScroll: true });
  }, [open, leaving]);
  const toggle = () => { capture(); focusOnChange.current = true; setOpen(!open); };
  return <div className={`equipment-shell${collapsed ? " is-collapsed" : ""}${leaving ? " is-leaving" : ""}`}>
    {/* Beside the room the icon is a side panel; over a bottom sheet it is a chevron that flips between down and up. */}
    {reopen ? <button ref={button} type="button" className="btn panel-reopen" aria-expanded="false" aria-controls={id} onClick={toggle}><Icon name="panelOpen" size={20} className="toggle-side-icon" /><Icon name="down" size={20} className="toggle-sheet-icon" />Equipment &amp; actions</button>
      : <button ref={button} type="button" className="icon-btn panel-toggle" aria-label="Hide equipment and actions" aria-expanded="true" aria-controls={id} disabled={!!tour || !!confirming} onClick={toggle}><Icon name="panelClose" size={20} className="toggle-side-icon" /><Icon name="down" size={20} className="toggle-sheet-icon" /></button>}
    <aside ref={content} id={id} hidden={collapsed} inert={leaving} className={`side ${className}`} aria-label={label}
      onAnimationEnd={e => { if (e.target === e.currentTarget && e.animationName === "panel-leave") setLeaving(false); }}>{children}</aside>
  </div>;
}

const GLIDE: KeyframeAnimationOptions = { duration: 300, easing: "cubic-bezier(0.4, 0, 0.2, 1)" };

/**
 * Moves the button from where it was drawn to where the new layout puts it (FLIP), resizing it on the way, so it
 * never leaves the screen. `place` names the layout slot. A new slot at the same spot lets a glide in progress finish.
 * The returned capture records where the button is drawn now, for a change about to be made.
 */
function useGlide(ref: RefObject<HTMLElement | null>, place: string) {
  const last = useRef<{ place: string; box: DOMRect } | null>(null);
  const glide = useRef<{ animation: Animation; frames: Keyframe[] } | null>(null);
  const play = (el: HTMLElement, frames: Keyframe[], time: CSSNumberish) => {
    const animation = el.animate(frames, GLIDE);
    animation.currentTime = time;
    animation.onfinish = () => { if (glide.current?.animation === animation) glide.current = null; };
    glide.current = { animation, frames };
  };
  // Every render at rest refreshes the box, so a change the button did not start (a selection reopening the panel)
  // still glides from where the button was last drawn.
  useLayoutEffect(() => {
    const el = ref.current, from = last.current;
    if (!el) { last.current = null; return; }
    if (from?.place === place) {
      if (!glide.current) from.box = el.getBoundingClientRect();
      return;
    }
    const running = glide.current, time = running?.animation.currentTime ?? null;
    running?.animation.cancel();
    glide.current = null;
    const box = el.getBoundingClientRect();
    last.current = { place, box };
    if (!from || typeof el.animate !== "function" || matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (!box.width || !from.box.width) return;
    // Where the new slot puts the button at its old size, whichever edge the slot grows from.
    el.style.width = `${from.box.width}px`;
    el.style.height = `${from.box.height}px`;
    const start = el.getBoundingClientRect();
    el.style.width = el.style.height = "";
    const dx = from.box.left - start.left, dy = from.box.top - start.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(from.box.width - box.width) < 1) {
      // Nothing moved, so the glide in progress carries on from the same frame.
      if (running && time !== null) play(el, running.frames, time);
      return;
    }
    play(el, [
      { transform: `translate(${dx}px, ${dy}px)`, width: `${from.box.width}px`, height: `${from.box.height}px` },
      { transform: "none", width: `${box.width}px`, height: `${box.height}px` },
    ], 0);
  });
  return () => {
    const el = ref.current;
    if (el && last.current && !glide.current) last.current.box = el.getBoundingClientRect();
  };
}
