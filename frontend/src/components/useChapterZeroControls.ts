import { useLayoutEffect } from "react";
import type { LessonId } from "@/game/walkthrough";

const CONTROLS = 'button, a, input, select, textarea, summary, [tabindex], canvas';
const ALWAYS = '.chapter-zero-guide, .music-btn, .menu-btn, .modal-backdrop:has(> .modal-menu)';

/** The walkthrough enables real controls for the current lesson, without changing their game rules. */
export function useChapterZeroControls(lesson: LessonId | undefined, quote: string | null) {
  const scope = lesson === "inspect-app" ? '[data-tutorial="inspect-app"], .campaign-evidence'
    : lesson === "inspect-db" ? '[data-tutorial="inspect-app"], [data-tutorial="inspect-db"], .campaign-evidence'
    : lesson === "warnings" ? '.stat-health, .app-health-dashboard'
    : lesson === "money" ? '.stat-cash, [role="dialog"][aria-label="Company finances"]'
    : lesson === "run" ? '.campaign-play'
    : lesson === "quote" ? quote ? '.campaign-action-confirm' : '.campaign-panel .act'
    : lesson === "cancel" ? quote ? '.campaign-action-confirm' : ''
    // Floors and the camera are optional in the speed lesson; they never change the company.
    : lesson === "speed" ? '.campaign-clock .time-menu, .room-controls, .walk-prompt, canvas'
    : '';
  const moving = lesson === "speed";

  useLayoutEffect(() => {
    const selector = scope ? `${ALWAYS}, ${scope}` : ALWAYS;
    const allowed = (el: Element) => !!el.closest(selector);
    const changed = new Map<HTMLElement, { aria: string | null; tab: string | null }>();
    const restore = (el: HTMLElement, before: { aria: string | null; tab: string | null }) => {
      if (el.getAttribute('aria-disabled') === 'true') {
        if (before.aria === null) el.removeAttribute('aria-disabled'); else el.setAttribute('aria-disabled', before.aria);
      }
      if (el.getAttribute('tabindex') === '-1') {
        if (before.tab === null) el.removeAttribute('tabindex'); else el.setAttribute('tabindex', before.tab);
      }
      el.classList.remove('chapter-zero-locked');
    };
    const sync = () => {
      changed.forEach((before, el) => {
        if (!el.isConnected) { restore(el, before); changed.delete(el); }
      });
      document.querySelectorAll<HTMLElement>(CONTROLS).forEach(el => {
        const container = !el.matches('button, a, input, select, textarea, summary, canvas, [role="button"], [role="tab"]');
        if (allowed(el) || container && el.querySelector(selector)) {
          const before = changed.get(el);
          if (before) { restore(el, before); changed.delete(el); }
        } else {
          if (!changed.has(el)) changed.set(el, { aria: el.getAttribute('aria-disabled'), tab: el.getAttribute('tabindex') });
          if (el.getAttribute('aria-disabled') !== 'true') el.setAttribute('aria-disabled', 'true');
          if (el.getAttribute('tabindex') !== '-1') el.setAttribute('tabindex', '-1');
          if (!el.classList.contains('chapter-zero-locked')) el.classList.add('chapter-zero-locked');
        }
      });
      if (document.activeElement instanceof HTMLElement && changed.has(document.activeElement)) {
        document.querySelector<HTMLElement>('.chapter-zero-guide h3')?.focus({ preventScroll: true });
      }
    };
    const stop = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
    const activation = (event: Event) => {
      const el = event.target;
      if (!(el instanceof Element) || allowed(el)) return;
      if (event.type === 'click' || el.closest(CONTROLS) || el.matches('.modal-backdrop')) stop(event);
    };
    const key = (event: KeyboardEvent) => {
      const el = event.target instanceof Element ? event.target : document.body;
      // Preserve browser commands such as reload and copy, while keeping them out of game handlers.
      if (event.ctrlKey || event.metaKey || event.altKey) { event.stopImmediatePropagation(); return; }
      if (event.key === 'Tab') return;
      if (el.closest('input, textarea, select') && allowed(el) && event.key !== 'Escape') { event.stopImmediatePropagation(); return; }
      // Keep native Space activation/scrolling, but do not let the room's walk shortcut see it.
      if (event.key === ' ' && !moving && allowed(el)) { event.stopImmediatePropagation(); return; }
      if (event.key.startsWith('Arrow') && !moving && !el.closest('.modal')) { event.stopImmediatePropagation(); return; }
      const letter = event.key.toLowerCase();
      if (letter === 'p') { if (lesson !== "run") stop(event); return; }
      if (['q', 'e', 'w', 'a', 's', 'd', 'pageup', 'pagedown'].includes(letter)) {
        if (!moving) {
          // Page keys still scroll the guide; they must not reach the floor shortcut.
          if (event.key === 'PageUp' || event.key === 'PageDown') event.stopImmediatePropagation(); else stop(event);
        }
        return;
      }
      if (event.key === 'Escape') {
        if (el.closest('[role="dialog"][aria-modal="true"]') && allowed(el)) return;
        stop(event);
        return;
      }
      if (!allowed(el) && (event.key === 'Enter' || event.key === ' ')) stop(event);
    };
    const wheel = (event: WheelEvent) => {
      if (!moving && event.target instanceof Element && event.target.closest('canvas')) event.stopImmediatePropagation();
    };
    sync();
    const observer = new MutationObserver(records => {
      const controlsChanged = records.some(record => [...record.addedNodes, ...record.removedNodes].some(node =>
        node instanceof Element && (node.matches(CONTROLS) || node.querySelector(CONTROLS))));
      if (controlsChanged) sync();
    });
    // Scene labels and quote positioning change classes each frame. Only new/removed controls need a rescan.
    observer.observe(document.body, { childList: true, subtree: true });
    for (const name of ['pointerdown', 'mousedown', 'click', 'dblclick']) window.addEventListener(name, activation, true);
    window.addEventListener('keydown', key, true);
    window.addEventListener('wheel', wheel, true);
    return () => {
      observer.disconnect();
      for (const name of ['pointerdown', 'mousedown', 'click', 'dblclick']) window.removeEventListener(name, activation, true);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('wheel', wheel, true);
      changed.forEach((before, el) => restore(el, before));
    };
  }, [scope, lesson, moving]);
}
