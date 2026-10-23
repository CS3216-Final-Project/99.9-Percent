"use client";

import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { avatarModel, type AvatarId } from "@/game/avatars";
import { loadExploration, saveExploration } from "@/game/exploration";
import type { Floor } from "@/game/floors";
import type { GameMode } from "@/game/persist";
import { useGame } from "@/game/store";
import type { EquipmentId } from "@/sim";
import { useDetail, type Detail } from "./detail";
import { NAP_BED, NAP_PITCH, NAP_YAW, SPOTS, type Racks } from "./floorplan";
import { ignoreRay } from "./furniture";
import { loadGltf } from "./gltf";
import { ROOM, type Footprint } from "./layout";
import { FLOOR_Y } from "./levels";
import { blocked } from "./navgrid";
import { WALK_MARKER } from "./palette";
import { onRide, ride, riding, shownFloor, now } from "./ride";
import { puffTexture } from "./textures";
import { avatar, CAR, gridHere, LOBBY, placeAvatar, setRacks, stepAvatar, walkTo } from "./walk";
import { footingAt, STRIDE } from "./footing";
import { sceneSound } from "./sceneSounds";
import { FIRST } from "./views";
import { viewNow } from "./viewState";

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
const PACE: Record<string, number> = { walk: 2.5, run: 2.2 };

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

/** An angle brought into (-π, π], so a yaw blend takes the short way round. */
const wrap = (a: number) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));

/** The floor the avatar is drawn on now, and where. */
function placeNow(walking: boolean): { floor: Floor | "car"; x: number; y: number; z: number; yaw: number } {
  if (!walking) return { floor: "office", x: SPOTS.founder.x, y: FLOOR_Y.office + SEAT, z: SPOTS.founder.z, yaw: SPOTS.founder.rot };
  if (riding()) return { floor: "car", x: avatar.x, y: ride.y, z: avatar.z, yaw: avatar.yaw };
  return { floor: avatar.floor, x: avatar.x, y: FLOOR_Y[avatar.floor] + avatar.lift, z: avatar.z, yaw: avatar.yaw };
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
  /** How far into lying down for a nap the avatar is, 0 standing to 1 flat. */
  const lie = useRef(0);
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
    // Resting in a nap pod, the avatar hops onto the first pod's mattress and lies back under its hood, and gets
    // up again after; the walk's own spot never moves. Only on the office floor: lying never happens elsewhere.
    const target = walking && avatar.busy?.prop === "nap" && at.floor === "office" ? 1 : 0;
    lie.current += Math.max(-dt / 0.55, Math.min(dt / 0.55, target - lie.current));
    const c = lie.current;
    const flat = at.floor === "office" ? c * c * (3 - 2 * c) : 0;
    const yaw = at.yaw + wrap(NAP_YAW - at.yaw) * flat;
    g.position.set(at.x + (NAP_BED.x - at.x) * flat, at.y + (NAP_BED.y - at.y) * flat + Math.sin(Math.PI * flat) * 0.2, at.z + (NAP_BED.z - at.z) * flat);
    g.rotation.set(NAP_PITCH * flat, yaw, 0, "YXZ");
    // Seen through its own eyes, the avatar is not drawn: the camera is in its head.
    g.visible = (at.floor === "car" || at.floor === shownFloor()) && !(walking && viewNow.inHead);
    // The animation for what it is doing, blended from the last.
    const jump = [...model.clips.keys()].find((name) => name.toLowerCase().includes("jump"));
    const airborne = walking && !riding() && avatar.lift > 0;
    const want = airborne && jump ? jump : !walking ? "idle" : avatar.busy ? avatar.busy.clip : avatar.moving ? (avatar.running ? "run" : "walk") : "idle";
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
    if (ring.current) ring.current.visible = walking && lie.current < 0.5;
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
        <meshBasicMaterial ref={ringMaterial} color={WALK_MARKER.primary} transparent opacity={0.7} depthWrite={false} toneMapped={false} />
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

/** How often the avatar's spot may be written to storage while it is on the move. */
const SAVE_EVERY = 0.5;

/**
 * Where the avatar stands now, for remembering: riding the elevator counts as standing in its lobby on the
 * floor it is heading for, so a visit never resumes inside the car.
 */
function standingSpot(): { floor: Floor; x: number; z: number; yaw: number } {
  if (riding()) return { floor: ride.to, x: LOBBY[0], z: LOBBY[1], yaw: avatar.yaw };
  return { floor: avatar.floor, x: avatar.x, z: avatar.z, yaw: avatar.yaw };
}

export function WalkDriver({ walking, footprints, names, racks }: { walking: boolean; footprints: Record<EquipmentId, Footprint>; names: Record<EquipmentId, string>; racks: Racks }) {
  const camera = useThree((s) => s.camera);
  const mode = useGame((s) => s.mode);
  const stride = useRef(0);
  /** The mode this walk belongs to and when it was last written down, while the walk lasts. */
  const persisting = useRef<{ mode: GameMode; last: number } | null>(null);
  // The machines standing are known before a walk picks up where it was left, so a remembered spot is judged by them.
  useEffect(() => setRacks(racks), [racks]);
  useEffect(() => {
    if (!walking) return;
    // Pick up where this mode was left, but only somewhere that is still on the floor in view and free to stand.
    const saved = loadExploration(mode).avatar;
    const floor = useGame.getState().floor;
    if (saved && saved.floor === floor && !blocked(gridHere(saved.floor).world, saved.x, saved.z)) placeAvatar(saved.floor, [saved.x, saved.z], saved.yaw);
    else placeAvatar(floor);
    const p = { mode, last: 0 };
    persisting.current = p;
    const flush = (whileWalking: boolean) => {
      const spot = standingSpot();
      saveExploration(p.mode, { floor: spot.floor, ...(whileWalking ? { walking: true } : {}), avatar: spot });
    };
    const onHide = () => flush(true);
    window.addEventListener("pagehide", onHide);
    const offRide = onRide((event) => {
      if (event === "depart") {
        // Into the car, whatever sent it: a press in the car, the floor menu or a choice in a panel.
        Object.assign(avatar, { floor: ride.to, x: CAR[0], z: CAR[1], path: [], busy: null, moving: false });
      } else {
        walkTo(LOBBY[0], LOBBY[1]);
      }
    });
    return () => {
      window.removeEventListener("pagehide", onHide);
      offRide();
      // The spot is always worth remembering; whether the walk itself was is the store's own record — an explicit
      // stop already wrote walking:false, and the title screen's automatic stop kept walking:true.
      flush(false);
      persisting.current = null;
    };
  }, [walking, mode]);
  useFrame((_, dt) => {
    if (!walking || riding()) return;
    camera.getWorldDirection(forward);
    const x = avatar.x;
    const z = avatar.z;
    // Movement is checked in small steps whatever the frame's length, so a slow renderer only walks it in bigger strides.
    // Seen through its eyes, it walks where the view looks, a little slower.
    const eyes = viewNow.want === "first" && viewNow.perspective ? { heading: viewNow.heading, pace: FIRST.pace } : undefined;
    stepAvatar(Math.min(dt, 0.25), [forward.x, forward.z], footprints, names, now(), eyes);
    // The spot is written down as it moves, but never every frame and never mid-ride.
    const p = persisting.current;
    const t = now();
    if (p && avatar.moving && t - p.last >= SAVE_EVERY) {
      p.last = t;
      saveExploration(p.mode, { floor: avatar.floor, walking: true, avatar: standingSpot() });
    }
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
 * A target reticle on the floor at the end of the avatar's planned path, breathing while it walks. It reads
 * `avatar.path` each frame, so it shows where the walk will actually end and is gone the moment the path is.
 */
function WalkDestination() {
  const group = useRef<THREE.Group>(null);
  const reduceMotion = useMemo(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false, []);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const destination = avatar.path[avatar.path.length - 1];
    g.visible = destination !== undefined;
    if (!destination) return;
    g.position.set(destination[0], 0.018, destination[1]);
    const scale = reduceMotion ? 1 : 1 + Math.sin(now() * 4) * 0.04;
    g.scale.setScalar(scale);
  });
  return (
    <group ref={group} visible={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={ignoreRay}>
        <circleGeometry args={[0.13, 32]} />
        <meshBasicMaterial color={WALK_MARKER.primary} transparent opacity={0.3} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={ignoreRay}>
        <ringGeometry args={[0.27, 0.48, 40]} />
        <meshBasicMaterial color={WALK_MARKER.contrast} transparent opacity={0.72} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={ignoreRay}>
        <ringGeometry args={[0.31, 0.44, 40]} />
        <meshBasicMaterial color={WALK_MARKER.primary} transparent opacity={0.95} depthWrite={false} toneMapped={false} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.sin(a) * 0.55, 0, Math.cos(a) * 0.55]} rotation={[-Math.PI / 2, 0, a]} raycast={ignoreRay}>
            <planeGeometry args={[0.1, 0.18]} />
            <meshBasicMaterial color={WALK_MARKER.primary} transparent opacity={0.95} depthWrite={false} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
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
    <>
      <mesh position={[ROOM.cx, 0.002, ROOM.cz]} rotation={[-Math.PI / 2, 0, 0]} onClick={onClick}>
        <planeGeometry args={[ROOM.w, ROOM.d]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <WalkDestination />
    </>
  );
}
