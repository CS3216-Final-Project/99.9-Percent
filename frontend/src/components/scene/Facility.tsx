"use client";

import { Line, MapControls, PerformanceMonitor } from "@react-three/drei";
import { Bloom, EffectComposer, N8AO, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { MapControls as MapControlsImpl } from "three-stdlib";
import {
  EQUIPMENT_ORDER,
  equipmentInfo,
  symptomaticEquipment,
  type EquipmentId,
} from "@/sim";
import type { GameMode, GraphicsQuality } from "@/game/persist";
import { loadExploration, saveExploration, type SavedCameraView } from "@/game/exploration";
import { canInspectEquipment, inspectInRoom, useGame } from "@/game/store";
import { attentionOn, FLOOR_NAME, FLOORS, floorOf, type Floor } from "@/game/floors";
import {
  AISLE_Z,
  appSlot,
  DB_CABINET,
  dbSlot,
  POS,
  RACK,
  ROOM,
  tempSlot,
  type Footprint,
} from "./layout";
import { DetailContext, detailOverride, useDetail, type Renderer } from "./detail";
import { adapt, adapts, resolveQuality, type QualityProfile } from "./quality";
import { projectUV, surfaceMaterial, useSurfaces } from "./surfaces";
import { concreteFloor, LED_COLORS, panelTextures, screenTexture, type Led, type PanelVariant, type ScreenKind } from "./textures";
import { Icon } from "../icons";
import { tipProps } from "../tips";
import { INFRASTRUCTURE_TIPS } from "@/game/infrastructureHelp";
import { openRoomArea } from "../roomArea";
import { EQUIPMENT_ICON, STATE_META } from "../presentation";
import { Office } from "./Office";
import { ServerFloor } from "./ServerFloor";
import { ElevatorCar, Landing } from "./Elevator";
import { FLOOR_NUMBER, FLOOR_Y, rideAt } from "./levels";
import { arrive, depart, now, onRide, placeCar, ride, rideClock, riding, shownFloor, viewHeight } from "./ride";
import { Avatar, WalkDriver, WalkFloor } from "./Avatar";
import { GlassDoors } from "./Doors";
import { avatar, clearPrompt, held, movesAvatar, onPrompt, play, walkTo } from "./walk";
import type { Prompt } from "./player";
import { applyDaylight } from "./cityLight";
import { viewFocus } from "./zoneSounds";
import { Exterior } from "./exterior";
import { daylightNow } from "./dayClock";
import { OnWall, Wall } from "./walls";
import { updateWalls } from "./wallState";
import { buildModel, racksOf, type SceneModel } from "./sceneModel";
import { CAMERA_DISTANCE, CAMERA_FAR, CAMERA_NEAR, MIN_TILT, MAX_TILT, turnAbout } from "./camera";
import { screenPoint } from "./labels";
import { EQUIPMENT, ROOM_PALETTE } from "./palette";

function useSceneModel(): SceneModel {
  const key = useGame((s) => JSON.stringify(buildModel(s.game)));
  return useMemo(() => JSON.parse(key) as SceneModel, [key]);
}

/* ------------------------------------------------------------------ */
/* Camera                                                              */
/* ------------------------------------------------------------------ */

const TARGET = new THREE.Vector3(-1, 0, 0.6);
/**
 * Where the camera sits relative to what it looks at. The view is orthographic, so distance does not change what
 * is seen, but the camera must stand far enough back that the ground outside is never behind it when zoomed out
 * and tilted low.
 */
const CAMERA_OFFSET = new THREE.Vector3(20, 18, 20).setLength(CAMERA_DISTANCE);
const HOME = CAMERA_OFFSET.clone().normalize();
const UP = new THREE.Vector3(0, 1, 0);
/** Q, E and the rotate buttons turn the room by an eighth of a circle. */
const TURN = Math.PI / 4;

const cameraApi: { zoomBy: (factor: number) => void; reset: () => void; rotateBy: (radians: number) => void } = {
  zoomBy: () => {},
  reset: () => {},
  rotateBy: () => {},
};

/** Zoom and the point on the floor at height `floorY` that fit the box on screen when looking along `dir`. */
function frameBox(box: THREE.Box3, dir: THREE.Vector3, width: number, height: number, floorY: number): { zoom: number; target: THREE.Vector3 } {
  const right = new THREE.Vector3().crossVectors(dir, UP).normalize();
  const up = new THREE.Vector3().crossVectors(right, dir).normalize();
  const center = box.getCenter(new THREE.Vector3());
  const p = new THREE.Vector3();
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        p.set(x, y, z).sub(center);
        minX = Math.min(minX, p.dot(right));
        maxX = Math.max(maxX, p.dot(right));
        minY = Math.min(minY, p.dot(up));
        maxY = Math.max(maxY, p.dot(up));
      }
    }
  }
  // Leave room around the edges for labels, the prompt and the controls.
  const zoom = THREE.MathUtils.clamp(Math.min(width / (maxX - minX + 7), height / (maxY - minY + 6.5)), 10, 64);
  // Slide the centre down the view direction onto the floor, which is the plane the controls pan across.
  return { zoom, target: center.add(dir.clone().multiplyScalar((floorY - center.y) / dir.y)) };
}

/**
 * The point on the floor at height `floorY` to look at so that `p` shows at the centre of the room the panel leaves
 * open, at `zoom`, when looking along `dir`. The view is orthographic, so a pixel spans 1 / zoom world units.
 */
function centreOn(p: THREE.Vector3, dir: THREE.Vector3, zoom: number, width: number, height: number, floorY: number): THREE.Vector3 {
  const stage = document.querySelector("main.stage")?.getBoundingClientRect();
  const open = stage ? openRoomArea(stage) : { right: width, bottom: height };
  const ox = open.right / 2 - width / 2;
  const oy = open.bottom / 2 - height / 2;
  const right = new THREE.Vector3().crossVectors(dir, UP).normalize();
  const up = new THREE.Vector3().crossVectors(right, dir).normalize();
  const c = p.clone().addScaledVector(right, -ox / zoom).addScaledVector(up, oy / zoom);
  return c.addScaledVector(dir, (floorY - c.y) / dir.y);
}

/** The darkening laid over the room as the elevator passes between floors, moved by the camera each frame. */
let dipEl: HTMLDivElement | null = null;

/** How often the camera's view may be written to storage while it is on the move. */
const VIEW_SAVE_EVERY = 0.5;
/** Written positions are rounded so the controls' quiet damping is not a change worth saving. */
const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

/** The view exactly as it is remembered: what it looks at, the camera's stand-off from it and the zoom. */
function viewOf(target: THREE.Vector3, camera: THREE.Camera): SavedCameraView {
  return {
    target: { x: round4(target.x), z: round4(target.z) },
    offset: { x: round4(camera.position.x - target.x), y: round4(camera.position.y - target.y), z: round4(camera.position.z - target.z) },
    zoom: round4((camera as THREE.OrthographicCamera).zoom),
  };
}

function CameraRig({ footprints, built, floor, mode }: { footprints: Record<EquipmentId, Footprint>; built: Record<EquipmentId, boolean>; floor: Floor; mode: GameMode }) {
  const controls = useRef<MapControlsImpl>(null);
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  /** The player has panned, zoomed or dragged the view, so it no longer follows the facility. */
  const touched = useRef(false);
  /** Turning back to the starting angle after Reset view. */
  const homing = useRef(false);
  /** Turn still to apply from Q, E or the rotate buttons. */
  const spin = useRef(0);
  /** The marker a campaign action asked the view to centre on, until the camera arrives or the player takes it. */
  const focusing = useRef<string | null>(null);
  const box = useRef<THREE.Box3 | null>(null);
  /** The last view written down or seen, and the latest view worth writing on leaving. */
  const persisting = useRef<{ last: number; json: string; view: SavedCameraView | null }>({ last: -Infinity, json: "", view: null });
  const v = useMemo(
    () => ({ offset: new THREE.Vector3(), dir: new THREE.Vector3(), before: new THREE.Vector3(), from: new THREE.Vector3(), centre: new THREE.Vector3() }),
    [],
  );

  // On the server floor, frame the equipment that is actually built, and widen the view as the facility grows. The
  // office floor is framed whole.
  useEffect(() => {
    const b = new THREE.Box3();
    const y = FLOOR_Y[floor];
    if (floor === "office") {
      b.expandByPoint(new THREE.Vector3(ROOM.x0 + 4, y, ROOM.z0 + 2));
      b.expandByPoint(new THREE.Vector3(ROOM.x1 - 4, y + 1.2, ROOM.z1 - 2));
    }
    for (const id of EQUIPMENT_ORDER) {
      if (!built[id] || floorOf(id) !== floor || floor === "office") continue;
      const f = footprints[id];
      b.expandByPoint(new THREE.Vector3(f.x - f.w / 2, y, f.z - f.d / 2));
      b.expandByPoint(new THREE.Vector3(f.x + f.w / 2, y + f.h, f.z + f.d / 2));
    }
    box.current = b.isEmpty() ? null : b;
  }, [footprints, built, floor]);

  useEffect(() => {
    cameraApi.zoomBy = (factor) => {
      touched.current = true;
      focusing.current = null;
      camera.zoom = THREE.MathUtils.clamp(camera.zoom * factor, 10, 140);
      camera.updateProjectionMatrix();
      controls.current?.update();
    };
    cameraApi.reset = () => {
      touched.current = false;
      focusing.current = null;
      homing.current = true;
      spin.current = 0;
    };
    cameraApi.rotateBy = (radians) => {
      homing.current = false;
      spin.current += radians;
    };
  }, [camera]);

  // Once the controls exist, put the camera back where this mode left it: its target on the floor in view, the
  // same stand-off and the same zoom. The view then counts as taken, so the automatic framing leaves it alone.
  // A layout effect: the frame loop may tick before a passive effect, and the first snapshot must see the
  // restored view, not the mount's defaults.
  useLayoutEffect(() => {
    const c = controls.current;
    const saved = loadExploration(mode).camera;
    if (!c || !saved) return;
    c.target.set(saved.target.x, FLOOR_Y[floor], saved.target.z);
    camera.position.set(c.target.x + saved.offset.x, c.target.y + saved.offset.y, c.target.z + saved.offset.z);
    camera.zoom = saved.zoom;
    camera.updateProjectionMatrix();
    camera.lookAt(c.target);
    c.update();
    touched.current = true;
    homing.current = false;
    spin.current = 0;
    const view = viewOf(c.target, camera);
    persisting.current.json = JSON.stringify(view);
    persisting.current.view = view;
    // Restores the mount's own mode and floor only; a mode switch remounts the rig (see the key below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The latest steady view is written on the way out: hiding the page or the rig unmounting. A view mid-ride or
  // from before a run started is never written — the title screen's framing behind it is not the player's.
  useEffect(() => {
    const flush = () => {
      const p = persisting.current;
      if (p.view && !riding()) saveExploration(mode, { camera: p.view });
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [mode]);

  // A campaign action centres its machine at the default zoom, then leaves the camera where the player can take it.
  useEffect(
    () =>
      useGame.subscribe((s, prev) => {
        if (!s.cameraFocus || s.cameraFocus === prev.cameraFocus) return;
        focusing.current = s.cameraFocus.anchor;
        touched.current = true;
        homing.current = false;
      }),
    [],
  );

  // Q and E turn the room. Ignored while typing and before a run starts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (e.ctrlKey || e.metaKey || e.altKey || !useGame.getState().started) return;
      if (e.key === "q" || e.key === "Q") cameraApi.rotateBy(-TURN);
      else if (e.key === "e" || e.key === "E") cameraApi.rotateBy(TURN);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Tell the office's sounds where they are heard: the camera's target, or in walk mode on the office floor the
  // avatar's own spot, independent of the camera, and whether the office floor is on screen.
  useFrame((state) => {
    const c = controls.current;
    if (!c) return;
    const walking = useGame.getState().walking && avatar.floor === "office" && !riding();
    viewFocus.x = walking ? avatar.x : c.target.x;
    viewFocus.z = walking ? avatar.z : c.target.z;
    viewFocus.zoom = (state.camera as THREE.OrthographicCamera).zoom;
    viewFocus.walking = walking;
    viewFocus.live = shownFloor() === "office";
  });
  useEffect(
    () => () => {
      viewFocus.live = false;
      viewFocus.walking = false;
    },
    [],
  );

  // Read the camera from the frame state: R3F expects per-frame mutation here, not on the hook's render value.
  useFrame((state) => {
    const c = controls.current;
    if (!c) return;
    const camera = state.camera as THREE.OrthographicCamera;
    const { size } = state;
    const { offset, dir, before, from, centre } = v;
    // Entering walk mode takes the camera over, so it no longer frames the equipment.
    const walking = useGame.getState().walking;
    if (walking) touched.current = true;
    offset.copy(camera.position).sub(c.target);
    const distance = offset.length();
    from.copy(offset).normalize().negate();
    let turned = false;
    if (Math.abs(spin.current) > 1e-4) {
      const step = Math.abs(spin.current) < 0.004 ? spin.current : spin.current * 0.16;
      offset.applyAxisAngle(UP, step);
      spin.current -= step;
      turned = true;
    }
    if (homing.current) {
      offset.normalize().lerp(HOME, 0.14).normalize();
      if (offset.distanceTo(HOME) < 0.002) {
        offset.copy(HOME);
        homing.current = false;
      }
      offset.multiplyScalar(distance);
      turned = true;
    }
    if (turned) {
      // While the view follows the facility, turn about the built equipment so it holds its place on screen.
      if (!touched.current && box.current) turnAbout(c.target, box.current.getCenter(centre), from, dir.copy(offset).normalize().negate(), c.target.y);
      camera.position.copy(c.target).add(offset);
      // The controls aimed the camera earlier this frame, from where it stood before the turn.
      camera.lookAt(c.target);
    }

    // Until the player takes the camera, ease toward a framing of the floor's built equipment from the current angle.
    if (!touched.current && box.current) {
      dir.copy(offset).normalize().negate();
      const want = frameBox(box.current, dir, size.width, size.height, FLOOR_Y[floor]);
      const k = 0.1;
      camera.zoom += (want.zoom - camera.zoom) * k;
      before.copy(c.target);
      c.target.x += (want.target.x - c.target.x) * k;
      c.target.z += (want.target.z - c.target.z) * k;
      camera.position.add(c.target).sub(before);
      camera.updateProjectionMatrix();
    }
    const aim = focusing.current ? anchors.get(focusing.current) : undefined;
    if (aim) {
      dir.copy(camera.position).sub(c.target).normalize().negate();
      const zoom = box.current ? frameBox(box.current, dir, size.width, size.height, FLOOR_Y[floor]).zoom : camera.zoom;
      const goal = centreOn(aim, dir, zoom, size.width, size.height, FLOOR_Y[floor]);
      const k = reducedMotion() ? 1 : 0.12;
      camera.zoom += (zoom - camera.zoom) * k;
      before.copy(c.target);
      c.target.x += (goal.x - c.target.x) * k;
      c.target.z += (goal.z - c.target.z) * k;
      camera.position.add(c.target).sub(before);
      camera.updateProjectionMatrix();
      if (Math.abs(zoom - camera.zoom) < 0.05 && Math.hypot(goal.x - c.target.x, goal.z - c.target.z) < 0.01) focusing.current = null;
    }
    // Ride with the elevator: the view's height follows the car on the clock, however few frames are drawn.
    const y = viewHeight();
    camera.position.y += y - c.target.y;
    c.target.y = y;
    ride.y = y;
    if (dipEl) {
      const moving = riding();
      const f = rideAt(rideClock());
      dipEl.style.opacity = moving ? f.dip.toFixed(3) : "0";
      const down = FLOOR_Y[ride.to] < FLOOR_Y[ride.from];
      const progress = down ? f.car : 1 - f.car;
      dipEl.style.setProperty("--ride-shift", `${(-18 + progress * 36).toFixed(1)}%`);
      dipEl.style.setProperty("--ride-glow-y", `${(12 + progress * 76).toFixed(1)}%`);
      dipEl.style.backgroundPosition = `0 ${(progress * 100).toFixed(1)}%`;
    }
    // Keep the view over the building while panning.
    const t = c.target;
    const cx = THREE.MathUtils.clamp(t.x, ROOM.x0, ROOM.x1);
    const cz = THREE.MathUtils.clamp(t.z, ROOM.z0, ROOM.z1);
    if (cx !== t.x || cz !== t.z) {
      camera.position.x += cx - t.x;
      camera.position.z += cz - t.z;
      t.x = cx;
      t.z = cz;
    }
    // Lower whichever walls now stand between the camera and the room.
    updateWalls(dir.copy(c.target).sub(camera.position).normalize());
    // Last, so the labels follow the camera as it ends up this frame.
    placeLabels(camera, size);
    // And the view as it ended up is worth remembering — but only the player's own, never while the title
    // screen is up or the elevator is between floors.
    const p = persisting.current;
    if (useGame.getState().started && !riding()) {
      const view = viewOf(c.target, camera);
      p.view = view;
      const json = JSON.stringify(view);
      const t = now();
      if (json !== p.json && t - p.last >= VIEW_SAVE_EVERY) {
        p.last = t;
        p.json = json;
        saveExploration(mode, { camera: view });
      }
    }
  });

  return (
    <MapControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.14}
      zoomToCursor
      zoomSpeed={1.1}
      minZoom={10}
      maxZoom={140}
      rotateSpeed={0.7}
      minPolarAngle={MIN_TILT}
      maxPolarAngle={MAX_TILT}
      target={TARGET}
      onStart={() => {
        touched.current = true;
        homing.current = false;
        focusing.current = null;
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

/* A toy server room at night: flat indigo cabinets, warm desks and bright status lights. */
const STEEL = EQUIPMENT.rack;
const TRIM = EQUIPMENT.trim;
const BEZEL = EQUIPMENT.bezel;

function Rack({
  x,
  z,
  led,
  variant = "server",
  size = RACK,
  tint = STEEL,
}: {
  x: number;
  z: number;
  led: Led;
  variant?: PanelVariant;
  size?: { w: number; d: number; h: number };
  tint?: string;
}) {
  const tex = useMemo(() => panelTextures(variant, led), [variant, led]);
  // In HD the cabinets are powder-coated steel that catches the room's reflections.
  const hd = useDetail() === "hd";
  return (
    <group position={[x, 0, z]}>
      <mesh castShadow receiveShadow position={[0, size.h / 2, 0]}>
        <boxGeometry args={[size.w, size.h, size.d]} />
        <meshStandardMaterial color={tint} metalness={hd ? 0.45 : 0.1} roughness={hd ? 0.42 : 0.8} />
      </mesh>
      <mesh position={[0, size.h / 2, size.d / 2 + 0.006]}>
        <planeGeometry args={[size.w * 0.87, size.h * 0.93]} />
        <meshStandardMaterial
          map={tex.map}
          emissiveMap={tex.emissive}
          emissive="#ffffff"
          emissiveIntensity={1.7}
          roughness={0.7}
          metalness={0.05}
        />
      </mesh>
      {/* Side vent panel, visible from the camera's side of the rack. */}
      <mesh position={[size.w / 2 + 0.004, size.h / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[size.d * 0.8, size.h * 0.86]} />
        <meshStandardMaterial color={TRIM} metalness={0.05} roughness={0.85} />
      </mesh>
      <mesh position={[0, size.h + 0.025, size.d / 2 - 0.09]}>
        <boxGeometry args={[size.w * 0.72, 0.05, 0.07]} />
        <meshStandardMaterial
          color={LED_COLORS[led]}
          emissive={LED_COLORS[led]}
          emissiveIntensity={led === "off" ? 0 : 1.5}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function Screen({ kind, w, h, position, rotation }: { kind: ScreenKind; w: number; h: number; position: [number, number, number]; rotation?: [number, number, number] }) {
  const map = useMemo(() => screenTexture(kind), [kind]);
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={[w + 0.07, h + 0.07, 0.045]} />
        <meshStandardMaterial color={BEZEL} metalness={0.05} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0, 0.026]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={map} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Cabling with moving traffic                                         */
/* ------------------------------------------------------------------ */

type P2 = [number, number];

function Cable({ points, speed, alert }: { points: P2[]; speed: number; alert: boolean }) {
  const packets = useRef<THREE.InstancedMesh>(null);
  const segments = useMemo(() => {
    const out: { a: P2; b: P2; len: number; start: number }[] = [];
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.01) continue;
      out.push({ a, b, len, start: total });
      total += len;
    }
    return { list: out, total };
  }, [points]);
  const count = Math.max(1, Math.round(segments.total / 2.4));
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = alert ? "#ff4d5e" : "#4cb8ff";

  useFrame(({ clock }) => {
    const mesh = packets.current;
    if (!mesh || segments.total <= 0) return;
    const t = clock.elapsedTime * (0.9 + speed * 2.2);
    for (let i = 0; i < count; i++) {
      const d = (t + (i * segments.total) / count) % segments.total;
      const seg = segments.list.find((s) => d >= s.start && d <= s.start + s.len) ?? segments.list[0];
      const f = (d - seg.start) / seg.len;
      dummy.position.set(seg.a[0] + (seg.b[0] - seg.a[0]) * f, 0.075, seg.a[1] + (seg.b[1] - seg.a[1]) * f);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {segments.list.map((s, i) => {
        const horizontal = Math.abs(s.b[0] - s.a[0]) > Math.abs(s.b[1] - s.a[1]);
        return (
          <mesh key={i} receiveShadow position={[(s.a[0] + s.b[0]) / 2, 0.025, (s.a[1] + s.b[1]) / 2]}>
            <boxGeometry args={horizontal ? [s.len + 0.2, 0.05, 0.2] : [0.2, 0.05, s.len + 0.2]} />
            <meshStandardMaterial color={alert ? "#4a1630" : TRIM} emissive={color} emissiveIntensity={alert ? 0.45 : 0.1} roughness={0.8} />
          </mesh>
        );
      })}
      <instancedMesh ref={packets} args={[undefined, undefined, count]} key={count}>
        <boxGeometry args={[0.13, 0.05, 0.13]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Floor markings, hit areas and labels for each piece of equipment    */
/* ------------------------------------------------------------------ */

const ACCENT = "#4cb8ff";
const ALERT = "#ff4d5e";
const AMBER = "#ff9f1a";

function Pad({ id, f, built, symptomatic, inspecting }: { id: EquipmentId; f: Footprint; built: boolean; symptomatic: boolean; inspecting: boolean }) {
  const selected = useGame((s) => s.selected === id);
  const hovered = useGame((s) => s.hovered === id);
  const affected = useGame((s) => s.affected.includes(id));
  const fill = useRef<THREE.MeshBasicMaterial>(null);
  const alerting = symptomatic || inspecting;

  useFrame(({ clock }) => {
    if (!fill.current) return;
    const base = alerting ? 0.16 : affected ? 0.14 : selected ? 0.13 : hovered ? 0.07 : 0;
    // The machine an action would change breathes gently; an alert pulses faster.
    fill.current.opacity = alerting ? base + 0.1 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 4.2))
      : affected ? base + 0.12 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 3)) : base;
  });

  const color = inspecting ? AMBER : symptomatic ? ALERT : selected || hovered || affected ? ACCENT : built ? ROOM_PALETTE.footprint.built : ROOM_PALETTE.footprint.empty;
  // The same points while the footprint is unchanged: drei's Line disposes its material whenever new points arrive,
  // so a fresh array on every tick of the game rebuilt the outline's shader every few seconds.
  const outline = useMemo((): [number, number, number][] => {
    const hw = f.w / 2;
    const hd = f.d / 2;
    return [
      [-hw, 0, -hd],
      [hw, 0, -hd],
      [hw, 0, hd],
      [-hw, 0, hd],
      [-hw, 0, -hd],
    ];
  }, [f.w, f.d]);

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    useGame.getState().hover(id);
    document.body.style.cursor = "pointer";
  };
  const onOut = () => {
    if (useGame.getState().hovered === id) useGame.getState().hover(null);
    document.body.style.cursor = "";
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    e.stopPropagation();
    inspectInRoom(id);
    approach(id, f);
  };

  return (
    <group position={[f.x, 0, f.z]}>
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[f.w, f.d]} />
        <meshBasicMaterial ref={fill} color={color} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <group position={[0, 0.02, 0]}>
        <Line
          points={outline}
          color={color}
          lineWidth={selected || alerting || affected ? 2.6 : hovered ? 2.2 : 1.3}
          dashed={!built}
          dashSize={0.32}
          gapSize={0.22}
          transparent
          opacity={built || hovered || selected || affected ? 0.95 : 0.7}
        />
      </group>
      {/* Invisible volume that catches hover and click for the whole group. */}
      <mesh position={[0, Math.max(0.4, f.h / 2), 0]} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
        <boxGeometry args={[f.w, Math.max(0.8, f.h), f.d]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/*
 * Labels are ordinary DOM buttons laid over the canvas. Each frame the scene
 * projects an anchor point above every piece of equipment to screen space and
 * moves the matching button there, so labels stay crisp and keyboard-focusable.
 */
const anchors = new Map<string, THREE.Vector3>();
const labelEls = new Map<string, HTMLElement>();
const INTERNET = "internet";
const labelAt = new THREE.Vector2();
/** Where each label goes this frame, kept until overlapping ones are moved apart. */
const placed = new Map<string, { x: number; y: number }>();
/** A campaign run is on screen, which lays its labels out differently. */
let inCampaign = false;
let inSpikes = false;
let campaignAppIds: string[] = [];

function LabelAnchors({ footprints }: { footprints: Record<EquipmentId, Footprint> }) {
  const apps = useGame((s) => s.game.campaign?.apps);
  const spikes = useGame((s) => !!s.game.campaign?.spikeStage);

  useEffect(() => {
    for (const id of EQUIPMENT_ORDER) {
      const f = footprints[id];
      anchors.set(id, new THREE.Vector3(f.x, FLOOR_Y[floorOf(id)] + f.h + 0.3, f.z));
    }
    anchors.set(INTERNET, new THREE.Vector3(ROOM.x0 + 0.2, FLOOR_Y.servers + 1.35, AISLE_Z));
    for (const id of anchors.keys()) if (/^app-/.test(id)) anchors.delete(id);
    if (apps) {
      apps.forEach((a, i) => {
        const p = appSlot(i);
        anchors.set(a.id, new THREE.Vector3(p.x, FLOOR_Y.servers + RACK.h + 0.6, p.z));
      });
    }
    inCampaign = !!apps;
    inSpikes = spikes;
    campaignAppIds = apps?.map(a => a.id) ?? [];
  }, [footprints, apps, spikes]);
  return null;
}

/**
 * Moves every label to its anchor as the camera stands right now. `CameraRig` calls this once it has finished moving
 * the camera for the frame, so a label is placed for the view the renderer is about to draw rather than the last one.
 */
function placeLabels(camera: THREE.Camera, size: { width: number; height: number }) {
  anchors.forEach((pos, key) => {
    const el = labelEls.get(key);
    if (!el) return;
    screenPoint(pos, camera, size.width, size.height, labelAt);
    let { x, y } = labelAt;
    // In a campaign, spread the labels of the app servers and the gateway apart, and keep the cache's on a narrow screen.
    const slot = campaignAppIds.indexOf(key);
    y += labelEls.has("app-1") && key === "app" ? -100 : labelEls.has("app-1") && key === "gateway" ? -30 : slot >= 0 ? slot * 22 - 10 : 0;
    // The mobile bottom panel occupies at most 56% of the room. Spread the
    // growing pool above it by slot order, even when permanent IDs have gaps.
    if (inSpikes && slot >= 0 && size.width <= 900) {
      y = Math.min(y, size.height * 0.40 - (campaignAppIds.length - 1 - slot) * 26);
      x = Math.max(size.width * 0.78, Math.min(size.width - 65, x));
    }
    if (key === "cache" && inCampaign && size.width <= 900) {
      y = Math.min(y, size.height * 0.32);
      x = Math.max(65, Math.min(size.width - 65, x));
    }
    placed.set(key, { x, y });
  });
  // The Read Cache stands beside the database, so from some views their markers meet: stack the cache's above.
  const cache = placed.get("cache"), db = placed.get("db"), cacheEl = labelEls.get("cache"), dbEl = labelEls.get("db");
  if (cache && db && cacheEl && dbEl) {
    const h = Math.max(cacheEl.offsetHeight, dbEl.offsetHeight) + 12;
    if (Math.abs(cache.x - db.x) < (cacheEl.offsetWidth + dbEl.offsetWidth) / 2 && Math.abs(cache.y - db.y) < h) cache.y = Math.min(cache.y, db.y - h);
  }
  placed.forEach(({ x, y }, key) => {
    const el = labelEls.get(key)!;
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    el.style.visibility = "visible";
  });
  placed.clear();
}

function bindLabel(key: string) {
  return (el: HTMLElement | null) => {
    if (el) labelEls.set(key, el);
    else labelEls.delete(key);
  };
}

/** In walk mode, choosing equipment on the avatar's floor also sends the avatar over to it. */
function approach(id: EquipmentId, f: Footprint): void {
  if (!useGame.getState().walking || riding() || floorOf(id) !== avatar.floor) return;
  walkTo(f.x, f.z);
}

function Label({ id, m }: { id: EquipmentId; m: SceneModel }) {
  const selected = useGame((s) => s.selected === id);
  const hovered = useGame((s) => s.hovered === id);
  const affected = useGame((s) => s.affected.includes(id));
  const built = m.built[id];
  const inspecting = m.inspecting === id;
  const inspected = m.inspected.includes(id);
  const tone = inspecting ? "busy" : m.symptomatic.includes(id) ? "alert" : !built ? "absent" : m.states[id];
  return (
    <button
      type="button"
      ref={bindLabel(id)}
      data-eq={id}
      {...tipProps(useGame.getState().game.campaign ? INFRASTRUCTURE_TIPS[id] : undefined)}
      className={`eq-label tone-${tone}${selected ? " is-selected" : ""}${affected ? " is-affected" : ""}${!built && !selected && !hovered && !affected ? " is-quiet" : ""}`}
      onClick={() => {
        inspectInRoom(id);
        approach(id, m.footprints[id]);
      }}
      onFocus={() => useGame.getState().hover(id)}
      onBlur={() => useGame.getState().hover(null)}
      aria-pressed={selected}
      aria-label={`${m.names[id]}${built ? "" : ", not built"}`}
    >
      <span className="eq-icon" aria-hidden="true">
        <Icon name={EQUIPMENT_ICON[id]} />
      </span>
      <span>{m.names[id]}</span>
      {!built && <span className="eq-note">not built</span>}
      {inspecting && <span className="eq-note">investigating</span>}
      {inspected && !inspecting && <span className="eq-note">checked</span>}
    </button>
  );
}

/**
 * The labels of the floor the elevator stands at. While it rides there are none, and the new floor's appear as it
 * arrives, so nothing on screen points at a floor that is not drawn.
 */
function Labels({ landed }: { landed: Floor | null }) {
  const m = useSceneModel();
  const game=useGame(s=>s.game);
  const c=game.campaign;
  const selectedAppId=useGame(s=>s.selectedAppId);
  const selected=useGame(s=>s.selected);
  const appsAffected=useGame(s=>s.affected.includes("app"));
  const servers = landed === "servers";
  return (
    <div className="eq-labels">
      {servers && (
        <span className="wall-tag" ref={bindLabel(INTERNET)}>
          <Icon name="network" />
          Internet
        </span>
      )}
      {EQUIPMENT_ORDER.filter((id) => floorOf(id) === landed && canInspectEquipment(game, id) && (m.opening ? ["gateway","app","db","monitoring","team","deploy","growth",...(c?.dataStage?["cache"]:[])].includes(id) : (id !== "replica" && id !== "backup") || m.built[id])).map((id) => (
        <Label key={id} id={id} m={m} />
      ))}
      {servers&&c?.openingMilestone?.acknowledged&&c.apps.map((a,i)=><button key={a.id} ref={bindLabel(a.id)} data-eq={a.id} className={`eq-label tone-${a.routed?m.hosts[i]:"absent"}${selected==="app"&&selectedAppId===a.id?" is-selected":""}${appsAffected?" is-affected":""}`} aria-pressed={selected==="app"&&selectedAppId===a.id} aria-label={`App ${a.id.slice(4)}`} onClick={()=>inspectInRoom("app",a.id)} onFocus={()=>useGame.getState().hover("app")} onBlur={()=>useGame.getState().hover(null)}>{`App ${a.id.slice(4)}`}<span className="eq-note">{a.health==="failed"?`failed · ${a.detectedHealth??"unknown"}`:a.role==="spare"?"spare · unrouted":a.routed?"routed":"unrouted"}</span></button>)}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The room                                                            */
/* ------------------------------------------------------------------ */

/** Tint of the polished concrete under the corridors in HD. */
const CONCRETE_TINT = ROOM_PALETTE.floor.concrete;

function Room({ servers = false }: { servers?: boolean }) {
  const tiles = useMemo(() => {
    const t = concreteFloor();
    t.repeat.set(ROOM.w / 1.6, ROOM.d / 1.6);
    return t;
  }, []);
  const surfaces = useSurfaces();
  const hd = useMemo(() => {
    if (!surfaces) return null;
    const s = surfaces.concrete;
    return { geometry: projectUV(new THREE.PlaneGeometry(ROOM.w, ROOM.d), s.size, [ROOM.cx, -ROOM.cz, 0]), material: surfaceMaterial(s, CONCRETE_TINT, 0.9) };
  }, [surfaces]);
  useEffect(
    () => () => {
      hd?.geometry.dispose();
      hd?.material.dispose();
    },
    [hd],
  );
  return (
    <group>
      {hd ? (
        <mesh key="hd" receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[ROOM.cx, 0, ROOM.cz]} geometry={hd.geometry} material={hd.material} />
      ) : (
        <mesh key="basic" receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[ROOM.cx, 0, ROOM.cz]}>
          <planeGeometry args={[ROOM.w, ROOM.d]} />
          <meshLambertMaterial map={tiles} />
        </mesh>
      )}
      <mesh position={[ROOM.cx, -0.26, ROOM.cz]}>
        <boxGeometry args={[ROOM.w + 0.5, 0.5, ROOM.d + 0.5]} />
        <meshStandardMaterial color={ROOM_PALETTE.slab} roughness={0.9} />
      </mesh>
      {/* Four walls; the ones between the camera and the room drop to a low rim. */}
      <Wall wall="back" x={ROOM.cx} z={ROOM.z0 - 0.12} size={[ROOM.w + 0.5, ROOM.wallH, 0.24]} color={ROOM_PALETTE.wall} />
      <Wall wall="front" x={ROOM.cx} z={ROOM.z1 + 0.12} size={[ROOM.w + 0.5, ROOM.wallH, 0.24]} color={ROOM_PALETTE.wall} />
      <Wall wall="left" x={ROOM.x0 - 0.12} z={ROOM.cz} size={[0.24, ROOM.wallH, ROOM.d]} color={ROOM_PALETTE.wallSide} />
      <Wall wall="right" x={ROOM.x1 + 0.12} z={ROOM.cz} size={[0.24, ROOM.wallH, ROOM.d]} color={ROOM_PALETTE.wallSide} />
      <mesh position={[ROOM.cx, 0.12, ROOM.z0 + 0.02]}>
        <boxGeometry args={[ROOM.w, 0.24, 0.04]} />
        <meshStandardMaterial color={ROOM_PALETTE.skirting} roughness={0.85} />
      </mesh>
      <mesh position={[ROOM.x0 + 0.02, 0.12, ROOM.cz]}>
        <boxGeometry args={[0.04, 0.24, ROOM.d]} />
        <meshStandardMaterial color={ROOM_PALETTE.skirting} roughness={0.85} />
      </mesh>
      {servers && (
        <>
          {/* Overhead cable tray along the back wall. */}
          <OnWall wall="back">
            <mesh castShadow position={[-3, 2.75, ROOM.z0 + 0.35]}>
              <boxGeometry args={[17, 0.1, 0.5]} />
              <meshStandardMaterial color={TRIM} metalness={0.05} roughness={0.85} />
            </mesh>
          </OnWall>
          {/* Where the internet uplink enters the building. */}
          <mesh position={[ROOM.x0 + 0.1, 0.5, AISLE_Z]}>
            <boxGeometry args={[0.2, 1, 0.7]} />
            <meshStandardMaterial color={BEZEL} metalness={0.05} roughness={0.85} />
          </mesh>
        </>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

/** How long after the room opens the floor out of view is prepared for its first ride, in milliseconds. */
const WARM_MS = 4000;

/** How long preparing shaders may hold up a frame, in milliseconds, before it waits for the next. */
const PREPARE_BUDGET_MS = 6;

/** Up to how many objects are prepared together; bigger groups are split into their children. */
const PREPARE_PIECE = 24;

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** The room cut into pieces of at most PREPARE_PIECE objects where it can be: a drawn object keeps its children. */
function pieces(o: THREE.Object3D): THREE.Object3D[] {
  const drawn = (o as THREE.Mesh).isMesh || (o as THREE.Line).isLine || (o as THREE.Points).isPoints || (o as THREE.Sprite).isSprite;
  if (drawn || o.children.length === 0) return [o];
  let size = 0;
  o.traverse(() => void size++);
  return size <= PREPARE_PIECE ? [o] : o.children.flatMap(pieces);
}

/**
 * Prepares the shaders of both floors for how the room is drawn: through the effects pass, into its buffer with
 * linear colour and no tone mapping, or straight to the screen in sRGB with the renderer's tone mapping. three keys
 * each material's shader on where it draws, and the effects pass turns the renderer's tone mapping off, so outside
 * a frame the screen with no tone mapping would be prepared, a way nothing ever draws. With effects the pass's
 * buffer is set here instead; without them the screen is already right. Building them all at once would hold the
 * page up, so the room is prepared a piece at a time, a few milliseconds a frame.
 */
async function prepareShaders(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, effects: boolean, signal: AbortSignal): Promise<void> {
  const buffer = effects ? new THREE.WebGLRenderTarget(1, 1) : null;
  try {
    let started = performance.now();
    // three prepares every object in a piece, shown or not, so the floor out of view is included.
    for (const piece of pieces(scene)) {
      if (performance.now() - started > PREPARE_BUDGET_MS) {
        await nextFrame();
        started = performance.now();
      }
      if (signal.aborted) return;
      const target = gl.getRenderTarget();
      try {
        gl.setRenderTarget(buffer);
        gl.compile(piece, camera, scene);
      } catch {
        // Only a head start: the shaders build when first drawn anyway.
      } finally {
        gl.setRenderTarget(target);
      }
    }
  } finally {
    buffer?.dispose();
  }
}

/** Sky light and reflection strength at HD detail. */
const HD_SKY = 1.45;
const HD_REFLECTIONS = 0.3;

/** How far the office's sun stands from the room, along the direction its light comes from. */
const SUN_DISTANCE = 21.4;

/**
 * The time of day (see sky.ts), moved on every frame: the sky behind the city, the city's own light, and the
 * office's sun and sky light. The office's lights follow the day's colour and the sun across the sky, but never
 * drop low or dim far, so the room reads the same at noon and at three in the morning.
 */
function Daylight({ quality, hd }: { quality: QualityProfile; hd: boolean }) {
  const sky = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const background = useRef<THREE.Color>(null);
  // Reflections light the HD materials too, so the sky light is turned down to keep the same brightness.
  const skyStrength = hd ? HD_SKY : 1.7;
  useFrame(() => {
    const d = daylightNow();
    applyDaylight(d, quality.effects);
    background.current?.setRGB(d.horizon[0], d.horizon[1], d.horizon[2], THREE.SRGBColorSpace);
    if (sky.current) sky.current.intensity = skyStrength * d.office.sky;
    const light = sun.current;
    if (light) {
      light.intensity = d.office.sun;
      light.color.setRGB(d.office.colour[0], d.office.colour[1], d.office.colour[2], THREE.SRGBColorSpace);
      light.position.set(d.office.dir[0] * SUN_DISTANCE, d.office.dir[1] * SUN_DISTANCE, d.office.dir[2] * SUN_DISTANCE);
    }
  });
  return (
    <>
      <color ref={background} attach="background" args={["#1a1633"]} />
      <hemisphereLight ref={sky} args={["#fff0dd", ROOM_PALETTE.bounce, skyStrength]} />
      <directionalLight
        ref={sun}
        position={[11, 17, 7]}
        intensity={2.3}
        color="#fff1de"
        castShadow={quality.shadows}
        // The shadow map's sharpness and edge softness come from the quality setting.
        shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]}
        shadow-radius={quality.shadowRadius}
        shadow-bias={-0.0005}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={1}
        shadow-camera-far={60}
      />
    </>
  );
}

/**
 * Soft reflections of a generic bright room for the HD materials. It is built
 * on the graphics card from three's procedural room, so nothing is downloaded.
 * Attached as the scene's environment, and detached again at basic detail.
 */
function Reflections() {
  const gl = useThree((s) => s.gl);
  const env = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const texture = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    return texture;
  }, [gl]);
  useEffect(() => () => env.dispose(), [env]);
  return <primitive object={env} attach="environment" />;
}

/**
 * The HD finish, on a graphics card only. Ambient occlusion darkens the creases
 * where things meet the floor and each other, which grounds the furniture and
 * the crew; bloom lets screens, status lights and the neon sign glow. The
 * composer takes over tone mapping, so it ends with the same filmic curve the
 * renderer used before.
 */
function Effects() {
  return (
    <EffectComposer multisampling={4}>
      <N8AO aoRadius={1.5} distanceFalloff={1} intensity={5} quality="medium" halfRes />
      <Bloom mipmapBlur luminanceThreshold={0.9} luminanceSmoothing={0.25} intensity={0.6} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}

function Scene({ quality, landed, warm }: { quality: QualityProfile; landed: Floor | null; warm: boolean }) {
  const effects = quality.effects;
  const m = useSceneModel();
  const game = useGame(s => s.game);
  const campaign = game.campaign;
  const floor = useGame((s) => s.floor);
  const mode = useGame((s) => s.mode);
  const walking = useGame((s) => s.walking && s.started);
  const office = useRef<THREE.Group>(null);
  const servers = useRef<THREE.Group>(null);
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  // Draw one floor at a time, and light whichever it is: the lights move rather than switch, so no material is rebuilt.
  useFrame(() => {
    const shown = shownFloor();
    if (office.current) office.current.visible = shown === "office";
    if (servers.current) servers.current.visible = shown === "servers";
    const y = FLOOR_Y[shown] + 3.4;
    for (const l of lights.current) if (l) l.position.y = y;
  });
  const onFloor = (f: Floor) => EQUIPMENT_ORDER.filter((id) => floorOf(id) === f && landed === f && canInspectEquipment(game, id));
  // In Guided Mode the avatar is never offered an inspection the game would ignore.
  const inspectableFootprints = useMemo(() => {
    if (!game.campaign) return m.footprints;
    const f = {} as Record<EquipmentId, Footprint>;
    for (const id of EQUIPMENT_ORDER) if (canInspectEquipment(game, id)) f[id] = m.footprints[id];
    return f;
  }, [game, m]);
  // Once the room has loaded, prepare the floor out of view as well, so the first ride does not stall on new shaders.
  // Only on a graphics card: drawing on the CPU, compiling everything at once would stall the page for longer.
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    if (!warm) return;
    const job = new AbortController();
    const id = window.setTimeout(() => void prepareShaders(gl, scene, camera, effects, job.signal), WARM_MS);
    return () => {
      window.clearTimeout(id);
      job.abort();
    };
  }, [gl, scene, camera, warm, effects]);
  const sym = (id: EquipmentId) => m.symptomatic.includes(id);
  const racks = useMemo(() => racksOf(m), [m]);

  const appCount = Math.min(m.hosts.length, 12);
  const routedCount = campaign ? Math.max(...campaign.routing.targets.map(id => campaign.apps.findIndex(a=>a.id===id)+1)) : appCount;
  const appMaxX = appSlot(Math.min(routedCount, 6) - 1).x;
  const dbLastX = dbSlot(m.dbCabinets - 1).x;
  const aisleZ = AISLE_Z;
  const dataZ = 4.65;
  const trunkX = -8.3;
  const flow = m.flow;

  const edgeAlert = sym("gateway") || sym("app");
  const dataAlert = sym("db");
  const hd = useDetail() === "hd";

  return (
    <>
      {hd && <Reflections />}
      <Daylight quality={quality} hd={hd} />
      <pointLight ref={(l) => { lights.current[0] = l; }} position={[-3, 3.4, -3.5]} intensity={24} distance={13} color="#8fc3ff" />
      <pointLight ref={(l) => { lights.current[1] = l; }} position={[0, 3.4, 5]} intensity={20} distance={12} color="#ffcf94" />

      <Exterior />
      <ElevatorCar />
      <Avatar walking={walking} />
      <WalkDriver walking={walking} footprints={inspectableFootprints} names={m.names} racks={racks} />

      {/* The office floor, on top */}
      <group ref={office}>
        <Room />
        <Office crew={{ engineers: m.engineers, busy: m.busy, incident: m.incident, releases: m.releases, promos: m.promos }} />
        <Landing floor="office" interactive={landed === "office"} />
        <GlassDoors floor="office" />
        {walking && landed === "office" && <WalkFloor />}
        {onFloor("office").map((id) => (
          <Pad key={id} id={id} f={m.footprints[id]} built={m.built[id]} symptomatic={sym(id)} inspecting={m.inspecting === id} />
        ))}
      </group>

      {/* The server floor, a storey below */}
      <group ref={servers} position={[0, FLOOR_Y.servers, 0]}>
        <Room servers />
        <ServerFloor incident={m.incident} engineers={m.engineers} />
        <Landing floor="servers" interactive={landed === "servers"} />
        <GlassDoors floor="servers" />
        {walking && landed === "servers" && <WalkFloor />}

        {/* Network edge */}
        <Rack x={POS.gateway.x} z={POS.gateway.z} led={m.incident && sym("gateway") && m.inspected.includes("gateway") ? "warn" : "ok"} variant="network" />
        {m.lb && <Rack x={POS.loadBalancer.x} z={POS.loadBalancer.z} led="ok" variant="cache" size={{ w: 0.95, d: 1.05, h: 1.5 }} tint={EQUIPMENT.loadBalancer} />}

        {/* App servers */}
        {m.hosts.slice(0, 12).map((led, i) => {
          const p = appSlot(i);
          return <group key={i} onClick={landed==="servers"?e=>{if(e.delta<=6){e.stopPropagation();inspectInRoom("app",campaign?.apps[i]?.id??`app-${i+1}`);}}:undefined}><Rack x={p.x} z={p.z} led={led} /></group>;
        })}
        {Array.from({ length: m.temp }, (_, i) => {
          const p = tempSlot(i);
          return <Rack key={`t${i}`} x={p.x} z={p.z} led="temp" tint={EQUIPMENT.temporary} />;
        })}
        {m.standby && <Rack x={POS.standby.x} z={POS.standby.z} led="standby" tint={EQUIPMENT.standby} />}

        {/* Data tier */}
        {m.cache && <Rack x={POS.cache.x} z={POS.cache.z} led="ok" variant="cache" size={{ w: 0.95, d: 1.05, h: 1.3 }} tint={EQUIPMENT.cache} />}
        {Array.from({ length: m.dbCabinets }, (_, i) => {
          const p = dbSlot(i);
          return <Rack key={`d${i}`} x={p.x} z={p.z} led={m.dbLed} variant="db" size={DB_CABINET} tint={EQUIPMENT.database} />;
        })}
        {m.replica && <Rack x={POS.replica.x} z={POS.replica.z} led="ok" variant="db" size={DB_CABINET} tint={EQUIPMENT.database} />}
        {m.backup && <Rack x={POS.backup.x} z={POS.backup.z} led="ok" variant="storage" size={{ w: 1.9, d: 1.05, h: 1.25 }} tint={EQUIPMENT.backup} />}

        {/* Monitoring wall */}
        {m.monitoring > 0 &&
          [-1.6, 0, 1.6].map((dx, i) => (
            <Screen
              key={i}
              kind={m.incident ? "alert" : i === 2 && m.monitoring === 2 ? "chart" : "dash"}
              w={1.45}
              h={0.9}
              position={[POS.monitoring.x + dx, 2.05, ROOM.z0 + 0.05]}
            />
          ))}

        {/* Cabling: internet -> edge -> app servers -> (cache) -> database -> replica / backups */}
        <Cable points={[[ROOM.x0 + 0.2, aisleZ], [POS.gateway.x, aisleZ]]} speed={flow} alert={edgeAlert} />
        {campaign ? campaign.routing.targets.map(id=>{const p=appSlot(campaign.apps.findIndex(a=>a.id===id));return <Cable key={id} points={[[POS.gateway.x,aisleZ],[p.x,aisleZ],[p.x,p.z]]} speed={flow} alert={m.hosts[campaign.apps.findIndex(a=>a.id===id)]==="critical"} />;}) : <Cable points={[[POS.gateway.x, aisleZ], [Math.max(appMaxX, -6.6) + 0.4, aisleZ]]} speed={flow} alert={edgeAlert} />}
        <Cable
          points={[
            [trunkX, aisleZ],
            [trunkX, dataZ],
            [dbLastX + 0.4, dataZ],
          ]}
          speed={flow * (campaign?Math.max(.1,(campaign.snapshot.data?.databaseNewDemand??campaign.snapshot.app.processed)/Math.max(1,campaign.snapshot.app.processed)):(m.cache ? 0.7 : 1))}
          alert={dataAlert}
        />
        {campaign?.readCache&&<Cable points={[[trunkX,aisleZ],[POS.cache.x,aisleZ],[POS.cache.x,POS.cache.z],[POS.cache.x,dataZ],[dbLastX+.4,dataZ]]} speed={flow} alert={dataAlert} />}
        {m.replica && <Cable points={[[dbLastX + 0.4, dataZ], [POS.replica.x + 0.3, dataZ]]} speed={0.35} alert={false} />}
        {m.backup && <Cable points={[[m.replica ? POS.replica.x + 0.3 : dbLastX + 0.4, dataZ], [POS.backup.x + 0.4, dataZ]]} speed={0.15} alert={false} />}

        {onFloor("servers").map((id) => (
          <Pad key={id} id={id} f={m.footprints[id]} built={m.built[id]} symptomatic={sym(id)} inspecting={m.inspecting === id} />
        ))}
      </group>
      <LabelAnchors footprints={m.footprints} />

      {/* Each mode remembers its own view, so the rig remounts on a switch and restores that mode's camera. */}
      <CameraRig key={mode} footprints={m.footprints} built={m.built} floor={floor} mode={mode} />
      {effects && <Effects />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Hover summary (name, status, one metric)                            */
/* ------------------------------------------------------------------ */

function HoverTip({ container }: { container: React.RefObject<HTMLDivElement | null> }) {
  const hovered = useGame((s) => s.hovered);
  const game = useGame((s) => s.game);
  const tip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const move = (e: PointerEvent) => {
      if (!tip.current) return;
      const r = el.getBoundingClientRect();
      const x = Math.min(e.clientX - r.left + 16, r.width - 260);
      const y = Math.min(e.clientY - r.top + 18, r.height - 110);
      tip.current.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
    };
    el.addEventListener("pointermove", move);
    return () => el.removeEventListener("pointermove", move);
  }, [container]);

  const info = hovered ? equipmentInfo(game, hovered) : null;
  const incident = game.phase === "incident" && game.incident;
  let status = info ? STATE_META[info.state].word : "";
  let summary = info?.summary ?? "";
  let action = "";
  if (info && incident) {
    const checked = incident.evidence.some((e) => e.equipment === info.id);
    status = symptomaticEquipment(game).includes(info.id) ? "Showing symptoms" : info.built ? "No alert" : "Not built";
    summary = checked ? "Evidence collected" : info.built ? "Not yet investigated" : "";
    action = checked || !info.built ? "" : "Click to investigate";
  }

  return (
    <div ref={tip} className={`hover-tip${info ? " is-on" : ""}`} role="status" aria-live="off">
      {info && (
        <>
          <strong>{info.name}</strong>
          <span className={`hover-state tone-${incident ? (status === "Showing symptoms" ? "alert" : "ok") : info.state}`}>
            <Icon name={incident ? (status === "Showing symptoms" ? "alert" : "check") : STATE_META[info.state].icon} />
            {status}
          </span>
          {summary && <span className="hover-summary">{summary}</span>}
          {action && <span className="hover-action">{action}</span>}
        </>
      )}
    </div>
  );
}

/** True when WebGL is drawn on the CPU (SwiftShader, llvmpipe and similar), as on machines without a GPU. */
function isSoftwareRenderer(gl: THREE.WebGLRenderer): boolean {
  const ctx = gl.getContext();
  const info = ctx.getExtension("WEBGL_debug_renderer_info");
  const name = String(info ? ctx.getParameter(info.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER));
  return /swiftshader|llvmpipe|software|softpipe|basic render/i.test(name);
}

/** In on-demand mode, ask for a new frame `fps` times a second. */
function FrameLimiter({ fps }: { fps: number }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const id = window.setInterval(() => invalidate(), 1000 / fps);
    return () => window.clearInterval(id);
  }, [invalidate, fps]);
  return null;
}

/** Do what is within the avatar's reach: exactly what clicking it does, the elevator's ride, or a fun thing. */
function actOn(prompt: Prompt): string | null {
  if (prompt.kind === "equipment") {
    inspectInRoom(prompt.id);
    return null;
  }
  if (prompt.kind === "elevator") {
    useGame.getState().goToFloor(prompt.to, "elevator");
    return null;
  }
  play(prompt.prop, now());
  return prompt.prop.doing;
}

/** What a typing field, an open dialog or a menu does with keys is theirs, not the room's. */
const typing = (el: HTMLElement | null) => !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
const inOverlay = (el: HTMLElement | null) => !!el?.closest('[role="dialog"], [role="menu"], [role="listbox"]');
/** The arrow keys, and Space when the avatar has nothing in reach, belong to a focused button, tab, radio or slider. */
const onControl = (el: HTMLElement | null) => !!el?.closest('button, a, [role="tab"], [role="radio"], [role="slider"], [role="checkbox"]');

/**
 * Walk mode's controls on the page: the keys that move the avatar and use what is within its reach, a button with
 * what that is (so a tap works on a phone), and the same news for screen readers.
 */
function WalkControls() {
  const walking = useGame((s) => s.walking && s.started);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  // What the prompt button says a fun thing is doing, while its animation plays.
  const [activity, setActivity] = useState<{ propId: string; label: string } | null>(null);
  const activityTimer = useRef<number | null>(null);
  useEffect(() => onPrompt(setPrompt), []);
  // Stopping walk mode drops whatever the button said the avatar was doing.
  useEffect(() => useGame.subscribe((s) => { if (!s.walking) setActivity(null); }), []);
  const perform = useCallback((p: Prompt) => {
    const doing = actOn(p);
    if (!doing) return;
    setActivity({ propId: p.kind === "prop" ? p.prop.id : "", label: doing });
    if (activityTimer.current !== null) window.clearTimeout(activityTimer.current);
    // For as long as the prop's animation runs.
    activityTimer.current = window.setTimeout(() => {
      activityTimer.current = null;
      setActivity(null);
    }, 2600);
  }, []);
  useEffect(() => {
    if (!walking) {
      clearPrompt();
      if (activityTimer.current !== null) {
        window.clearTimeout(activityTimer.current);
        activityTimer.current = null;
      }
      return;
    }
    const down = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (typing(el) || inOverlay(el) || e.ctrlKey || e.metaKey || e.altKey) return;
      const arrow = e.code.startsWith("Arrow");
      if (e.code === "Space" && avatar.prompt && !riding()) {
        // A nearby thing to use beats whatever button last held focus.
        e.preventDefault();
        if (!e.repeat) perform(avatar.prompt);
        return;
      }
      if ((arrow || e.code === "Space") && onControl(el)) return;
      if (movesAvatar(e.code) || e.code === "ShiftLeft" || e.code === "ShiftRight") {
        if (!riding()) held.add(e.code);
        if (arrow) e.preventDefault();
      } else if (e.code === "Space") {
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => held.delete(e.code);
    // A key let go while the page was elsewhere would otherwise stay held.
    const letGo = () => held.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", letGo);
    document.addEventListener("visibilitychange", letGo);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", letGo);
      document.removeEventListener("visibilitychange", letGo);
      held.clear();
    };
  }, [walking, perform]);
  useEffect(
    () => () => {
      if (activityTimer.current !== null) window.clearTimeout(activityTimer.current);
    },
    []
  );
  const shown = walking ? prompt : null;
  const doing = shown?.kind === "prop" && activity?.propId === shown.prop.id ? activity.label : null;
  return (
    <>
      {shown && (
        <button type="button" className="walk-prompt" onClick={() => perform(shown)}>
          <kbd>Space</kbd>
          {doing ?? shown.label}
        </button>
      )}
      <span className="visually-hidden" role="status" aria-live="polite">
        {shown ? (doing ?? `${shown.label}: press Space`) : ""}
      </span>
    </>
  );
}

/** The Walk button among the camera's: on, the player steers their avatar; Esc or the button again stops. */
function WalkButton({ stage }: { stage: React.RefObject<HTMLDivElement | null> }) {
  const walking = useGame((s) => s.walking);
  return (
    <button
      type="button"
      className={`walk-button${walking ? " is-on" : ""}`}
      aria-pressed={walking}
      onClick={() => {
        useGame.getState().setWalking(!walking);
        // Leave the keys to the room: a focused button would take Space for itself.
        stage.current?.focus({ preventScroll: true });
      }}
      {...tipProps(walking ? "Stop walking (Esc)" : "Walk the building as your avatar")}
    >
      <Icon name="user" size={16} />
      Walk
    </button>
  );
}

/** The keys to know, for the camera or, in walk mode, for walking. */
function CameraHint() {
  const walking = useGame((s) => s.walking);
  return walking ? (
    <>
      <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> to walk · <kbd>Shift</kbd> to run · click the floor to go there · <kbd>Space</kbd> to use · <kbd>Esc</kbd> to stop
    </>
  ) : (
    <>
      <kbd>Shift</kbd> + drag to rotate and tilt · <kbd>Q</kbd> <kbd>E</kbd> to turn · <kbd>PgUp</kbd> <kbd>PgDn</kbd> to change floor
    </>
  );
}

/** The player has asked their system for less motion: floors cut rather than ride. */
const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * The floor the elevator stands at, whose labels and equipment can be clicked: null while it rides. It follows the
 * floor in the store, riding to each new one on the clock.
 */
function useLanded(): Floor | null {
  const [landed, setLanded] = useState<Floor | null>(() => useGame.getState().floor);
  useEffect(() => {
    placeCar(useGame.getState().floor);
    const stopRide = onRide((event) => setLanded(event === "arrive" ? ride.to : null));
    const stopFloor = useGame.subscribe((s, prev) => {
      if (s.floor !== prev.floor) depart(s.floor, reducedMotion());
    });
    return () => {
      stopFloor();
      stopRide();
    };
  }, []);
  return landed;
}

/** Take the view to a floor, or, pressed again for the floor already on its way, arrive there at once. */
function pressFloor(floor: Floor, how: "menu" | "key"): void {
  const s = useGame.getState();
  if (s.floor === floor) arrive();
  else s.goToFloor(floor, how);
}

/**
 * The floor menu, like an elevator's panel: the office on top, the servers below, the floor in view pressed. A floor
 * out of view that needs the player shows a badge.
 */
function FloorMenu() {
  const floor = useGame((s) => s.floor);
  const affected = useGame((s) => s.affected);
  const m = useSceneModel();
  return (
    <div className="floor-menu" role="group" aria-label="Floors">
      {FLOORS.map((f) => {
        const need = f === floor ? "none" : attentionOn(f, m);
        return (
          <button
            key={f}
            type="button"
            data-floor={f}
            className={`floor-button${f === floor ? " is-here" : ""}${f !== floor && affected.some((id) => floorOf(id) === f) ? " is-affected" : ""}`}
            aria-pressed={f === floor}
            onClick={() => pressFloor(f, "menu")}
            {...tipProps(`${FLOOR_NAME[f]} (${f === "office" ? "Page Up" : "Page Down"})`)}
          >
            <span className="floor-number" aria-hidden="true">
              {FLOOR_NUMBER[f]}
            </span>
            {FLOOR_NAME[f]}
            {need !== "none" && (
              <span className={`floor-badge tone-${need}`}>
                <span className="visually-hidden">{need === "alert" ? ", incident here" : ", needs a look"}</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function Facility() {
  const container = useRef<HTMLDivElement>(null);
  const landed = useLanded();
  // Page Up and Page Down ride between the floors, unless the player is typing or in a dialog or a menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "PageUp" && e.key !== "PageDown") return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable || el.closest('[role="dialog"], [role="menu"], [role="listbox"]'))) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || !useGame.getState().started) return;
      e.preventDefault();
      pressFloor(e.key === "PageUp" ? "office" : "servers", "key");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const [renderer, setRenderer] = useState<Renderer>("unknown");
  const [override] = useState(() => detailOverride(window.location.search));
  const chosen = useGame((s) => s.graphics.quality);
  // Without a graphics card the browser draws on the CPU. Auto keeps that playable: no shadows, half the pixels
  // (labels and the interface are HTML and stay sharp) and 20 frames a second. A GPU gets HD detail: photo
  // textures, physically based shading and reflections, without the effects pass. The player can pick a quality
  // instead (see the menu).
  const profile = resolveQuality(chosen, renderer, override);
  const capped = profile.fps !== null;
  // Auto on a graphics card watches the frame rate and, if it falls, draws fewer pixels (see adapt in quality.ts).
  // A quality the player chose is left exactly as chosen.
  const [load, setLoad] = useState<{ quality: GraphicsQuality; factor: number }>({ quality: chosen, factor: 1 });
  const factor = load.quality === chosen ? load.factor : 1;
  const adaptive = adapts(chosen, renderer, profile);
  const quality: QualityProfile = adaptive ? { ...profile, dpr: adapt(profile, factor, window.devicePixelRatio || 1) } : profile;
  return (
    <div className="stage-canvas" ref={container} tabIndex={-1}>
      {/* Shadow maps cannot be resized or switched on and off once materials are compiled, so a new quality starts a new canvas. */}
      <Canvas
        key={chosen}
        orthographic
        shadows={quality.shadows ? "percentage" : false}
        dpr={quality.dpr}
        frameloop={capped ? "demand" : "always"}
        // How strongly the HD environment lights materials; without one it has no effect.
        scene={{ environmentIntensity: HD_REFLECTIONS }}
        onCreated={({ gl }) => {
          const software = isSoftwareRenderer(gl);
          // Before the first frame, so no material is ever compiled with shadows that are not wanted.
          if (!resolveQuality(chosen, software ? "software" : "gpu", override).shadows) gl.shadowMap.enabled = false;
          setRenderer(software ? "software" : "gpu");
        }}
        camera={{ position: [TARGET.x + CAMERA_OFFSET.x, CAMERA_OFFSET.y, TARGET.z + CAMERA_OFFSET.z], zoom: 30, near: CAMERA_NEAR, far: CAMERA_FAR }}
        onPointerMissed={() => {
          if (useGame.getState().game.phase !== "incident") useGame.getState().select(null);
        }}
        aria-label="Isometric view of the server room. Each equipment label is a button."
      >
        {/* The room waits until the renderer is known, so a GPU never compiles the basic materials only to replace them. */}
        {renderer !== "unknown" && (
          <DetailContext.Provider value={quality.detail}>
            <Scene quality={quality} landed={landed} warm={renderer === "gpu"} />
          </DetailContext.Provider>
        )}
        {quality.fps !== null && <FrameLimiter fps={quality.fps} />}
        {adaptive && (
          <PerformanceMonitor
            factor={1}
            flipflops={3}
            onChange={({ factor }) => setLoad({ quality: chosen, factor })}
          />
        )}
      </Canvas>
      <div
        className="ride-dip"
        aria-hidden="true"
        ref={(el) => {
          dipEl = el;
        }}
      />
      <Labels landed={landed} />
      <HoverTip container={container} />
      <FloorMenu />
      <WalkControls />
      <div className="camera-buttons" role="group" aria-label="Camera">
        <button type="button" onClick={() => cameraApi.zoomBy(1.25)} aria-label="Zoom in" {...tipProps("Zoom in")}>
          +
        </button>
        <button type="button" onClick={() => cameraApi.zoomBy(0.8)} aria-label="Zoom out" {...tipProps("Zoom out")}>
          −
        </button>
        <button type="button" onClick={() => cameraApi.rotateBy(-TURN)} aria-label="Rotate left" {...tipProps("Rotate left (Q)")}>
          <Icon name="rotateLeft" size={16} />
        </button>
        <button type="button" onClick={() => cameraApi.rotateBy(TURN)} aria-label="Rotate right" {...tipProps("Rotate right (E)")}>
          <Icon name="rotateRight" size={16} />
        </button>
        <WalkButton stage={container} />
        <button type="button" onClick={() => cameraApi.reset()} aria-label="Reset view" {...tipProps("Reset view: fit the room and face the starting angle")}>
          ⌂
        </button>
        <span className="camera-hint" aria-hidden="true">
          <CameraHint />
        </span>
      </div>
    </div>
  );
}
