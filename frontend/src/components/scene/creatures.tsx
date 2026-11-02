"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { motionFor, SPECIES, type Activity, type Species } from "./cast";
import { useDetail, type Detail } from "./detail";
import { loadCrew, type Crew } from "./creatureCatalog";
import { heading, poseAt, wrapAngle, type Plan } from "./routes";
import { avatar, gridHere } from "./walk";
import { riding } from "./ride";
import { worldDelta, worldNow } from "./worldClock";
import { FLOOR_Y } from "./levels";
import { sceneSpeech } from "./sceneSounds";
import { fresh, glance, GREET_SECONDS, greetingLine, nearness, notices } from "./greetings";
import { SpeechBubble } from "./bubble";
import { cloneSharingSkeletons } from "./skinning";
import { shadowDepthMaterial } from "./shadowDepth";
import { bodiesOn, standing, within } from "./crewSpots";
import { useGame } from "@/game/store";
import { apart, intrudes, radiusOf, sidestep, sweptIntrudes } from "./spacing";
import { blocked } from "./navgrid";

/*
 * The office crew: animated monsters (see cast.ts). Every creature is a copy of
 * its species' rigged model with its own animation mixer, so the walk cycles
 * and idles are the artist's own. A creature costs one draw call per material,
 * about five, and its skeleton is animated on the CPU.
 *
 * Creatures face -z in their own frame, like the rest of the room's people
 * used to. The models face +z, so each is turned round once.
 */

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
function creatureMaterial(source: THREE.Material, detail: Detail, clip?: THREE.Plane[]): THREE.Material {
  const s = source as THREE.MeshStandardMaterial;
  const key = `${detail}|${s.uuid}|${clip ? "clipped" : ""}`;
  let m = materials.get(key);
  if (!m) {
    m =
      detail === "hd"
        ? new THREE.MeshStandardMaterial({ color: s.color, map: s.map, roughness: 0.55, metalness: 0 })
        : new THREE.MeshLambertMaterial({ color: s.color, map: s.map });
    m.name = s.name;
    if (clip) m.clippingPlanes = clip;
    materials.set(key, m);
  }
  return m;
}

/** Height of a chair seat; seated creatures perch here. */
const SEAT = 0.5;
/** How high a flyer hovers. */
const HOVER = 0.95;
/** How far in front of a seat its desk's near edge is (a chair 0.72 m behind the middle of a 0.78 m desk). A creature standing at the desk keeps its front behind it. */
const DESK_EDGE = 0.33;
/** Room left between a standing creature and its desk. */
const DESK_GAP = 0.05;
/** How far behind a seat's centre a chair's backrest begins. A perched creature's back must stay in front of it. */
const BACKREST = 0.1;
/** How long a change of animation blends, in seconds. */
const BLEND = 0.35;
/** Seconds a creature on a beat takes to ease into its clip and back to idling. */
const BEAT_EASE = 0.15;
/** How much larger than life a held paddle is: the monsters' fists are huge and would hide a real one. */
const PADDLE_SIZE = 1.8;
/** Bone names as three.js keeps them: it drops the dots from the file's names. */
const bone = (name: string) => THREE.PropertyBinding.sanitizeNodeName(name);

/** A clip driven by the clock instead of looping freely: one play every `period` seconds, starting at time `at`. */
export interface Beat {
  period: number;
  at: number;
}

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
  /** Something held in the right hand. */
  holding?: "paddle";
  /** Keep the clip in time with something else, such as a ball in play. */
  beat?: Beat;
  /** Planes to cut the creature by, as the elevator's riders are to the part of the shaft in view. */
  clip?: THREE.Plane[];
  /** Notices the player's avatar walking up: a glance, a word and a sound. The chat groups answer for their members themselves. */
  greets?: boolean;
}

export function Creature(props: CreatureProps) {
  const loaded = useCrew();
  const gltf = loaded?.get(props.species);
  return gltf ? <CreatureModel {...props} gltf={gltf} /> : null;
}

/** Metres a walking creature of each kind covers per second at normal playback. */
const STRIDE = { blob: 0.55, big: 0.9, flyer: 1.2 } as const;

/** A table-tennis paddle in metres, its handle running up +y from the grip. */
function paddle(detail: Detail): THREE.Group {
  const mat = (color: string, roughness: number) =>
    detail === "hd" ? new THREE.MeshStandardMaterial({ color, roughness }) : new THREE.MeshLambertMaterial({ color });
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.1, 0.02), mat("#b07a4a", 0.6));
  handle.position.y = 0.04;
  const face = (color: string, z: number) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.008, 20), mat(color, 0.7));
    m.rotation.x = Math.PI / 2;
    m.position.set(0, 0.15, z);
    return m;
  };
  g.add(handle, face("#d8283b", 0.005), face("#15151a", -0.004));
  g.traverse((o) => (o.castShadow = true));
  return g;
}

function CreatureModel({ gltf, species, activity, pose = "stand", position, rotation = 0, phase = 0, seat = SEAT, pace, holding, beat, clip, greets = true }: CreatureProps & { gltf: GLTF }) {
  const detail = useDetail();
  const info = SPECIES[species];
  const model = useMemo(() => {
    const object = cloneSharingSkeletons(gltf.scene);
    object.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) mesh.customDepthMaterial = shadowDepthMaterial("skinned");
      // Animated skins move outside their bind-pose bounds; culling them would make limbs pop.
      mesh.frustumCulled = false;
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => creatureMaterial(m, detail, clip)) : creatureMaterial(mesh.material, detail, clip);
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
    // A paddle goes in the right hand, where the fingers start. The rig is scaled up a hundredfold and then fitted,
    // so the paddle is scaled back down to a size measured in metres.
    const forearm = holding ? object.getObjectByName(bone("LowerArm.R")) : undefined;
    const grip = forearm ? paddle(detail) : undefined;
    if (forearm && grip) {
      const ws = forearm.getWorldScale(new THREE.Vector3());
      grip.scale.setScalar(PADDLE_SIZE / (ws.x * scale));
      grip.position.y = object.getObjectByName(bone("Middle1.R"))?.position.y ?? 0;
      forearm.add(grip);
    }
    // The model faces +z, so its back is at the box's -z side and its front at the +z side; once turned round they are
    // how far it reaches behind and ahead.
    return { object, scale, foot: -box.min.y * scale, back: -box.min.z * scale, front: box.max.z * scale, mixer: new THREE.AnimationMixer(object), grip };
  }, [gltf, detail, info.height, holding, clip]);

  // A greeting to the avatar, while the bubble shows and the glance and clip last; mirrored in a ref for the frame loop.
  const [greeting, setGreeting] = useState<{ line: string; at: number } | null>(null);
  const greeted = useRef<{ line: string; at: number } | null>(null);
  const notice = useRef(fresh());
  const count = useRef(0);
  const turn = useRef(0);
  const outer = useRef<THREE.Group>(null);
  // A greeting plays its hello's clip: sitting it just nods along; panicking or walking it keeps its own.
  const shownActivity: Activity = greeting && !beat && activity !== "panic" && activity !== "walk" ? (pose === "sit" ? "chat" : "greet") : activity;

  const current = useRef<THREE.AnimationAction | null>(null);
  const motion = motionFor(info.kind, shownActivity);
  useEffect(() => {
    const clip = THREE.AnimationClip.findByName(gltf.animations, `CharacterArmature|${motion.clip}`) ?? gltf.animations[0];
    if (!clip) return;
    const action = model.mixer.clipAction(clip);
    const walkSpeed = pace && activity === "walk" ? pace / STRIDE[info.kind] : 1;
    // A clip on a beat is positioned by the clock every frame, so it must not also advance by itself.
    action.timeScale = beat ? 0 : motion.speed * walkSpeed;
    if (current.current !== action) {
      action.reset();
      // A hello's hop or wave starts from the top; the day-long loops start partway so neighbours differ.
      action.time = shownActivity === "greet" ? 0 : (phase * 0.37) % clip.duration;
      action.play();
      if (current.current) current.current.crossFadeTo(action, BLEND, false);
      current.current = action;
    }
  }, [model, gltf, motion.clip, motion.speed, pace, activity, shownActivity, info.kind, phase, beat]);

  // The map shows where every creature stands.
  useEffect(() => standing(model.object, radiusOf(species)), [model, species]);

  // Between beats the creature idles, so it does not freeze in the clip's last pose.
  const rest = useRef<THREE.AnimationAction | null>(null);
  useEffect(() => {
    if (!beat) return;
    const clip = THREE.AnimationClip.findByName(gltf.animations, `CharacterArmature|${motionFor(info.kind, "idle").clip}`);
    if (!clip) return;
    const action = model.mixer.clipAction(clip);
    action.play();
    rest.current = action;
    return () => {
      action.stop();
      rest.current = null;
    };
  }, [model, gltf, info.kind, beat]);

  useEffect(
    () => () => {
      model.mixer.stopAllAction();
      model.mixer.uncacheRoot(model.object);
      current.current = null;
      // The paddle is this creature's own; the species' meshes and materials are shared and stay.
      model.grip?.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      });
    },
    [model],
  );

  useFrame((_, frame) => {
    const dt = worldDelta(frame);
    const action = current.current;
    if (beat && action) {
      // Play the clip once per beat, easing in from the idle and back out to it.
      const duration = action.getClip().duration;
      const since = (((worldNow() - beat.at) % beat.period) + beat.period) % beat.period;
      action.time = Math.min(since, duration - 0.001);
      const w = rest.current ? smooth(since < duration ? Math.min(1, since / BEAT_EASE, (duration - since) / BEAT_EASE) : 0) : 1;
      action.setEffectiveWeight(w);
      rest.current?.setEffectiveWeight(1 - w);
      model.mixer.update(Math.min(dt, 0.1));
    } else {
      model.mixer.update(Math.min(dt, 0.1));
    }

    const t = worldNow();
    const g = greeted.current;
    if (g && t - g.at >= GREET_SECONDS) {
      greeted.current = null;
      setGreeting(null);
    }
    // Noticing the avatar: elevator riders (clipped) and the sleeper never do, and nobody does while it rides.
    const eligible = greets && !clip && activity !== "doze";
    if (eligible && outer.current && useGame.getState().walking && !riding()) {
      const e = outer.current.matrixWorld.elements;
      const floor = e[13] < (FLOOR_Y.office + FLOOR_Y.servers) / 2 ? "servers" : "office";
      if (floor === avatar.floor) {
        const d = Math.hypot(avatar.x - e[12], avatar.z - e[14]);
        if (notices(notice.current, d, t)) {
          count.current++;
          // The creature's local +z axis in world gives its yaw; it faces -z, so the way to the avatar is a heading.
          const worldYaw = Math.atan2(e[8], e[10]);
          turn.current = wrapAngle(heading(avatar.x - e[12], avatar.z - e[14]) - worldYaw);
          const line = greetingLine(species, activity, count.current + Math.floor(phase * 7));
          sceneSpeech({ text: line, species, near: nearness(d) });
          greeted.current = { line, at: t };
          setGreeting({ line, at: t });
        }
      }
    }
    // Glancing at the avatar: only a standing, unhurried creature turns; seated crew, walkers mid-stride and players
    // on a beat keep their bodies still.
    const said = greeted.current;
    const glances = !!said && pose === "stand" && activity !== "walk" && !beat;
    if (outer.current) outer.current.rotation.y = rotation + (said && glances ? turn.current * glance(t - said.at) : 0);
  });

  // Small creatures perch on the seat, moved forward until their backs clear the backrest; round ones move further.
  // Big ones are too tall for a chair and their desks have none (see standsAtDesk), so they stand where it would be,
  // stepping back until their front clears the desk.
  const sit = pose === "sit" && info.kind === "blob";
  const stand = pose === "sit" && info.kind === "big";
  const offset = sit ? -Math.max(0, model.back - BACKREST) : stand ? Math.max(0, model.front + DESK_GAP - DESK_EDGE) : 0;
  const y = info.kind === "flyer" ? HOVER : sit ? seat : 0;
  return (
    <group ref={outer} position={position} rotation={[0, rotation, 0]}>
      <primitive object={model.object} scale={model.scale} position={[0, y + model.foot, offset]} rotation={[0, Math.PI, 0]} />
      {greeting && (
        <group position={[0, 0, offset]}>
          <SpeechBubble text={greeting.line} alarmed={activity === "panic"} height={y + info.height} />
        </group>
      )}
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
  useFrame(() => {
    if (!g.current) return;
    const walk = len / speed;
    const t = (worldNow() + phase) % (2 * walk + 2 * TURN);
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

/** How near ahead the player's avatar must be for a walker to wait for it to pass. */
const MAKE_WAY = 1.0;

/** Whether the player's avatar stands in the way of a walker at (x, z) facing `yaw`, on the office floor. */
function avatarAhead(x: number, z: number, yaw: number): boolean {
  if (!useGame.getState().walking || avatar.floor !== "office") return false;
  const dx = avatar.x - x;
  const dz = avatar.z - z;
  // Creatures face -z at a yaw of 0.
  return Math.hypot(dx, dz) < MAKE_WAY && dx * -Math.sin(yaw) + dz * -Math.cos(yaw) > 0;
}

/**
 * A creature on a wandering loop (see routes.ts): walking the corridors,
 * turning at corners and pausing at whatever it visits. Its place comes from
 * the clock, so a remount carries on where it was; in walk mode it also waits
 * for the player's avatar to pass rather than walk through it, falling behind
 * the clock by as long as it waited.
 */
export function Wanderer({ plan, species, offset = 0 }: { plan: Plan; species: Species; offset?: number }) {
  const g = useRef<THREE.Group>(null);
  const [activity, setActivity] = useState<Activity>(() => poseAt(plan, offset).activity);
  const shown = useRef(activity);
  const lag = useRef(0);
  const spacing = useRef({ x: 0, z: 0 });
  const stuck = useRef(0);
  const radius = radiusOf(species);
  useFrame((_, frame) => {
    const dt = worldDelta(frame);
    const step = Math.min(dt, 0.1);
    const pose = poseAt(plan, worldNow() + offset - lag.current);
    const target = { x: pose.x + spacing.current.x, z: pose.z + spacing.current.z };
    const previous = g.current ? [g.current.position.x, g.current.position.z] as [number, number] : [target.x, target.z] as [number, number];
    const world = gridHere("office").world;
    const bodies = g.current ? bodiesOn("office", (o) => within(o, g.current!)) : [];
    const overlap = bodies
      .map((body) => ({ body, distance: Math.hypot(previous[0] - body.x, previous[1] - body.z) }))
      .filter(({ body, distance }) => distance < radius + body.r)
      .sort((a, b) => a.distance - b.distance)[0];
    let activityNow = pose.activity;
    const ahead = pose.activity === "walk" && avatarAhead(pose.x, pose.z, pose.yaw);
    const moving = Math.hypot(target.x - previous[0], target.z - previous[1]) > 1e-4;
    const blockedByBody = moving && sweptIntrudes(bodies, radius, previous[0], previous[1], target.x, target.z);
    if (ahead || blockedByBody) {
      lag.current += dt;
      if (!blockedByBody) stuck.current = 0;
      if (blockedByBody) {
        stuck.current += dt;
        const escape = overlap && apart(
          world,
          bodies,
          radius,
          previous[0],
          previous[1],
          radius + overlap.body.r - overlap.distance + 0.05,
        );
        const clear = escape && Math.hypot(escape[0] - previous[0], escape[1] - previous[1]) > 1e-4
          && !intrudes(bodies, radius, previous[0], previous[1], escape[0], escape[1])
          && !blocked(world, escape[0], escape[1]);
        const side = clear ? escape : sidestep(world, bodies, radius, previous[0], previous[1], pose.yaw, plan.speed * step * 0.7);
        if (side) {
          spacing.current = { x: side[0] - pose.x, z: side[1] - pose.z };
          const length = Math.hypot(spacing.current.x, spacing.current.z);
          if (length > 0.8) {
            spacing.current.x *= 0.8 / length;
            spacing.current.z *= 0.8 / length;
          }
        } else {
          spacing.current = { x: previous[0] - pose.x, z: previous[1] - pose.z };
          activityNow = "idle";
        }
        if (pose.activity !== "walk") activityNow = "idle";
        if (stuck.current > 8) {
          const side = sidestep(world, bodies, radius, previous[0], previous[1], pose.yaw, 0.8);
          if (side) {
            spacing.current = { x: side[0] - pose.x, z: side[1] - pose.z };
            stuck.current = 0;
          }
        }
      } else {
        spacing.current = { x: previous[0] - pose.x, z: previous[1] - pose.z };
        activityNow = "idle";
      }
    } else {
      stuck.current = 0;
      const distance = overlap ? radius + overlap.body.r - overlap.distance + 0.05 : 0.4 * step;
      const separated = pose.activity === "walk" ? null : apart(world, bodies, radius, previous[0], previous[1], distance);
      if (separated && Math.hypot(separated[0] - previous[0], separated[1] - previous[1]) > 1e-4
        && !intrudes(bodies, radius, previous[0], previous[1], separated[0], separated[1])
        && !blocked(world, separated[0], separated[1])) {
        spacing.current = { x: separated[0] - pose.x, z: separated[1] - pose.z };
        const length = Math.hypot(spacing.current.x, spacing.current.z);
        if (length > 0.8) {
          spacing.current.x *= 0.8 / length;
          spacing.current.z *= 0.8 / length;
        }
      } else {
        const ease = 1.5 * step;
        const ox = spacing.current.x;
        const oz = spacing.current.z;
        const length = Math.hypot(ox, oz);
        const factor = length > 0 ? Math.max(0, (length - ease) / length) : 0;
        const eased = { x: ox * factor, z: oz * factor };
        const next = { x: pose.x + eased.x, z: pose.z + eased.z };
        if (!intrudes(bodies, radius, previous[0], previous[1], next.x, next.z) && !blocked(world, next.x, next.z)) spacing.current = eased;
        else activityNow = "idle";
      }
    }
    let next = { x: pose.x + spacing.current.x, z: pose.z + spacing.current.z };
    if (overlap) {
      const escape = apart(
        world,
        bodies,
        radius,
        previous[0],
        previous[1],
        radius + overlap.body.r - overlap.distance + 0.05,
      );
      if (Math.hypot(escape[0] - previous[0], escape[1] - previous[1]) > 1e-4
        && !intrudes(bodies, radius, previous[0], previous[1], escape[0], escape[1])
        && !blocked(world, escape[0], escape[1])) {
        next = { x: escape[0], z: escape[1] };
      }
    }
    if (sweptIntrudes(bodies, radius, previous[0], previous[1], next.x, next.z)) {
      next = { x: previous[0], z: previous[1] };
      activityNow = "idle";
    }
    spacing.current = { x: next.x - pose.x, z: next.z - pose.z };
    if (g.current) {
      g.current.position.set(next.x, 0, next.z);
      g.current.rotation.y = pose.yaw;
    }
    if (!g.current) return;
    // Only a change of what it is doing needs React; moving does not.
    if (activityNow !== shown.current) {
      shown.current = activityNow;
      setActivity(activityNow);
    }
  });
  return (
    <group ref={g}>
      <Creature species={species} activity={activity} position={[0, 0, 0]} phase={offset} pace={plan.speed} />
    </group>
  );
}
