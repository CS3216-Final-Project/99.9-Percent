"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { onArcadeEvent } from "./arcade";
import { NAP_PODS } from "./floorplan";
import { ignoreRay } from "./furniture";
import { coffee, nap, snack, water } from "./funScript";
import { now } from "./ride";
import type { V3 } from "./shapes";
import { puffTexture, scoreTexture, starTexture, zzzTexture } from "./textures";
import { cameras, viewNow } from "./viewState";
import { avatar, avatarBounds, busyProgress } from "./walk";

/*
 * What each of the office's fun things shows while the avatar plays with it (see FUN_PROPS in floorplan.ts and
 * the timelines in funScript.ts): steam and a mug raised and tipped for a coffee, a snack bag dropping out of the
 * vending machine and bitten, the cooler's cup filling then gulped and crushed, the arcade's real score pops and
 * a star burst for a win, and "z"s out of the nap pod's hood. In first person the held things are drawn in front
 * of the camera itself. Each reads `avatar.busy` every frame and draws only while its own prop is under way;
 * nothing here changes the game.
 */

/** How far through its fun thing `id` the avatar is, or null while it is not playing it. */
const progress = (id: string, walking: boolean, t: number) => (walking && avatar.busy?.prop === id ? busyProgress(t) : null);

/**
 * Where a thing held in front of the avatar is: creatures face -z at yaw 0. Resting it is a paw's reach beyond
 * the nose (a cube pet's head is deeper than a short reach); raised it is at the mouth, a little higher.
 */
const held = (raise: number): V3 => {
  const ahead = avatarBounds.depth / 2 + 0.11 - 0.06 * raise;
  return [avatar.x - Math.sin(avatar.yaw) * ahead, avatarBounds.height * (0.5 + 0.12 * raise), avatar.z - Math.cos(avatar.yaw) * ahead];
};
/** Things held are drawn a little larger than life, so they read in a cube pet's paws from across the room. */
const HELD_SCALE = 1.4;

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
/** The sleeper's head at the pillow end of the first nap pod, just under the hood's edge. */
const NAP_HEAD: V3 = [NAP_PODS[0][0] + 0.1, 0.9, NAP_PODS[0][1]];
/** The snack's bites and the crumbs that follow them, by progress through the vending's six seconds. */
const BITES = [0.5, 0.64, 0.78];

/** The materials the held things share between their in-world and first-person copies. */
interface PropMaterials {
  white: THREE.Material;
  /** The paper cup's wall: drawn both sides, so the open top shows the water inside. */
  cupWhite: THREE.Material;
  coffee: THREE.Material;
  /** The snack packet's body: blue, so it stands out against the orange cube animals. */
  packet: THREE.Material;
  stripe: THREE.Material;
  water: THREE.Material;
}

/** The steam-wisp material every hot drink shares, brighter than the room so it shows against the pale kitchen wall. */
const steamMaterial = () => new THREE.SpriteMaterial({ map: puffTexture(), color: new THREE.Color(1.25, 1.3, 1.35), transparent: true, depthWrite: false, toneMapped: false });

/** The little mug the espresso machine fills, cylinder and handle as in the kitchen's racks. */
function Mug({ mats }: { mats: PropMaterials }) {
  return (
    <>
      <mesh raycast={ignoreRay} material={mats.white}>
        <cylinderGeometry args={[0.035, 0.035, 0.07, 16]} />
      </mesh>
      <mesh position={[0.045, 0, 0]} raycast={ignoreRay} material={mats.white}>
        <torusGeometry args={[0.02, 0.006, 8, 16]} />
      </mesh>
      <mesh position={[0, 0.036, 0]} raycast={ignoreRay} material={mats.coffee}>
        <cylinderGeometry args={[0.03, 0.03, 0.004, 16]} />
      </mesh>
    </>
  );
}

/** The snack bag the vending machine drops, a bright packet with a pale stripe. */
function Bag({ mats }: { mats: PropMaterials }) {
  return (
    <>
      <mesh raycast={ignoreRay} material={mats.packet}>
        <boxGeometry args={[0.075, 0.13, 0.03]} />
      </mesh>
      <mesh position={[0, 0.018, 0]} raycast={ignoreRay} material={mats.stripe}>
        <boxGeometry args={[0.076, 0.022, 0.031]} />
      </mesh>
    </>
  );
}

/** The cooler's paper cup, open at the top so the water it holds shows, with the water inside falling as it is drunk. */
function Cup({ mats, waterRef }: { mats: PropMaterials; waterRef?: (el: THREE.Mesh | null) => void }) {
  return (
    <>
      <mesh raycast={ignoreRay} material={mats.cupWhite}>
        <cylinderGeometry args={[0.03, 0.024, 0.08, 14, 1, true]} />
      </mesh>
      <mesh position={[0, -0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={ignoreRay} material={mats.white}>
        <circleGeometry args={[0.024, 14]} />
      </mesh>
      <mesh ref={waterRef} position={[0, 0, 0]} raycast={ignoreRay} material={mats.water}>
        <cylinderGeometry args={[0.026, 0.02, 0.07, 12]} />
      </mesh>
    </>
  );
}

/** Steam bursts from the espresso machine's wand while it brews, and the finished mug is raised and sipped twice. */
function CoffeeEffect({ walking, mats }: { walking: boolean; mats: PropMaterials }) {
  const group = useRef<THREE.Group>(null);
  const mug = useRef<THREE.Group>(null);
  const wisps = useRef<(THREE.Sprite | null)[]>([]);
  const mugWisps = useRef<(THREE.Sprite | null)[]>([]);
  const ahhs = useRef<(THREE.Sprite | null)[]>([]);
  const steam = useMemo(() => Array.from({ length: 12 }, steamMaterial), []);
  useEffect(() => () => steam.forEach((m) => m.dispose()), [steam]);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const t = now();
    const f = progress("espresso", walking, t);
    g.visible = f !== null;
    if (f === null || !avatar.busy) return;
    const since = avatar.busy.since;
    const c = coffee(f);
    wisps.current.forEach((wisp, i) => {
      if (!wisp) return;
      const phase = ((t - since) / 1.1 + i / 8) % 1;
      wisp.position.set(COFFEE_WAND[0] + Math.sin(phase * 6 + i) * 0.05, COFFEE_WAND[1] + phase * 0.55, COFFEE_WAND[2]);
      const size = 0.08 + phase * 0.28;
      wisp.scale.set(size, size, 1);
      wisp.material.opacity = 0.9 * Math.sin(phase * Math.PI) * c.steam;
    });
    // The mug is taken up once the machine has done its bit, lifted to the mouth and tipped back with each sip.
    if (mug.current) {
      const [x, y, z] = held(c.raise);
      mug.current.position.set(x, y, z);
      mug.current.rotation.set(c.tilt * 0.9, avatar.yaw, 0, "YXZ");
      mug.current.scale.setScalar(Math.max(c.mug * HELD_SCALE, 1e-4));
      mug.current.visible = c.mug > 0 && !viewNow.inHead;
    }
    mugWisps.current.forEach((wisp, i) => {
      if (!wisp) return;
      const phase = ((t - since) / 0.9 + i / 2) % 1;
      wisp.position.set(0, 0.05 + phase * 0.25, 0);
      const size = 0.05 + phase * 0.12;
      wisp.scale.set(size, size, 1);
      wisp.material.opacity = 0.9 * Math.sin(phase * Math.PI);
    });
    // A small "ahh" of breath after each sip, a wisp rising from the mouth.
    ahhs.current.forEach((wisp, i) => {
      if (!wisp) return;
      // Just after each sip ends, a beat long.
      const u = (f - [0.66, 0.88][i]) / 0.08;
      const on = c.mug > 0 && u >= 0 && u <= 1 && !viewNow.inHead;
      wisp.visible = on;
      if (!on) return;
      const [x, y, z] = held(1);
      wisp.position.set(x, y + u * 0.14, z);
      const size = 0.05 + u * 0.12;
      wisp.scale.set(size, size, 1);
      wisp.material.opacity = 0.7 * Math.sin(u * Math.PI);
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
        <Mug mats={mats} />
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
      {steam.slice(10, 12).map((m, i) => (
        <sprite
          key={i}
          ref={(el) => {
            ahhs.current[i] = el;
          }}
          material={m}
          raycast={ignoreRay}
          visible={false}
        />
      ))}
    </group>
  );
}

/** A snack bag tumbles out of the vending machine into the collection bay, then is picked up and eaten in three bites. */
function SnackEffect({ walking, mats }: { walking: boolean; mats: PropMaterials }) {
  const group = useRef<THREE.Group>(null);
  const bag = useRef<THREE.Group>(null);
  const crumbs = useRef<(THREE.Sprite | null)[]>([]);
  const crumbMats = useMemo(() => Array.from({ length: 6 }, () => new THREE.SpriteMaterial({ map: puffTexture(), color: "#ffb36b", transparent: true, depthWrite: false, toneMapped: false })), []);
  useEffect(() => () => crumbMats.forEach((m) => m.dispose()), [crumbMats]);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const t = now();
    const f = progress("vending", walking, t);
    g.visible = f !== null;
    if (f === null || !avatar.busy || !bag.current) return;
    const s = snack(f);
    if (f >= 0.03 && f < 0.3) {
      // Off the shelf, falling faster as it goes, and swallowed by the bay at its sill.
      const u = (f - 0.03) / 0.27;
      bag.current.position.set(SNACK_START[0], SNACK_START[1] - (SNACK_START[1] - SNACK_SILL) * u * u, SNACK_START[2]);
      bag.current.rotation.set(u * 5, 0, 0);
      bag.current.scale.setScalar(s.bag);
      bag.current.visible = true;
    } else if (f >= 0.3) {
      // Picked up and raised to the mouth for each bite, crumpling as it is done with.
      const [x, y, z] = held(s.raise);
      bag.current.position.set(x, y, z);
      bag.current.rotation.set(0.4, 0, 0);
      bag.current.scale.set(HELD_SCALE * s.bag, HELD_SCALE * s.bag * (1 - 0.6 * s.crumple), HELD_SCALE * s.bag);
      bag.current.visible = s.bag > 0 && !viewNow.inHead;
    } else bag.current.visible = false;
    // Crumbs sprinkle down from the mouth on the bag's opening and with each bite.
    crumbs.current.forEach((crumb, i) => {
      if (!crumb) return;
      let u = -1;
      for (const a of [0.4, ...BITES]) {
        const v = (f - a) / 0.1 - i * 0.05;
        if (v >= 0 && v <= 1) u = v;
      }
      const on = s.crumbs && u >= 0 && !viewNow.inHead;
      crumb.visible = on;
      if (!on) return;
      const [x, y, z] = held(1);
      crumb.position.set(x + Math.sin(i * 2.4) * 0.05, y - u * 0.3, z + Math.cos(i * 1.7) * 0.05);
      crumb.scale.setScalar(0.02);
      crumb.material.opacity = 0.9 * (1 - u);
    });
  });
  return (
    <group ref={group} visible={false}>
      <group ref={bag} visible={false}>
        <Bag mats={mats} />
      </group>
      {crumbMats.map((m, i) => (
        <sprite
          key={i}
          ref={(el) => {
            crumbs.current[i] = el;
          }}
          material={m}
          raycast={ignoreRay}
          visible={false}
        />
      ))}
    </group>
  );
}

/** The water cooler's bottle glugs while the cup fills on its drip tray, then the cup is gulped and crushed. */
function WaterEffect({ walking, mats }: { walking: boolean; mats: PropMaterials }) {
  const group = useRef<THREE.Group>(null);
  const cup = useRef<THREE.Group>(null);
  const inside = useRef<THREE.Mesh>(null);
  const bubbles = useRef<(THREE.Mesh | null)[]>([]);
  const stream = useRef<THREE.Mesh>(null);
  const bubbleMats = useMemo(() => Array.from({ length: 6 }, () => new THREE.MeshBasicMaterial({ color: "#e6f6ff", transparent: true, depthWrite: false, toneMapped: false })), []);
  useEffect(() => () => bubbleMats.forEach((m) => m.dispose()), [bubbleMats]);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const t = now();
    const f = progress("cooler", walking, t);
    g.visible = f !== null;
    if (f === null || !avatar.busy) return;
    const since = avatar.busy.since;
    const w = water(f);
    // The bottle glugs only while the tap runs.
    bubbles.current.forEach((bubble, i) => {
      if (!bubble) return;
      // Each bubble wobbles up through the bottle's water column and bursts at the surface.
      const phase = ((t - since) / 0.8 + i * 0.17) % 1;
      bubble.position.set(COOLER_BOTTLE[0] + Math.sin(phase * 12 + i) * 0.03 + Math.cos(i) * 0.04, 1.1 + 0.19 * phase, COOLER_BOTTLE[1] + Math.sin(i * 1.7) * 0.04);
      bubble.scale.setScalar(0.6 + 0.5 * phase);
      (bubble.material as THREE.MeshBasicMaterial).opacity = 0.9 * (w.stream ? 1 : 0) * (phase < 0.88 ? 1 : (1 - phase) / 0.12);
    });
    if (cup.current) {
      if (f < 0.4) {
        cup.current.position.set(CUP_ON_TRAY[0], CUP_ON_TRAY[1], CUP_ON_TRAY[2]);
        cup.current.rotation.set(0, 0, 0);
        cup.current.scale.setScalar(Math.max(w.cup, 1e-4));
      } else {
        // Lifted to the mouth and tipped further toward the face with each gulp, then crushed flat away.
        const [x, y, z] = held(w.raise);
        cup.current.position.set(x, y, z);
        cup.current.rotation.set(w.tilt * 1.1, avatar.yaw, 0, "YXZ");
        cup.current.scale.set(Math.max(w.cup * HELD_SCALE * (1 + 0.2 * w.crushed), 1e-4), Math.max(w.cup * HELD_SCALE * (1 - 0.75 * w.crushed), 1e-4), Math.max(w.cup * HELD_SCALE, 1e-4));
      }
      cup.current.visible = w.cup > 0 && !(viewNow.inHead && f >= 0.4);
    }
    if (inside.current) {
      // The water's top drops as it is drunk: scale keeps the bottom of the inside fixed.
      inside.current.scale.y = Math.max(w.level, 1e-4);
      inside.current.position.y = -0.035 + 0.035 * w.level;
    }
    if (stream.current) stream.current.visible = w.stream;
  });
  return (
    <group ref={group} visible={false}>
      {bubbleMats.map((m, i) => (
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
      <mesh ref={stream} position={COOLER_STREAM} visible={false} raycast={ignoreRay} material={mats.water}>
        <cylinderGeometry args={[0.004, 0.004, 0.05, 6]} />
      </mesh>
      <group ref={cup} visible={false}>
        <Cup
          mats={mats}
          waterRef={(el) => {
            inside.current = el;
          }}
        />
      </group>
    </group>
  );
}

/** A real score pop over the red cabinet for each brick the ball broke, and a star burst when the game is won. */
function ArcadeEffect({ walking }: { walking: boolean }) {
  const group = useRef<THREE.Group>(null);
  const pops = useRef<(THREE.Sprite | null)[]>([]);
  const stars = useRef<(THREE.Sprite | null)[]>([]);
  const popMats = useMemo(() => Array.from({ length: 6 }, () => new THREE.SpriteMaterial({ transparent: true, depthWrite: false, toneMapped: false })), []);
  const starMats = useMemo(() => Array.from({ length: 8 }, () => new THREE.SpriteMaterial({ map: starTexture(), transparent: true, depthWrite: false, toneMapped: false })), []);
  useEffect(() => () => [...popMats, ...starMats].forEach((m) => m.dispose()), [popMats, starMats]);
  /** The six slots score pops cycle through, as "+value" and when it popped. */
  const queue = useRef<{ at: number; slot: number }[]>([]);
  const starsAt = useRef(-Infinity);
  const nextSlot = useRef(0);
  useEffect(
    () =>
      onArcadeEvent((e) => {
        const t = now();
        if (e.kind === "brick") {
          const slot = nextSlot.current % 6;
          nextSlot.current += 1;
          const m = popMats[slot];
          m.map = scoreTexture(`+${e.value}`);
          m.needsUpdate = true;
          queue.current[slot] = { at: t, slot };
        } else if (e.kind === "won") {
          starsAt.current = t;
        }
      }),
    [popMats],
  );
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const t = now();
    const playing = walking && avatar.busy?.prop === "arcade";
    g.visible = playing;
    if (!playing) return;
    pops.current.forEach((sprite, i) => {
      if (!sprite) return;
      const entry = queue.current[i];
      const u = entry ? (t - entry.at) / 0.9 : -1;
      sprite.visible = u >= 0 && u <= 1;
      if (!sprite.visible) return;
      // Over the red cabinet, drifting up.
      sprite.position.set(21.3, 1.95 + 0.45 * u, 10.6);
      const w = 0.42 + 0.1 * u;
      // The score texture is 128 by 64, so the sprite is half as tall as it is wide.
      sprite.scale.set(w, w / 2, 1);
      sprite.material.opacity = u < 0.6 ? 1 : (1 - u) / 0.4;
    });
    stars.current.forEach((sprite, i) => {
      if (!sprite) return;
      const u = (t - starsAt.current) / 0.8;
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
      {popMats.map((m, i) => (
        <sprite
          key={i}
          ref={(el) => {
            pops.current[i] = el;
          }}
          material={m}
          visible={false}
          raycast={ignoreRay}
        />
      ))}
      {starMats.map((m, i) => (
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
    g.visible = f !== null && nap(f).asleep;
    if (!g.visible || !avatar.busy) return;
    const since = avatar.busy.since;
    sprites.current.forEach((sprite, i) => {
      if (!sprite) return;
      const phase = ((t - since) / 1.4 + i / 3) % 1;
      sprite.position.set(NAP_HEAD[0] - 0.9 * phase, NAP_HEAD[1] + 0.5 * phase * phase, NAP_HEAD[2] - 0.15 * phase);
      const size = 0.18 + phase * 0.2;
      sprite.scale.set(size, size, 1);
      sprite.material.opacity = Math.sin(phase * Math.PI);
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

/**
 * The held things seen through the avatar's eyes: the mug, bag or cup at the lower edge of the view while its
 * activity is under way, lifting toward the middle as it is drunk or eaten, the mug steaming past the lens. They
 * are children of the perspective camera, so they ride the view without any per-frame copying.
 */
function ViewModels({ mats }: { mats: PropMaterials }) {
  const mug = useRef<THREE.Group>(null);
  const bag = useRef<THREE.Group>(null);
  const cup = useRef<THREE.Group>(null);
  const inside = useRef<THREE.Mesh>(null);
  const wisps = useRef<(THREE.Sprite | null)[]>([]);
  const steam = useMemo(() => Array.from({ length: 2 }, steamMaterial), []);
  useEffect(() => () => steam.forEach((m) => m.dispose()), [steam]);
  useFrame(() => {
    const t = now();
    const inHead = viewNow.inHead;
    const set = (g: THREE.Group | null, show: boolean, raise: number, tilt: number, shown: number) => {
      if (!g) return;
      g.visible = show && shown > 0;
      if (!g.visible) return;
      g.position.set(0.16 - 0.13 * raise, -0.14 + 0.07 * raise, -0.4 + 0.14 * raise);
      g.rotation.set(tilt * 0.9, 0, 0, "YXZ");
      g.scale.setScalar(Math.max(HELD_SCALE * shown, 1e-4));
    };
    const cf = inHead ? progress("espresso", true, t) : null;
    const c = cf === null ? null : coffee(cf);
    set(mug.current, c !== null, c?.raise ?? 0, c?.tilt ?? 0, c?.mug ?? 0);
    wisps.current.forEach((wisp, i) => {
      if (!wisp) return;
      const on = c !== null && c.mug > 0;
      wisp.visible = on;
      if (!on) return;
      const phase = (t / 0.9 + i / 2) % 1;
      wisp.position.set(0, 0.05 + phase * 0.2, 0.02);
      const size = 0.04 + phase * 0.1;
      wisp.scale.set(size, size, 1);
      wisp.material.opacity = 0.8 * Math.sin(phase * Math.PI);
    });
    const sf = inHead ? progress("vending", true, t) : null;
    const s = sf === null ? null : snack(sf);
    set(bag.current, s !== null, s?.raise ?? 0, 0, s?.bag ?? 0);
    const wf = inHead ? progress("cooler", true, t) : null;
    const w = wf === null ? null : water(wf);
    // The first-person camera looks slightly down on the cup, so it tips further for the water to show.
    set(cup.current, w !== null, w?.raise ?? 0, (w?.tilt ?? 0) * 1.5, w?.cup ?? 0);
    if (inside.current) {
      inside.current.scale.y = Math.max(w?.level ?? 0, 1e-4);
      inside.current.position.y = -0.035 + 0.035 * (w?.level ?? 0);
    }
  });
  return (
    <primitive object={cameras.perspective}>
      <group ref={mug} visible={false}>
        <Mug mats={mats} />
        {steam.map((m, i) => (
          <sprite
            key={i}
            ref={(el) => {
              wisps.current[i] = el;
            }}
            material={m}
            raycast={ignoreRay}
            visible={false}
          />
        ))}
      </group>
      <group ref={bag} visible={false}>
        <Bag mats={mats} />
      </group>
      <group ref={cup} visible={false}>
        <Cup
          mats={mats}
          waterRef={(el) => {
            inside.current = el;
          }}
        />
      </group>
    </primitive>
  );
}

/** Every fun thing's effect on the office floor, each drawing itself only while its own prop is under way. */
export function ActivityEffects({ walking }: { walking: boolean }) {
  const mats = useMemo<PropMaterials>(
    () => ({
      white: new THREE.MeshStandardMaterial({ color: "#fafafa" }),
      cupWhite: new THREE.MeshStandardMaterial({ color: "#fafafa", side: THREE.DoubleSide }),
      coffee: new THREE.MeshStandardMaterial({ color: "#3b2418" }),
      packet: new THREE.MeshStandardMaterial({ color: "#3d7bff" }),
      stripe: new THREE.MeshStandardMaterial({ color: "#ffd84a" }),
      water: new THREE.MeshBasicMaterial({ color: "#7cc7ff", transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }),
    }),
    [],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  return (
    <>
      <CoffeeEffect walking={walking} mats={mats} />
      <SnackEffect walking={walking} mats={mats} />
      <WaterEffect walking={walking} mats={mats} />
      <ArcadeEffect walking={walking} />
      <NapEffect walking={walking} />
      <ViewModels mats={mats} />
    </>
  );
}
