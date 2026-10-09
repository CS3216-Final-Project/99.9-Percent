import { createContext, useContext } from "react";

/**
 * How much detail the room is drawn with. "basic" is the pixel look: small
 * canvas textures and matte shading, cheap enough for software rendering.
 * "hd" adds photo-scanned surfaces, physically based shading and reflections,
 * and is used when a graphics card is drawing.
 */
export type Detail = "basic" | "hd";

/** What draws the canvas, known once the WebGL context exists. */
export type Renderer = "unknown" | "gpu" | "software";

/** A forced detail level from the page address (`?graphics=hd` or `?graphics=basic`), if any. */
export function detailOverride(search: string): Detail | null {
  const value = new URLSearchParams(search).get("graphics");
  return value === "hd" || value === "basic" ? value : null;
}

/**
 * The detail to draw with. Until the renderer is known it stays basic, so a
 * machine without a GPU never starts downloading HD textures.
 */
export function chooseDetail(renderer: Renderer, override: Detail | null): Detail {
  if (renderer === "unknown") return "basic";
  return override ?? (renderer === "gpu" ? "hd" : "basic");
}

export const DetailContext = createContext<Detail>("basic");

export function useDetail(): Detail {
  return useContext(DetailContext);
}
