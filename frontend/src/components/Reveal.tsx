import { useLayoutEffect, useRef, type ReactNode } from "react";
import "./Reveal.css";

// The standard curve: a gentle start and a long settle, so the first frames do not cover most of the distance.
const TWEEN: KeyframeAnimationOptions = { duration: 300, easing: "cubic-bezier(0.4, 0, 0.2, 1)" };

/**
 * Tweens its height open and closed, and between two contents of different heights when `contentKey` changes; once
 * closed, the contents are hidden and inert. To fold away rather than empty first, the caller keeps passing what it
 * last showed while `open` is false. The tween starts from the height on screen, so it can take over from another.
 */
export function Reveal({ open, contentKey, children }: { open: boolean; contentKey?: string | null; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null), inner = useRef<HTMLDivElement>(null);
  const tweens = useRef<Animation[]>([]);
  // The height on screen at rest. The new contents are already in place when the layout effect runs.
  const resting = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = outer.current, body = inner.current;
    if (!el || !body) return;
    const target = open ? body.offsetHeight : 0;
    const from = tweens.current.length ? el.getBoundingClientRect().height : resting.current;
    tweens.current.forEach(tween => tween.cancel());
    tweens.current = [];
    resting.current = target;
    const still = typeof el.animate !== "function" || !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (from === null || Math.abs(from - target) < 1 || still) { delete el.dataset.moving; return; }
    el.dataset.moving = "";
    const height = el.animate([{ height: `${from}px` }, { height: `${target}px` }], TWEEN);
    tweens.current = [height];
    // Opening and closing also fade; a switch keeps the new contents in full view while the box resizes.
    if (from < 1 || target === 0) tweens.current.push(body.animate([{ opacity: from < 1 ? 0 : 1 }, { opacity: target === 0 ? 0 : 1 }], TWEEN));
    height.onfinish = () => {
      if (tweens.current[0] !== height) return;
      tweens.current = [];
      delete el.dataset.moving;
    };
  }, [open, contentKey]);
  // Live readings resize the contents at rest, so the next tween starts from the height they reached.
  useLayoutEffect(() => {
    const el = outer.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => { if (!tweens.current.length) resting.current = el.getBoundingClientRect().height; });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={outer} className="reveal" data-open={open || undefined}>
      <div ref={inner} className="reveal-inner" inert={!open} aria-hidden={!open || undefined}>{children}</div>
    </div>
  );
}
