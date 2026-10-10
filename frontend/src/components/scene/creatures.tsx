"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { ALL_SPECIES, motionFor, SPECIES, type Activity, type Species } from "./cast";
import { useDetail, type Detail } from "./detail";
import { loadGltf } from "./gltf";

/*
 * The office crew: animated monsters (see cast.ts). Every creature is a copy of
 * its species' rigged model with its own animation mixer, so the walk cycles
 * and idles are the artist's own. A creature costs one draw call per material,
 * about five, and its skeleton is animated on the CPU.
 *
 * Creatures face -z in their own frame, like the rest of the room's people
 * used to. The models face +z, so each is turned round once.
 */

const CREATURES = "/models/creatures/";
const url = (s: Species) => `${CREATURES}${SPECIES[s].file}.glb`;

type Crew = Map<Species, GLTF>;
let crew: Promise<Crew> | null = null;

/** Fetch every species once. A failure is reported once and forgotten, so a later mount tries again. */
function loadCrew(): Promise<Crew> {
  if (crew) return crew;
  const attempt = Promise.all(ALL_SPECIES.map((s) => loadGltf(url(s)))).then((list) => new Map(ALL_SPECIES.map((s, i) => [s, list[i]])));
  crew = attempt;
  attempt.catch((error: unknown) => {
    if (crew === attempt) crew = null;
    console.warn("Creature models failed to load; the office carries on without its crew.", error);
  });
  return attempt;
}

/** Start fetching the crew as soon as the 3D scene's code loads. */
export function preloadCreatures(): void {
  loadCrew().catch(() => {});
}

function useCrew(): Crew | null {
  const [loaded, setLoaded] = useState<Crew | null>(null);
  useEffect(() => {
    let live = true;
    loadCrew().then(
      (c) => {
        if (live) setLoaded(c);
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, []);
  return loaded;
}

/**
 * Creature materials: the pack's flat colours. Basic detail makes them matte
 * Lambert like the rest of the pixel look; HD keeps them physically based, with
 * a soft sheen. Materials are shared between creatures of a species.
 */
const materials = new Map<string, THREE.Material>();
function creatureMaterial(source: THREE.Material, detail: Detail): THREE.Material {
  const s = source as THREE.MeshStandardMaterial;
  const key = `${detail}|${s.uuid}`;
  let m = materials.get(key);
  if (!m) {
    m =
      detail === "hd"
        ? new THREE.MeshStandardMaterial({ color: s.color, map: s.map, roughness: 0.55, metalness: 0 })
        : new THREE.MeshLambertMaterial({ color: s.color, map: s.map });
    m.name = s.name;
    materials.set(key, m);
  }
  return m;
}

/** Height of a chair seat; seated creatures perch here. */
const SEAT = 0.5;
/** How high a flyer hovers. */
const HOVER = 0.95;
/** How far behind its chair a big creature stands when it would sit. */
const BEHIND_CHAIR = 0.45;
/** How far behind a seat's centre a chair's backrest begins. A perched creature's back must stay in front of it. */
const BACKREST = 0.1;
/** How long a change of animation blends, in seconds. */
const BLEND = 0.35;

export interface CreatureProps {
  species: Species;
  activity: Activity;
  pose?: "sit" | "stand";
  position: [number, number, number];
  rotation?: number;
  /** Offsets the animation so neighbours do not move in step. */
  phase?: number;
  /** Seat height for seated creatures. */
  seat?: number;
  /** Speed in metres a second, for walkers: the walk cycle keeps pace so feet do not slide. */
  pace?: number;
}

export function Creature(props: CreatureProps) {
  const loaded = useCrew();
  const gltf = loaded?.get(props.species);
  return gltf ? <CreatureModel {...props} gltf={gltf} /> : null;
}

/** Metres a walking creature of each kind covers per second at normal playback. */
const STRIDE = { blob: 0.55, big: 0.9, flyer: 1.2 } as const;

function CreatureModel({ gltf, species, activity, pose = "stand", position, rotation = 0, phase = 0, seat = SEAT, pace }: CreatureProps & { gltf: GLTF }) {
  const detail = useDetail();
  const info = SPECIES[species];
  const model = useMemo(() => {
    const object = cloneSkinned(gltf.scene);
    object.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      // Animated skins move outside their bind-pose bounds; culling them would make limbs pop.
      mesh.frustumCulled = false;
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => creatureMaterial(m, detail)) : creatureMaterial(mesh.material, detail);
    });
    // Measure the rest pose. The compressed vertices only reach their true size through the skeleton, which is not
    // posed until the first frame, so pose it now and measure the skinned result.
    object.updateMatrixWorld(true);
    const box = new THREE.Box3();
    object.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isMesh) return;
      let local: THREE.Box3;
      if (mesh.isSkinnedMesh) {
        mesh.skeleton.update();
        mesh.computeBoundingBox();
        local = mesh.boundingBox!;
      } else {
        mesh.geometry.computeBoundingBox();
        local = mesh.geometry.boundingBox!;
      }
      box.union(local.clone().applyMatrix4(mesh.matrixWorld));
    });
    const scale = info.height / Math.max(1e-6, box.max.y - box.min.y);
    // The model faces +z, so its back is at the box's -z side; once turned round that is how far it reaches behind.
    return { object, scale, foot: -box.min.y * scale, back: -box.min.z * scale, mixer: new THREE.AnimationMixer(object) };
  }, [gltf, detail, info.height]);

  const current = useRef<THREE.AnimationAction | null>(null);
  const motion = motionFor(info.kind, activity);
  useEffect(() => {
    const clip = THREE.AnimationClip.findByName(gltf.animations, `CharacterArmature|${motion.clip}`) ?? gltf.animations[0];
    if (!clip) return;
    const action = model.mixer.clipAction(clip);
    const walkSpeed = pace && activity === "walk" ? pace / STRIDE[info.kind] : 1;
    action.timeScale = motion.speed * walkSpeed;
    if (current.current !== action) {
      action.reset();
      action.time = (phase * 0.37) % clip.duration;
      action.play();
      if (current.current) current.current.crossFadeTo(action, BLEND, false);
      current.current = action;
    }
  }, [model, gltf, motion.clip, motion.speed, pace, activity, info.kind, phase]);

  useEffect(
    () => () => {
      model.mixer.stopAllAction();
      model.mixer.uncacheRoot(model.object);
      current.current = null;
    },
    [model],
  );

  useFrame((_, dt) => model.mixer.update(Math.min(dt, 0.1)));

  // Small creatures perch on the seat, moved forward until their backs clear the backrest; round ones move further.
  // Big ones are too tall for that, so they stand behind the chair as if at a standing desk.
  const sit = pose === "sit" && info.kind === "blob";
  const offset = sit ? -Math.max(0, model.back - BACKREST) : pose === "sit" && info.kind === "big" ? BEHIND_CHAIR : 0;
  const y = info.kind === "flyer" ? HOVER : sit ? seat : 0;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <primitive object={model.object} scale={model.scale} position={[0, y + model.foot, offset]} rotation={[0, Math.PI, 0]} />
    </group>
  );
}

/** Seconds a walker spends turning round at each end of its path. */
const TURN = 0.8;

/** Ease in and out over 0..1. */
const smooth = (t: number) => t * t * (3 - 2 * t);

/** A creature pacing back and forth between two points, turning round on the spot at each end. */
export function Walker({ from, to, speed, species, phase = 0 }: { from: [number, number]; to: [number, number]; speed: number; species: Species; phase?: number }) {
  const g = useRef<THREE.Group>(null);
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const walk = len / speed;
    const t = (clock.elapsedTime + phase) % (2 * walk + 2 * TURN);
    const out = Math.atan2(-dx, -dz);
    let f: number;
    let yaw: number;
    if (t < walk) {
      f = t / walk;
      yaw = out;
    } else if (t < walk + TURN) {
      f = 1;
      yaw = out + Math.PI * smooth((t - walk) / TURN);
    } else if (t < 2 * walk + TURN) {
      f = 1 - (t - walk - TURN) / walk;
      yaw = out + Math.PI;
    } else {
      f = 0;
      yaw = out + Math.PI + Math.PI * smooth((t - 2 * walk - TURN) / TURN);
    }
    g.current.position.set(from[0] + dx * f, 0, from[1] + dz * f);
    g.current.rotation.y = yaw;
  });
  return (
    <group ref={g}>
      <Creature species={species} activity="walk" position={[0, 0, 0]} phase={phase} pace={speed} />
    </group>
  );
}
