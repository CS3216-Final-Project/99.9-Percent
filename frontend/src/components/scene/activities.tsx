"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ignoreRay } from "./furniture";
import { now } from "./ride";
import type { V3 } from "./shapes";
import { puffTexture, scoreTexture, starTexture, zzzTexture } from "./textures";
import { avatar, busyProgress } from "./walk";

/*
 * What each of the office's fun things shows while the avatar plays with it (see FUN_PROPS in floorplan.ts):
 * steam and a mug for a coffee, a bag dropping out of the vending machine, the cooler's bottle glugging as a
 * cup fills, scores popping over the arcade cabinets and a star burst to finish, and "z"s drifting out of the
 * nap pod's hood. Each reads `avatar.busy` every frame and draws only while its own prop is under way; nothing
 * here changes the game.
 */

/** 0 to 1 with the ends eased, the same curve the elevator ride uses. */
const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/** How far through its fun thing `id` the avatar is, or null while it is not playing it. */
const progress = (id: string, walking: boolean, t: number) => (walking && avatar.busy?.prop === id ? busyProgress(t) : null);

/** Where a thing held in front of the avatar is: creatures face -z at yaw 0. */
const held = (y = 0.5, ahead = 0.26): V3 => [avatar.x - Math.sin(avatar.yaw) * ahead, y, avatar.z - Math.cos(avatar.yaw) * ahead];
/** Things held are drawn a little larger than life, so they read in a cube pet's paws from across the room. */
const HELD_SCALE = 1.4;

/** 0 outside [a, b] and 1 through its middle, rising over the span's first tenth and falling over its last. */
const envelope = (f: number, a: number, b: number) => Math.min(smooth((f - a) / ((b - a) * 0.1)), smooth((b - f) / ((b - a) * 0.1)));

/** The espresso machine's steam wand, beside the mug it brews into. */
const COFFEE_WAND: V3 = [17.4, 1.0, -8.88];
/** A snack bag on the vending machine's top shelf, which drops to the collection bay's sill. */
const SNACK_START: V3 = [12.54, 1.58, -8.55];
const SNACK_SILL = 0.54;
/** The water cooler's bottle, whose water column the bubbles rise through. */
const COOLER_BOTTLE: [number, number] = [15.0, -4.0];
/** Where the paper cup stands on the water cooler's drip tray while it fills. */
const CUP_ON_TRAY: V3 = [15.2, 0.6775, -4.05];
/** The thin stream from the cooler's cold tap into the cup. */
const COOLER_STREAM: V3 = [15.19, 0.745, -4.05];
/** The sleeper's head at the pillow end of the first nap pod. */
const NAP_HEAD: V3 = [12.3, 0.95, 6.6];

/** The steam-wisp material every hot drink shares, brighter than the room so it shows against the pale kitchen wall. */
const steamMaterial = () => new THREE.SpriteMaterial({ map: puffTexture(), color: new THREE.Color(1.25, 1.3, 1.35), transparent: true, depthWrite: false, toneMapped: false });

/** Steam bursts from the espresso machine's wand while it brews, and the finished mug ends up in the avatar's hand. */
function CoffeeEffect({ walking }: { walking: boolean }) {
  const group = useRef<THREE.Group>(null);
  const mug = useRef<THREE.Group>(null);
  const wisps = useRef<(THREE.Sprite | null)[]>([]);
  const mugWisps = useRef<(THREE.Sprite | null)[]>([]);
  const steam = useMemo(() => Array.from({ length: 10 }, steamMaterial), []);
  const [white, coffee] = useMemo(() => [new THREE.MeshStandardMaterial({ color: "#fafafa" }), new THREE.MeshStandardMaterial({ color: "#3b2418" })], []);
  useEffect(() => () => [...steam, white, coffee].forEach((m) => m.dispose()), [steam, white, coffee]);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const t = now();
    const f = progress("espresso", walking, t);
    g.visible = f !== null;
    if (f === null || !avatar.busy) return;
    const since = avatar.busy.since;
    const steamOn = envelope(f, 0.05, 0.75);
    wisps.current.forEach((wisp, i) => {
      if (!wisp) return;
      const phase = ((t - since) / 1.1 + i / 8) % 1;
      wisp.position.set(COFFEE_WAND[0] + Math.sin(phase * 6 + i) * 0.05, COFFEE_WAND[1] + phase * 0.55, COFFEE_WAND[2]);
      const size = 0.08 + phase * 0.28;
      wisp.scale.set(size, size, 1);
      wisp.material.opacity = 0.9 * Math.sin(phase * Math.PI) * steamOn;
    });
    // The mug pops into the avatar's hand once the machine has done its bit, still steaming a little.
    const k = smooth((f - 0.55) / 0.12);
    if (mug.current) {
      const [x, y, z] = held(0.5);
      mug.current.position.set(x, y, z);
      mug.current.scale.setScalar(Math.max(k * HELD_SCALE, 1e-4));
      mug.current.visible = k > 0;
    }
    mugWisps.current.forEach((wisp, i) => {
      if (!wisp) return;
      const phase = ((t - since) / 0.9 + i / 2) % 1;
      wisp.position.set(0, 0.05 + phase * 0.25, 0);
      const size = 0.05 + phase * 0.12;
      wisp.scale.set(size, size, 1);
      wisp.material.opacity = 0.9 * Math.sin(phase * Math.PI);
    });
  });
  return (
    <group ref={group} visible={false}>
      {steam.slice(0, 8).map((m, i) => (
        <sprite
          key={i}
          ref={(el) => {
            wisps.current[i] = el;
          }}
          material={m}
          raycast={ignoreRay}
        />
      ))}
      <group ref={mug} visible={false}>
        <mesh raycast={ignoreRay} material={white}>
          <cylinderGeometry args={[0.035, 0.035, 0.07, 16]} />
        </mesh>
        <mesh position={[0.045, 0, 0]} raycast={ignoreRay} material={white}>
          <torusGeometry args={[0.02, 0.006, 8, 16]} />
        </mesh>
        <mesh position={[0, 0.036, 0]} raycast={ignoreRay} material={coffee}>
          <cylinderGeometry args={[0.03, 0.03, 0.004, 16]} />
        </mesh>
        {steam.slice(8, 10).map((m, i) => (
          <sprite
            key={i}
            ref={(el) => {
              mugWisps.current[i] = el;
            }}
            material={m}
            raycast={ignoreRay}
          />
        ))}
      </group>
    </group>
  );
}

/** A snack bag tumbles out of the vending machine's top shelf into the collection bay, then into the avatar's hand. */
function SnackEffect({ walking }: { walking: boolean }) {
  const group = useRef<THREE.Group>(null);
  const bag = useRef<THREE.Group>(null);
  const materials = useMemo(() => [new THREE.MeshStandardMaterial({ color: "#ff9f43" }), new THREE.MeshStandardMaterial({ color: "#fafafa" })], []);
  const [orange, stripe] = materials;
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const t = now();
    const f = progress("vending", walking, t);
    g.visible = f !== null;
    if (f === null || !bag.current) return;
    if (f >= 0.12 && f < 0.42) {
      // Off the shelf, falling faster as it goes, and swallowed by the bay at its sill.
      const u = (f - 0.12) / 0.3;
      bag.current.position.set(SNACK_START[0], SNACK_START[1] - (SNACK_START[1] - SNACK_SILL) * u * u, SNACK_START[2]);
      bag.current.rotation.set(u * 5, 0, 0);
      bag.current.scale.setScalar(1);
      bag.current.visible = true;
    } else if (f >= 0.62) {
      const [x, y, z] = held(0.5);
      bag.current.position.set(x, y + Math.sin(t * 8) * 0.01, z);
      bag.current.rotation.set(0.4, 0, 0);
      bag.current.scale.setScalar(Math.max(smooth((f - 0.62) / 0.1) * HELD_SCALE, 1e-4));
      bag.current.visible = true;
    } else bag.current.visible = false;
  });
  return (
    <group ref={group} visible={false}>
      <group ref={bag} visible={false}>
        <mesh raycast={ignoreRay} material={orange}>
          <boxGeometry args={[0.075, 0.13, 0.03]} />
        </mesh>
        <mesh position={[0, 0.018, 0]} raycast={ignoreRay} material={stripe}>
          <boxGeometry args={[0.076, 0.022, 0.031]} />
        </mesh>
      </group>
    </group>
  );
}

/** The water cooler's bottle glugs while the cup fills on its drip tray, then the cup ends up in the avatar's hand. */
function WaterEffect({ walking }: { walking: boolean }) {
  const group = useRef<THREE.Group>(null);
  const cup = useRef<THREE.Group>(null);
  const bubbles = useRef<(THREE.Mesh | null)[]>([]);
  const stream = useRef<THREE.Mesh>(null);
  const materials = useMemo(
    () => [
      ...Array.from({ length: 6 }, () => new THREE.MeshBasicMaterial({ color: "#e6f6ff", transparent: true, depthWrite: false, toneMapped: false })),
      new THREE.MeshStandardMaterial({ color: "#fafafa" }),
      new THREE.MeshBasicMaterial({ color: "#7cc7ff", transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }),
    ],
    [],
  );
  const [cupWhite, streamBlue] = materials.slice(6);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const t = now();
    const f = progress("cooler", walking, t);
    g.visible = f !== null;
    if (f === null || !avatar.busy) return;
    const since = avatar.busy.since;
    const glugging = envelope(f, 0.08, 0.78);
    bubbles.current.forEach((bubble, i) => {
      if (!bubble) return;
      // Each bubble wobbles up through the bottle's water column and bursts at the surface.
      const phase = ((t - since) / 0.8 + i * 0.17) % 1;
      bubble.position.set(COOLER_BOTTLE[0] + Math.sin(phase * 12 + i) * 0.03 + Math.cos(i) * 0.04, 1.1 + 0.19 * phase, COOLER_BOTTLE[1] + Math.sin(i * 1.7) * 0.04);
      bubble.scale.setScalar(0.6 + 0.5 * phase);
      (bubble.material as THREE.MeshBasicMaterial).opacity = 0.9 * glugging * (phase < 0.88 ? 1 : (1 - phase) / 0.12);
    });
    if (cup.current) {
      if (f >= 0.05 && f < 0.78) {
        cup.current.position.set(CUP_ON_TRAY[0], CUP_ON_TRAY[1], CUP_ON_TRAY[2]);
        cup.current.rotation.set(0, 0, 0);
        cup.current.scale.setScalar(Math.max(smooth((f - 0.05) / 0.08), 1e-4));
        cup.current.visible = true;
      } else if (f >= 0.78) {
        const [x, y, z] = held(0.5);
        cup.current.position.set(x, y + Math.sin(t * 8) * 0.01, z);
        cup.current.rotation.set(0, 0, 0);
        cup.current.scale.setScalar(Math.max(smooth((f - 0.78) / 0.08) * HELD_SCALE, 1e-4));
        cup.current.visible = true;
      } else cup.current.visible = false;
    }
    if (stream.current) stream.current.visible = f >= 0.12 && f <= 0.7;
  });
  return (
    <group ref={group} visible={false}>
      {materials.slice(0, 6).map((m, i) => (
        <mesh
          key={i}
          ref={(el) => {
            bubbles.current[i] = el;
          }}
          material={m}
          raycast={ignoreRay}
        >
          <sphereGeometry args={[0.014, 8, 6]} />
        </mesh>
      ))}
      <mesh ref={stream} position={COOLER_STREAM} visible={false} raycast={ignoreRay} material={streamBlue}>
        <cylinderGeometry args={[0.004, 0.004, 0.05, 6]} />
      </mesh>
      <group ref={cup} visible={false}>
        <mesh raycast={ignoreRay} material={cupWhite}>
          <cylinderGeometry args={[0.03, 0.024, 0.08, 14]} />
        </mesh>
      </group>
    </group>
  );
}

/** A score pops over whichever cabinet it was won on, for 0.9 s each. */
const SCORES: { text: string; start: number; x: number }[] = [
  { text: "+100", start: 0.15, x: 20.4 },
  { text: "+250", start: 0.45, x: 21.3 },
  { text: "+500", start: 0.75, x: 20.4 },
];

/** Scores pop over the arcade cabinets as they are won, and a burst of stars celebrates the last one. */
function ArcadeEffect({ walking }: { walking: boolean }) {
  const group = useRef<THREE.Group>(null);
  const pops = useRef<(THREE.Sprite | null)[]>([]);
  const stars = useRef<(THREE.Sprite | null)[]>([]);
  const materials = useMemo(
    () => [
      ...SCORES.map((s) => new THREE.SpriteMaterial({ map: scoreTexture(s.text), transparent: true, depthWrite: false, toneMapped: false })),
      ...Array.from({ length: 8 }, () => new THREE.SpriteMaterial({ map: starTexture(), transparent: true, depthWrite: false, toneMapped: false })),
    ],
    [],
  );
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const t = now();
    const f = progress("arcade", walking, t);
    g.visible = f !== null;
    if (f === null || !avatar.busy) return;
    const { since, until } = avatar.busy;
    const seconds = until - since;
    pops.current.forEach((sprite, i) => {
      if (!sprite) return;
      const u = (t - since - SCORES[i].start * seconds) / 0.9;
      sprite.visible = u >= 0 && u <= 1;
      if (!sprite.visible) return;
      sprite.position.set(SCORES[i].x, 1.95 + 0.45 * u, 10.6);
      const w = 0.42 + 0.1 * u;
      // The score texture is 128 by 64, so the sprite is half as tall as it is wide.
      sprite.scale.set(w, w / 2, 1);
      sprite.material.opacity = u < 0.6 ? 1 : (1 - u) / 0.4;
    });
    stars.current.forEach((sprite, i) => {
      if (!sprite) return;
      const u = (f - 0.8) / 0.2;
      sprite.visible = u >= 0 && u <= 1;
      if (!sprite.visible) return;
      const a = (i / 8) * Math.PI * 2;
      sprite.position.set(avatar.x + Math.cos(a) * 0.45 * u, 0.9 + 0.35 * u - 0.5 * u * u, avatar.z + Math.sin(a) * 0.45 * u);
      const size = 0.18 * (1 - u * 0.3);
      sprite.scale.set(size, size, 1);
      sprite.material.opacity = 1 - u;
    });
  });
  return (
    <group ref={group} visible={false}>
      {SCORES.map((s, i) => (
        <sprite
          key={s.text}
          ref={(el) => {
            pops.current[i] = el;
          }}
          material={materials[i]}
          visible={false}
          raycast={ignoreRay}
        />
      ))}
      {materials.slice(3).map((m, i) => (
        <sprite
          key={i}
          ref={(el) => {
            stars.current[i] = el;
          }}
          material={m}
          visible={false}
          raycast={ignoreRay}
        />
      ))}
    </group>
  );
}

/** "z"s drift out of the nap pod's hood while the avatar sleeps in it, drawn through the hood so they read. */
function NapEffect({ walking }: { walking: boolean }) {
  const group = useRef<THREE.Group>(null);
  const sprites = useRef<(THREE.Sprite | null)[]>([]);
  const materials = useMemo(() => Array.from({ length: 3 }, () => new THREE.SpriteMaterial({ map: zzzTexture(), transparent: true, depthWrite: false, depthTest: false })), []);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const t = now();
    const f = progress("nap", walking, t);
    g.visible = f !== null;
    if (f === null || !avatar.busy) return;
    const since = avatar.busy.since;
    const snoring = envelope(f, 0.12, 0.92);
    sprites.current.forEach((sprite, i) => {
      if (!sprite) return;
      const phase = ((t - since) / 1.4 + i / 3) % 1;
      sprite.position.set(NAP_HEAD[0] - 0.9 * phase, NAP_HEAD[1] + 0.5 * phase * phase, NAP_HEAD[2] - 0.15 * phase);
      const size = 0.18 + phase * 0.2;
      sprite.scale.set(size, size, 1);
      sprite.material.opacity = Math.sin(phase * Math.PI) * snoring;
    });
  });
  return (
    <group ref={group} visible={false}>
      {materials.map((m, i) => (
        <sprite
          key={i}
          ref={(el) => {
            sprites.current[i] = el;
          }}
          material={m}
          raycast={ignoreRay}
        />
      ))}
    </group>
  );
}

/** Every fun thing's effect on the office floor, each drawing itself only while its own prop is under way. */
export function ActivityEffects({ walking }: { walking: boolean }) {
  return (
    <>
      <CoffeeEffect walking={walking} />
      <SnackEffect walking={walking} />
      <WaterEffect walking={walking} />
      <ArcadeEffect walking={walking} />
      <NapEffect walking={walking} />
    </>
  );
}
