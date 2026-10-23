import type { ReactNode } from "react";
import type { Box } from "./spotlight";

/**
 * The dimmed stage with a lit window around what guidance points at, shared by the step tours and campaign
 * guidance. The overlay never catches clicks: everything under it stays reachable, including the framed control.
 */
export function Spotlight({ box, track, docked, children }: { box: Box | null; track?: string; docked?: boolean; children?: ReactNode }) {
  return (
    <div className="tour" data-track={track} data-guidance={track === "guidance" ? "spotlight" : undefined} data-docked={docked || undefined}>
      {box ? <div className="tour-hole" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} /> : <div className="tour-dim" />}
      {children}
    </div>
  );
}
