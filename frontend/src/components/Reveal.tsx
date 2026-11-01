import { useState, type ReactNode } from "react";
import "./Reveal.css";

/**
 * Tweens its contents open and closed by height; once closed, the contents are hidden and inert. To fold away
 * rather than empty first, the caller keeps passing what it last showed while `open` is false.
 */
export function Reveal({ open, children }: { open: boolean; children: ReactNode }) {
  // Settled means the tween has finished opening, so the contents may overflow (focus rings, popovers).
  const [settled, setSettled] = useState(open);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    setSettled(false);
  }
  return (
    <div className="reveal" data-open={open || undefined} data-settled={(open && settled) || undefined}
      onTransitionEnd={(e) => { if (e.target === e.currentTarget && e.propertyName === "grid-template-rows" && open) setSettled(true); }}>
      <div className="reveal-inner" inert={!open} aria-hidden={!open || undefined}>{children}</div>
    </div>
  );
}
