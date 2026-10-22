"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BUBBLE_CANVAS, bubbleTexture } from "./textures";

/*
 * A speech bubble over a creature's head, shared by the chatting groups (see chatter.tsx) and the crew's greetings
 * (see creatures.tsx). Bubbles keep the same size on screen at any zoom and hide when the office is zoomed too far
 * out to read them. They are drawn over everything and ignore the pointer, so clicks still reach the equipment.
 */

/** A bubble's size on screen, in pixels. */
export const BUBBLE_PX = 190;
/** Metres wide a bubble is, seen from the avatar. */
export const BUBBLE_WIDE = 1.3;
/** Metres wide a bubble may be per metre it is from the eye, so one right in front of the avatar does not fill the view. */
export const BUBBLE_NEAR = 0.55;
const tmp = new THREE.Vector3();
/** Below this zoom the office is too small for bubbles to read. */
export const BUBBLE_MIN_ZOOM = 22;
/** How far above a speaker's head the bubble's tail ends. */
export const ABOVE_HEAD = 0.12;
const noRaycast = () => {};

export function SpeechBubble({ text, alarmed, height, opacity }: { text: string; alarmed: boolean; height: number; /** How legible it is from the avatar, read every frame; full when not given. */ opacity?: () => number }) {
  const sprite = useRef<THREE.Sprite>(null);
  const material = useMemo(
    () => new THREE.SpriteMaterial({ map: bubbleTexture(text, alarmed), transparent: true, depthTest: false, depthWrite: false, toneMapped: false }),
    [text, alarmed],
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ camera }) => {
    const s = sprite.current;
    if (!s) return;
    // Seen from the avatar there is no zoom: the bubble keeps a size of its own above the speaker, shrinking when it
    // comes right up to the eye, and fades with distance instead.
    const flat = (camera as THREE.OrthographicCamera).isOrthographicCamera === true;
    const a = flat ? 1 : (opacity?.() ?? 1);
    s.visible = flat ? camera.zoom >= BUBBLE_MIN_ZOOM : a > 0.01;
    (s.material as THREE.SpriteMaterial).opacity = a;
    const w = flat ? BUBBLE_PX / camera.zoom : Math.min(BUBBLE_WIDE, camera.position.distanceTo(s.getWorldPosition(tmp)) * BUBBLE_NEAR);
    s.scale.set(w, (w * BUBBLE_CANVAS[1]) / BUBBLE_CANVAS[0], 1);
  });
  return <sprite ref={sprite} material={material} position={[0, height + ABOVE_HEAD, 0]} center={[0.5, 0]} renderOrder={1000} raycast={noRaycast} />;
}
