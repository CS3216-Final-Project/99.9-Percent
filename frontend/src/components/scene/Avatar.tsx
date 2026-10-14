"use client";

import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { avatarModel, type AvatarId } from "@/game/avatars";
import type { Floor } from "@/game/floors";
import { useGame } from "@/game/store";
import type { EquipmentId } from "@/sim";
import { useDetail, type Detail } from "./detail";
import { SPOTS } from "./floorplan";
import { ignoreRay } from "./furniture";
import { loadGltf } from "./gltf";
import { ROOM, type Footprint } from "./layout";
import { FLOOR_Y } from "./levels";
import { onRide, ride, riding, shownFloor, now } from "./ride";
import { puffTexture } from "./textures";
import { avatar, CAR, LOBBY, placeAvatar, stepAvatar, walkTo } from "./walk";
import { footingAt, STRIDE } from "./footing";
import { sceneSound } from "./sceneSounds";

/*
 * The player's avatar: one of Kenney's cube animals (see game/avatars.ts), drawn only once chosen. In walk mode it
 * goes where the player steers it and rides the elevator with the view; otherwise it sits in the founder's chair at
 * the meeting room's table. A new choice arrives in a puff with a bounce.
 */

/** Metres a model unit: the cube animals stand about 0.85 m tall, a little smaller than most of the crew. */
const SCALE = 0.5;
/** Height of a meeting room chair's seat, where the avatar sits when not walking. */
const SEAT = 0.46;
/** Seconds a change of animation blends, and how long a new avatar's bounce lasts. */
const BLEND = 0.25;
const BOUNCE = 0.6;
/** How fast each clip plays: the walk and run keep pace with the avatar's speed. */
const PACE: Record<string, number> = { walk: 1.6, run: 1.4 };

const materials = new Map<string, THREE.Material>();
/** The pack's one texture, matte at basic detail and softly lit at HD, shared by every avatar. */
function avatarMaterial(source: THREE.Material, detail: Detail): THREE.Material {
  const s = source as THREE.MeshStandardMaterial;
  const key = `${detail}|${s.uuid}`;
  let m = materials.get(key);
  if (!m) {
    m = detail === "hd" ? new THREE.MeshStandardMaterial({ map: s.map, roughness: 0.6, metalness: 0 }) : new THREE.MeshLambertMaterial({ map: s.map });
    materials.set(key, m);
  }
  return m;
}

/** The chosen avatar's model, kept until the next one has loaded, so a change never leaves an empty place. */
function useAvatarModel(id: AvatarId): { id: AvatarId; gltf: GLTF } | null {
  const [loaded, setLoaded] = useState<{ id: AvatarId; gltf: GLTF } | null>(null);
  useEffect(() => {
    let live = true;
    loadGltf(avatarModel(id)).then(
      (gltf) => {
        if (live) setLoaded({ id, gltf });
      },
      (error: unknown) => console.warn("The avatar's model failed to load; the game carries on without it.", error),
    );
    return () => {
      live = false;
    };
  }, [id]);
  return loaded;
}

/** The floor the avatar is drawn on now, and where. */
function placeNow(walking: boolean): { floor: Floor | "car"; x: number; y: number; z: number; yaw: number } {
  if (!walking) return { floor: "office", x: SPOTS.founder.x, y: FLOOR_Y.office + SEAT, z: SPOTS.founder.z, yaw: SPOTS.founder.rot };
  if (riding()) return { floor: "car", x: avatar.x, y: ride.y, z: avatar.z, yaw: avatar.yaw };
  return { floor: avatar.floor, x: avatar.x, y: FLOOR_Y[avatar.floor], z: avatar.z, yaw: avatar.yaw };
}

export function Avatar({ walking }: { walking: boolean }) {
  const id = useGame((s) => s.avatar);
  const loaded = useAvatarModel(id);
  const detail = useDetail();
  const model = useMemo(() => {
    if (!loaded) return null;
    const object = loaded.gltf.scene.clone(true);
    object.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.raycast = ignoreRay;
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => avatarMaterial(m, detail)) : avatarMaterial(mesh.material, detail);
    });
    const mixer = new THREE.AnimationMixer(object);
    const clips = new Map(loaded.gltf.animations.map((c) => [c.name, c]));
    return { id: loaded.id, object, mixer, clips };
  }, [loaded, detail]);
  useEffect(
    () => () => {
      model?.mixer.stopAllAction();
      if (model) model.mixer.uncacheRoot(model.object);
    },
    [model],
  );

  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const current = useRef<{ name: string; action: THREE.AnimationAction } | null>(null);
  const arrived = useRef({ id: "", at: -Infinity });
  const puffs = useRef<(THREE.Sprite | null)[]>([]);
  const ring = useRef<THREE.Mesh>(null);
  const ringMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const puffMaterials = useMemo(() => Array.from({ length: 6 }, () => new THREE.SpriteMaterial({ map: puffTexture(), transparent: true, depthWrite: false, opacity: 0 })), []);
  useEffect(() => () => puffMaterials.forEach((m) => m.dispose()), [puffMaterials]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g || !model) return;
    const t = now();
    // A new avatar: puff and bounce, but not for the first one to load.
    if (arrived.current.id !== model.id) {
      arrived.current = { id: model.id, at: arrived.current.id ? t : -Infinity };
      current.current = null;
    }
    const at = placeNow(walking);
    g.position.set(at.x, at.y, at.z);
    g.rotation.y = at.yaw;
    g.visible = at.floor === "car" || at.floor === shownFloor();
    // The animation for what it is doing, blended from the last.
    const want = !walking ? "idle" : avatar.busy ? avatar.busy.clip : avatar.moving ? (avatar.running ? "run" : "walk") : "idle";
    if (current.current?.name !== want) {
      const clip = model.clips.get(want) ?? model.clips.get("idle");
      if (clip) {
        const action = model.mixer.clipAction(clip);
        action.reset();
        action.timeScale = PACE[want] ?? 1;
        action.play();
        if (current.current) current.current.action.crossFadeTo(action, BLEND, false);
        current.current = { name: want, action };
      }
    }
    model.mixer.update(Math.min(dt, 0.1));
    // In walk mode a ring on the floor marks the player's avatar out from the crew, breathing gently.
    if (ring.current) ring.current.visible = walking;
    if (ringMaterial.current) ringMaterial.current.opacity = 0.55 + 0.25 * Math.sin(t * 3);
    // The bounce: a squash and stretch that settles.
    const since = t - arrived.current.at;
    const k = since < BOUNCE ? Math.sin((since / BOUNCE) * Math.PI * 3) * (1 - since / BOUNCE) * 0.25 : 0;
    body.current?.scale.set(SCALE * (1 - k * 0.5), SCALE * (1 + k), SCALE * (1 - k * 0.5));
    puffs.current.forEach((sprite, i) => {
      if (!sprite) return;
      const f = since / 0.7;
      const on = f >= 0 && f < 1;
      sprite.visible = on;
      if (!on) return;
      const a = (i / puffs.current.length) * Math.PI * 2;
      sprite.position.set(Math.cos(a) * (0.15 + f * 0.45), 0.25 + f * 0.35, Math.sin(a) * (0.15 + f * 0.45));
      sprite.scale.setScalar(0.25 + f * 0.35);
      sprite.material.opacity = 0.8 * (1 - f);
    });
  });

  if (!model) return null;
  return (
    <group ref={group}>
      {/* The models face +z; the crew's convention, and the avatar's, is -z. */}
      <group ref={body} scale={SCALE}>
        <primitive object={model.object} rotation={[0, Math.PI, 0]} />
      </group>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} raycast={ignoreRay} visible={false}>
        <ringGeometry args={[0.36, 0.46, 40]} />
        <meshBasicMaterial ref={ringMaterial} color="#ffd84a" transparent opacity={0.7} depthWrite={false} toneMapped={false} />
      </mesh>
      {puffMaterials.map((m, i) => (
        <sprite
          key={i}
          ref={(el) => {
            puffs.current[i] = el;
          }}
          material={m}
          visible={false}
          raycast={ignoreRay}
        />
      ))}
    </group>
  );
}

const forward = new THREE.Vector3();

/**
 * Walk mode's frame: steer the avatar from the keys held relative to the view, and carry it in the elevator's car
 * when the floor changes, stepping out on arrival.
 */
/** How loud footsteps are on each footing, as a share of the effects volume, and louder running. */
const STEPS = { soft: { cue: "stepSoft", level: 0.35 }, hard: { cue: "stepHard", level: 0.4 }, hollow: { cue: "stepHollow", level: 0.45 } } as const;

export function WalkDriver({ walking, footprints, names }: { walking: boolean; footprints: Record<EquipmentId, Footprint>; names: Record<EquipmentId, string> }) {
  const camera = useThree((s) => s.camera);
  const stride = useRef(0);
  useEffect(() => {
    if (!walking) return;
    placeAvatar(useGame.getState().floor);
    return onRide((event) => {
      if (event === "depart") {
        // Into the car, whatever sent it: a press in the car, the floor menu or a choice in a panel.
        Object.assign(avatar, { floor: ride.to, x: CAR[0], z: CAR[1], path: [], busy: null, moving: false });
      } else {
        walkTo(LOBBY[0], LOBBY[1]);
      }
    });
  }, [walking]);
  useFrame((_, dt) => {
    if (!walking || riding()) return;
    camera.getWorldDirection(forward);
    const x = avatar.x;
    const z = avatar.z;
    // Movement is checked in small steps whatever the frame's length, so a slow renderer only walks it in bigger strides.
    stepAvatar(Math.min(dt, 0.25), [forward.x, forward.z], footprints, names, now());
    // A footstep every stride, sounding of what is underfoot.
    stride.current += Math.hypot(avatar.x - x, avatar.z - z);
    if (!avatar.moving) stride.current = 0;
    else if (stride.current >= (avatar.running ? STRIDE.run : STRIDE.walk)) {
      stride.current = 0;
      const step = STEPS[footingAt(avatar.floor, avatar.x, avatar.z)];
      sceneSound(step.cue, step.level * (avatar.running ? 1.3 : 1));
    }
  });
  return null;
}

/**
 * In walk mode, the floor the elevator stands at catches clicks and taps that miss everything else: the avatar walks
 * there, or as near as it can get. Equipment above it still takes its own clicks.
 */
export function WalkFloor() {
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    e.stopPropagation();
    walkTo(e.point.x, e.point.z);
    // As a click on empty floor always has, it lets go of what was selected.
    const s = useGame.getState();
    if (s.game.phase !== "incident") s.select(null);
  };
  return (
    <mesh position={[ROOM.cx, 0.002, ROOM.cz]} rotation={[-Math.PI / 2, 0, 0]} onClick={onClick}>
      <planeGeometry args={[ROOM.w, ROOM.d]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}
