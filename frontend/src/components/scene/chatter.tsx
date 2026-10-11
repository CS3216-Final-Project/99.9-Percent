"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { SPECIES } from "./cast";
import { memberRotation, turnAt, type Group, type Turn } from "./conversations";
import { Creature } from "./creatures";
import { BUBBLE_CANVAS, bubbleTexture } from "./textures";

/*
 * Groups of crew chatting (see conversations.ts), with a speech bubble over
 * whoever is speaking. Bubbles keep the same size on screen at any zoom and
 * hide when the office is zoomed too far out to read them. They are drawn over
 * everything and ignore the pointer, so clicks still reach the equipment.
 */

/** A bubble's size on screen, in pixels. */
const BUBBLE_PX = 190;
/** Below this zoom the office is too small for bubbles to read. */
const BUBBLE_MIN_ZOOM = 22;
/** How far above a speaker's head the bubble's tail ends. */
const ABOVE_HEAD = 0.12;
const noRaycast = () => {};

function SpeechBubble({ text, alarmed, height }: { text: string; alarmed: boolean; height: number }) {
  const sprite = useRef<THREE.Sprite>(null);
  const material = useMemo(
    () => new THREE.SpriteMaterial({ map: bubbleTexture(text, alarmed), transparent: true, depthTest: false, depthWrite: false, toneMapped: false }),
    [text, alarmed],
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ camera }) => {
    const s = sprite.current;
    if (!s) return;
    const zoom = camera.zoom;
    s.visible = zoom >= BUBBLE_MIN_ZOOM;
    const w = BUBBLE_PX / zoom;
    s.scale.set(w, (w * BUBBLE_CANVAS[1]) / BUBBLE_CANVAS[0], 1);
  });
  return <sprite ref={sprite} material={material} position={[0, height + ABOVE_HEAD, 0]} center={[0.5, 0]} renderOrder={1000} raycast={noRaycast} />;
}

/** A group chatting: the speaker talks while the rest listen, or panic during an incident. */
export function Conversation({ group, incident }: { group: Group; incident: boolean }) {
  const [turn, setTurn] = useState<Turn>(() => turnAt(group, 0, incident));
  const shown = useRef(turn);
  useFrame(({ clock }) => {
    const next = turnAt(group, clock.elapsedTime, incident);
    // Only a new speaker or line needs React.
    if (next.speaker !== shown.current.speaker || next.line !== shown.current.line) {
      shown.current = next;
      setTurn(next);
    }
  });
  return (
    <group>
      {group.members.map((m, i) => {
        const speaking = i === turn.speaker;
        return (
          <group key={i} position={[m.x, 0, m.z]}>
            <Creature species={m.species} activity={speaking ? "chat" : incident ? "panic" : "idle"} position={[0, 0, 0]} rotation={memberRotation(group, i)} phase={i * 2.3 + group.offset} />
            {speaking && turn.line && <SpeechBubble text={turn.line} alarmed={incident} height={SPECIES[m.species].height} />}
          </group>
        );
      })}
    </group>
  );
}
