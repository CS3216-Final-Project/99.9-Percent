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
