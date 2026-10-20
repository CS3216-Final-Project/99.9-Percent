export const IDLE_ATTENTION_MS = 10_000;

/** One monotonic deadline; passive rendering and pointer hover are deliberately not activity. */
export function watchIdleAttention(onIdle: (idle: boolean) => void) {
  let last = performance.now(), stopped = false;
  let pointerHeld = false;
  const keys = new Set<string>();
  let timer: ReturnType<typeof setTimeout>;
  const check = () => {
    if (stopped) return;
    const remaining = IDLE_ATTENTION_MS - (performance.now() - last);
    if (pointerHeld || keys.size) timer = setTimeout(check, IDLE_ATTENTION_MS);
    else if (remaining > 0) timer = setTimeout(check, remaining);
    else onIdle(true);
  };
  const activity = () => { last = performance.now(); onIdle(false); clearTimeout(timer); timer = setTimeout(check, IDLE_ATTENTION_MS); };
  const drag = (event: PointerEvent) => { if (event.buttons) activity(); };
  const down = () => { pointerHeld = true; activity(); };
  const up = () => { pointerHeld = false; activity(); };
  const keyDown = (event: KeyboardEvent) => { keys.add(event.key); activity(); };
  const keyUp = (event: KeyboardEvent) => { keys.delete(event.key); activity(); };
  document.addEventListener("pointerdown", down, true); document.addEventListener("pointerup", up, true); document.addEventListener("pointercancel", up, true);
  document.addEventListener("keydown", keyDown, true); document.addEventListener("keyup", keyUp, true);
  const events = ["wheel", "touchmove"] as const;
  for (const event of events) document.addEventListener(event, activity, { capture: true, passive: true });
  document.addEventListener("pointermove", drag, { capture: true, passive: true });
  timer = setTimeout(check, IDLE_ATTENTION_MS);
  return () => {
    stopped = true; clearTimeout(timer); onIdle(false);
    for (const event of events) document.removeEventListener(event, activity, true);
    document.removeEventListener("pointermove", drag, true);
    document.removeEventListener("pointerdown", down, true); document.removeEventListener("pointerup", up, true); document.removeEventListener("pointercancel", up, true);
    document.removeEventListener("keydown", keyDown, true); document.removeEventListener("keyup", keyUp, true);
  };
}
