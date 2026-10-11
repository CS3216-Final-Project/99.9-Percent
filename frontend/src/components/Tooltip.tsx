"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TIP_ATTR, TIP_SIDE_ATTR, placeTip, splitShortcut } from "./tips";

/** Pointer hover waits this long so crossing the HUD does not flash a tooltip at every control. */
const SHOW_DELAY_MS = 200;

interface Active {
  el: HTMLElement;
  text: string;
  /** Hover tips go when the pointer leaves; focus tips stay until focus moves on. */
  via: "hover" | "focus";
}

function triggerOf(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>(`[${TIP_ATTR}]`) : null;
}

const textOf = (el: HTMLElement) => el.getAttribute(TIP_ATTR)?.trim() ?? "";

/** Keyboard focus shows a tip; a mouse or finger focusing a button does not. Text terms with an explicit tabindex always do, so a tap works. */
function showsOnFocus(el: HTMLElement): boolean {
  if (el.hasAttribute("tabindex")) return true;
  try {
    return el.matches(":focus-visible");
  } catch {
    return true;
  }
}

/**
 * The game's one tooltip. Any element with `data-tip` (see `tipProps`) explains itself here on hover or keyboard focus,
 * in the game's own style, instead of the browser's `title` bubble. One layer handles every control, so a new
 * control never needs a wrapper and the bubble can be placed against the window, not its panel.
 */
export function TooltipLayer() {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const current = useRef<Active | null>(null);
  const [active, setActive] = useState<Active | null>(null);

  const set = useCallback((next: Active | null) => {
    current.current = next;
    setActive(next);
  }, []);

  // Which trigger is showing, driven by the pointer, focus and a few dismissals.
  useEffect(() => {
    let timer: number | undefined;
    const clearTimer = () => {
      window.clearTimeout(timer);
      timer = undefined;
    };
    const hide = () => {
      clearTimer();
      if (current.current) set(null);
    };

    const onOver = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const el = triggerOf(e.target);
      if (!el || !textOf(el) || current.current?.el === el) return;
      clearTimer();
      const open = () => set({ el, text: textOf(el), via: "hover" });
      if (current.current) open();
      else timer = window.setTimeout(open, SHOW_DELAY_MS);
    };
    const onOut = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const el = triggerOf(e.target);
      if (!el || (e.relatedTarget instanceof Node && el.contains(e.relatedTarget))) return;
      clearTimer();
      if (current.current?.el === el && current.current.via === "hover") set(null);
    };
    const onFocusIn = (e: FocusEvent) => {
      const el = triggerOf(e.target);
      if (!el || !textOf(el) || !showsOnFocus(el)) return;
      clearTimer();
      set({ el, text: textOf(el), via: "focus" });
    };
    const onFocusOut = (e: FocusEvent) => {
      if (triggerOf(e.target) === current.current?.el) hide();
    };
    const onKey = (e: KeyboardEvent) => {
      // Escape closes the tip first, so it does not also close the panel behind it.
      if (e.key === "Escape" && current.current) {
        e.stopPropagation();
        hide();
      }
    };

    const on: [string, EventListener][] = [
      ["pointerover", onOver as EventListener],
      ["pointerout", onOut as EventListener],
      ["focusin", onFocusIn as EventListener],
      ["focusout", onFocusOut as EventListener],
      ["keydown", onKey as EventListener],
      // A press, scroll or resize means the pointer is now doing something else.
      ["pointerdown", hide],
      ["scroll", hide],
    ];
    for (const [type, fn] of on) document.addEventListener(type, fn, { capture: true, passive: true });
    window.addEventListener("resize", hide);
    window.addEventListener("blur", hide);
    return () => {
      clearTimer();
      for (const [type, fn] of on) document.removeEventListener(type, fn, { capture: true });
      window.removeEventListener("resize", hide);
      window.removeEventListener("blur", hide);
    };
  }, [set]);

  // While open, keep the bubble against its trigger, and drop it if the trigger goes away or changes its text.
  useLayoutEffect(() => {
    const node = box.current;
    if (!active || !node) return;
    const { el } = active;
    const place = () => {
      const r = el.getBoundingClientRect();
      const p = placeTip(
        { left: r.left, top: r.top, width: r.width, height: r.height },
        { width: node.offsetWidth, height: node.offsetHeight },
        { width: document.documentElement.clientWidth, height: window.innerHeight },
        el.getAttribute(TIP_SIDE_ATTR) === "above" ? "above" : "below",
      );
      node.style.left = `${p.left}px`;
      node.style.top = `${p.top}px`;
      node.style.setProperty("--tip-arrow", `${p.arrow}px`);
      node.dataset.side = p.side;
    };
    let frame = 0;
    const follow = () => {
      const text = textOf(el);
      if (!el.isConnected || !text) return set(null);
      if (text !== active.text) return set({ ...active, text });
      place();
      frame = requestAnimationFrame(follow);
    };
    place();
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, [active, set]);

  // Describe the trigger by the bubble while it shows, as the native title did.
  const trigger = active?.el ?? null;
  useEffect(() => {
    if (!trigger) return;
    const before = trigger.getAttribute("aria-describedby");
    trigger.setAttribute("aria-describedby", before ? `${before} ${id}` : id);
    return () => {
      if (before === null) trigger.removeAttribute("aria-describedby");
      else trigger.setAttribute("aria-describedby", before);
    };
  }, [trigger, id]);

  if (!active) return null;
  const { label, key } = splitShortcut(active.text);
  return createPortal(
    <div ref={box} id={id} role="tooltip" className="tooltip">
      <span className="tooltip-text">{label}</span>
      {key && <kbd className="tooltip-key">{key}</kbd>}
      <span className="tooltip-arrow" aria-hidden="true" />
    </div>,
    document.body,
  );
}
