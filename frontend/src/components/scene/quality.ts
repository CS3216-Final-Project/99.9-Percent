import type { GraphicsQuality } from "@/game/persist";
import type { Detail, Renderer } from "./detail";

/**
 * What the room costs to draw. Each knob is one that lowers the work per frame on a slow machine:
 * HD materials, the ambient-occlusion and glow pass, shadows, how many pixels are drawn, and how
 * often a frame is drawn. The interface and the equipment labels are HTML and are never affected.
 */
export interface QualityProfile {
  detail: Detail;
  /** Ambient occlusion, glow and anti-aliasing: the heaviest part of the HD finish. Only ever on with HD detail. */
  effects: boolean;
  shadows: boolean;
  shadowMapSize: number;
  shadowRadius: number;
  /** Pixels drawn per CSS pixel: one number, or the range the display's own density is clamped to. */
  dpr: number | [number, number];
  /** Frames a second when capped — only for drawing on the CPU, where every frame is expensive — or null to draw as often as the display asks. */
  fps: number | null;
}

const HIGH: QualityProfile = { detail: "hd", effects: true, shadows: true, shadowMapSize: 4096, shadowRadius: 3, dpr: [1, 1.75], fps: null };
const MEDIUM: QualityProfile = { detail: "hd", effects: false, shadows: true, shadowMapSize: 2048, shadowRadius: 2, dpr: 1, fps: null };
const LOW: QualityProfile = { detail: "basic", effects: false, shadows: false, shadowMapSize: 1024, shadowRadius: 1, dpr: 0.75, fps: null };
/** Drawing in software, without a graphics card: no shadows, half the pixels, 20 frames a second. */
const SOFTWARE: QualityProfile = { detail: "basic", effects: false, shadows: false, shadowMapSize: 1024, shadowRadius: 1, dpr: 0.5, fps: 20 };

const PRESETS: Record<Exclude<GraphicsQuality, "auto">, QualityProfile> = { high: HIGH, medium: MEDIUM, low: LOW };

/**
 * The profile to draw with. Auto means Medium on a graphics card and the lightest settings in software
 * rendering. High's effects pass alone halves a phone's frame rate and costs a weak laptop the same, while
 * Medium keeps the HD look; a player with the graphics card for it can choose High. Until the renderer is
 * known the room is not drawn, so detail stays basic and a machine without
 * a GPU never starts downloading HD textures. A forced detail from the page address (`?graphics=hd` or
 * `?graphics=basic`) overrides the profile's detail once the renderer is known; effects follow HD only.
 */
export function resolveQuality(quality: GraphicsQuality, renderer: Renderer, override: Detail | null = null): QualityProfile {
  const base = quality === "auto" ? (renderer === "software" ? SOFTWARE : MEDIUM) : PRESETS[quality];
  const detail = renderer === "unknown" ? "basic" : (override ?? base.detail);
  return { ...base, detail, effects: base.effects && detail === "hd" };
}

/** What the menu says about each choice. The first line is what it is; the second is what it costs or saves. */
export const QUALITY_OPTIONS: { id: GraphicsQuality; label: string; summary: string; details: string }[] = [
  {
    id: "auto",
    label: "Auto",
    summary: "Recommended. Picks Medium on a graphics card, easing off sharpness if the frame rate drops, and the lightest look when the browser draws on the CPU.",
    details: "Matches your machine",
  },
  {
    id: "high",
    label: "High",
    summary: "Photo textures, reflections, soft shadows, glow and ambient shading.",
    details: "Needs a graphics card",
  },
  {
    id: "medium",
    label: "Medium",
    summary: "Photo textures and shadows without the glow and ambient-shading pass, at the screen's normal pixel size.",
    details: "Smoother on laptops",
  },
  {
    id: "low",
    label: "Low",
    summary: "The flat pixel look with no shadows and fewer pixels.",
    details: "For older or low-powered machines",
  },
];

/** Auto never draws with fewer pixels than this per CSS pixel, however slow the machine. */
export const ADAPT_MIN_DPR = 0.75;

/** Whether Auto should watch the frame rate: only on a graphics card with the frame rate uncapped. */
export function adapts(quality: GraphicsQuality, renderer: Renderer, profile: QualityProfile): boolean {
  return quality === "auto" && renderer === "gpu" && profile.fps === null;
}

/**
 * The pixels per CSS pixel Auto draws with when the frame rate has fallen, as a share of its full quality from 1
 * down to 0: fewer the lower it falls, down to ADAPT_MIN_DPR. That needs no new canvas, so the camera stays put;
 * shadows and detail would, so they never change on their own. `deviceRatio` is the display's pixel density.
 */
export function adapt(profile: QualityProfile, factor: number, deviceRatio: number): number {
  // The profile's own pixels: a range is clamped to the display's density, as the canvas does with it.
  const top = Array.isArray(profile.dpr) ? Math.min(profile.dpr[1], Math.max(profile.dpr[0], deviceRatio)) : profile.dpr;
  const share = Math.min(1, Math.max(0, factor));
  const bottom = Math.min(ADAPT_MIN_DPR, top);
  return bottom + (top - bottom) * share;
}
