import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./icons";

/** A disclosure that leaves the clock and primary action visible. */
export function DockMenu({ label, children, className = "" }: { label: ReactNode; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
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
