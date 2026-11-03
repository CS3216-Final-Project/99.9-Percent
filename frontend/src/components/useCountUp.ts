import { useLayoutEffect, useRef, useState } from "react";
import { useGame } from "@/game/store";

/** A count settles within this share of a game second, so it lands before the next second's reading arrives. */
const SHARE_OF_SECOND = 0.8;

/** Reduced motion, or no way to ask (tests, old browsers), shows each figure at once. */
const still = () => typeof window.matchMedia !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A live reading that counts from the figure on screen to the new one, easing out like the title's uptime mark,
 * instead of jumping: the Opening's 300 to 800 req/s is seen to climb. It settles within the game second at the
 * chosen speed. A deployment rush, reduced motion and a game replaced wholesale (a load, another company, practice)
 * show the new figure at once.
 */
export function useCountUp(value: number): number {
  const speed = useGame(s => s.speed), rush = useGame(s => s.deployRush), generation = useGame(s => s.generation);
  const [shown, setShown] = useState(value);
  const last = useRef({ shown: value, generation });
  useLayoutEffect(() => {
    const from = last.current.shown, sameGame = last.current.generation === generation;
    last.current.generation = generation;
    const show = (n: number) => { last.current.shown = n; setShown(n); };
    if (from === value || !sameGame || rush || still()) { show(value); return; }
    const duration = SHARE_OF_SECOND * 1000 / speed, start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      show(t === 1 ? value : Math.round(from + (value - from) * (1 - 2 ** (-10 * t))));
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [value, generation, speed, rush]);
  return shown;
}
