import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./icons";

/** A disclosure that leaves the clock and primary action visible. */
export function DockMenu({ label, children, className = "" }: { label: ReactNode; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const menu = ref.current;
    const dock = menu?.closest<HTMLElement>(".controls-dock");
    if (!menu || !dock) return;
    const positionPanel = () => {
      const trigger = menu.querySelector("summary"), panel = menu.querySelector<HTMLElement>(".dock-panel");
      if (!trigger || !panel) return;
      const bounds = dock.getBoundingClientRect(), gutter = parseFloat(getComputedStyle(dock).paddingLeft) || 8;
      const left = Math.max(8, bounds.left + gutter), right = Math.min(window.innerWidth - 8, bounds.right - gutter);
      panel.style.maxWidth = `${Math.max(0, right - left)}px`;
      const parent = panel.offsetParent as HTMLElement | null ?? dock;
      const panelWidth = panel.getBoundingClientRect().width || parseFloat(getComputedStyle(panel).width);
      // Keep the panel above the entire dock, but align its left edge with its own trigger.
      const x = Math.max(left, Math.min(trigger.getBoundingClientRect().left, right - panelWidth));
      panel.style.left = `${x - parent.getBoundingClientRect().left - parent.clientLeft}px`;
      panel.style.right = "auto";
    };
    positionPanel();
    menu.addEventListener("toggle", positionPanel);
    window.addEventListener("resize", positionPanel);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(positionPanel);
    observer?.observe(dock);
    return () => {
      menu.removeEventListener("toggle", positionPanel);
      window.removeEventListener("resize", positionPanel);
      observer?.disconnect();
    };
  }, []);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) ref.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !ref.current?.open) return;
      // A timed review or keyboard inspection can open a modal over an existing menu.
      // Its Escape handler and focus trap take priority over the controls behind it.
      if (event.target instanceof Element && event.target.closest('[role="dialog"][aria-modal="true"]')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      ref.current.open = false;
      ref.current.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", escape, true);
    };
  }, []);
  return <details ref={ref} name="bottom-controls" className={`dock-menu ${className}`}>
    <summary>{label}<Icon name="down" size={12} /></summary>
    <div className="dock-panel">{children}</div>
  </details>;
}
