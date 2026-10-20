import { afterEach, expect, it, vi } from "vitest";
import { watchIdleAttention } from "./idleAttention";
let stop: (() => void) | undefined;
afterEach(() => { stop?.(); stop = undefined; vi.useRealTimers(); });
function start() { vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] }); const idle = vi.fn(); stop = watchIdleAttention(idle); return idle; }
it("waits ten real seconds and cancels completely on cleanup", () => {
  const idle = start(); vi.advanceTimersByTime(9999); expect(idle).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1); expect(idle).toHaveBeenLastCalledWith(true);
  stop!(); idle.mockClear(); vi.advanceTimersByTime(20_000); expect(idle).not.toHaveBeenCalled();
});
it("genuine keyboard interaction restarts the deadline", () => {
  const idle = start(); vi.advanceTimersByTime(9000); document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
  document.dispatchEvent(new KeyboardEvent("keyup", { key: "Tab" }));
  vi.advanceTimersByTime(1000); expect(idle).toHaveBeenLastCalledWith(false);
  vi.advanceTimersByTime(9000); expect(idle).toHaveBeenLastCalledWith(true);
});
it("a held pointer is activity even without movement", () => {
  const idle = start(); document.dispatchEvent(new Event("pointerdown"));
  vi.advanceTimersByTime(20_000); expect(idle).toHaveBeenLastCalledWith(false);
  document.dispatchEvent(new Event("pointerup")); vi.advanceTimersByTime(9999); expect(idle).toHaveBeenLastCalledWith(false);
  vi.advanceTimersByTime(1); expect(idle).toHaveBeenLastCalledWith(true);
});
it("stationary hover and passive rendering do not reset inactivity", () => {
  const idle = start(); vi.advanceTimersByTime(9000); document.dispatchEvent(new MouseEvent("pointermove")); document.dispatchEvent(new Event("pointerover"));
  vi.advanceTimersByTime(1000); expect(idle).toHaveBeenLastCalledWith(true);
});
it("dragging resets activity and repeated setup leaves only one live deadline", () => {
  const idle = start(); vi.advanceTimersByTime(9000); document.dispatchEvent(new MouseEvent("pointermove", { buttons: 1 }));
  vi.advanceTimersByTime(1000); expect(idle).toHaveBeenLastCalledWith(false);
  stop!(); const second = vi.fn(); stop = watchIdleAttention(second); idle.mockClear();
  vi.advanceTimersByTime(10_000); expect(idle).not.toHaveBeenCalled(); expect(second).toHaveBeenLastCalledWith(true);
});
