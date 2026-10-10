import { Line } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { equipmentInfo, EQUIPMENT_ORDER, type EquipmentId, type GameState } from "@/sim";
import { clockLive, founderPose, useFounder, workOn, type Job } from "@/game/founder";
import { inspectOrSelect, useGame } from "@/game/store";
import { Icon } from "../icons";
import { EQUIPMENT_ICON } from "../presentation";
import type { Activity } from "./cast";
import { Creature } from "./creatures";
import { ROOM } from "./layout";
import { findPath, gridFor, slide, type NavGrid, type Point } from "./nav";
import { heading, wrapAngle } from "./routes";
import { canWork, machineAt, SPAWN, station, workPoint, zone } from "./stations";

/*
 * The founder on the floor in Classic. W A S D or the arrow keys steer, relative
 * to the camera, so up is always away from the viewer. Clicking the floor walks
 * there; clicking a machine, or an action in its panel, walks to the machine
 * (see perform and inspectOrSelect in the store). Space works whatever machine
 * the founder is standing at (again to close its panel), Shift dashes, and Esc
 * drops the job in hand. A bubble over the founder's head says what it is doing
 * and how far along it is.
 */

/** Walking speed, in metres a second. */
const SPEED = 5;
/** A dash: a short burst of speed, then a moment before the next. */
const DASH = { speed: 14, seconds: 0.16, cooldown: 0.6 };
/** Radians the founder turns each second. */
const TURN_RATE = Math.PI * 4;
/** The founder stands a head taller than the crew, so the player can find it at a glance. */
const SCALE = 1.6;
/** Where the bubble floats, in metres above the floor. */
const BUBBLE_Y = 1.55;
/** The founder's marker colour, the colour of the game's go buttons. */
const MARK = "#ffd84a";

const MOVE_KEYS: Record<string, [number, number]> = {
  w: [1, 0],
  arrowup: [1, 0],
  s: [-1, 0],
  arrowdown: [-1, 0],
  d: [0, 1],
  arrowright: [0, 1],
  a: [0, -1],
  arrowleft: [0, -1],
};

type Store = ReturnType<typeof useGame.getState>;

/** Whether the player may steer the founder now: playing Classic, with nothing open over the room. */
function controllable(s: Store): boolean {
  return s.started && !s.game.campaign && (s.game.phase === "management" || s.game.phase === "incident") && !s.view && !s.onboarding;
}

/** The machines the founder can work: the ones that are built. */
function workable(game: GameState): EquipmentId[] {
  return EQUIPMENT_ORDER.filter((id) => equipmentInfo(game, id).built);
}

function typing(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

/**
 * Space at a machine: opens its panel, or closes it if it is already open. During an incident the panel is the
 * evidence, so Space only ever opens it there (and starts an investigation if one is due).
 */
function interact(near: EquipmentId): void {
  const s = useGame.getState();
  if (s.selected === near && s.game.phase !== "incident") s.select(null);
  else inspectOrSelect(near);
}

/** The bubble element, positioned each frame by the founder. */
let bubbleEl: HTMLElement | null = null;

export function Founder() {
  const grid = useGame((s) => gridFor(s.game));
  const body = useRef<THREE.Group>(null);
  const target = useRef<THREE.Mesh>(null);
  const keys = useRef(new Set<string>());
  const route = useRef<{ goal: unknown; grid: NavGrid; points: Point[] } | null>(null);
  const ring = useRef<THREE.Mesh>(null);
  /** Seconds of dash left, and until the next dash is allowed. */
  const dash = useRef({ left: 0, cool: 0 });
  const [activity, setActivity] = useState<Activity>("idle");
  const shown = useRef<Activity>("idle");
  const v = useMemo(() => new THREE.Vector3(), []);

  // On the floor, at the door; off again, with free hands, on leaving Classic.
  useEffect(() => {
    Object.assign(founderPose, { x: SPAWN.x, z: SPAWN.z, yaw: Math.PI });
    useFounder.getState().setPresent(true);
    return () => {
      useFounder.getState().setPresent(false);
      useFounder.getState().reset();
    };
  }, []);

  // A job belongs to the moment it was given: a new phase or a new run drops it.
  useEffect(
    () =>
      useGame.subscribe((s, prev) => {
        if (s.game.phase !== prev.game.phase || s.game.seed !== prev.game.seed || s.game.turn < prev.game.turn) useFounder.getState().setJob(null);
      }),
    [],
  );

  useEffect(() => {
    const held = keys.current;
    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      const k = e.key.toLowerCase();
      const s = useGame.getState();
      if (k in MOVE_KEYS) {
        if (!controllable(s)) return;
        held.add(k);
        e.preventDefault();
      } else if (e.key === "Shift") {
        // Only while on the move, so Shift + drag to turn the camera never sends the founder anywhere.
        const moving = held.size > 0 || useFounder.getState().goal !== null;
        if (e.repeat || !moving || !controllable(s) || dash.current.cool > 0) return;
        dash.current = { left: DASH.seconds, cool: DASH.cooldown };
      } else if (e.key === "Escape") {
        const job = useFounder.getState().job;
        if (!job || !controllable(s)) return;
        useFounder.getState().setJob(null);
        useFounder.getState().walkTo(null);
        s.notify(`Dropped: ${job.label.toLowerCase()}.`);
      } else if (e.key === " ") {
        // Space still presses a focused button.
        if (e.target instanceof HTMLElement && e.target.closest("button, a, [role='button']")) return;
        const near = useFounder.getState().near;
        if (!near || !controllable(s)) return;
        e.preventDefault();
        interact(near);
      }
    };
    const up = (e: KeyboardEvent) => held.delete(e.key.toLowerCase());
    const clear = () => held.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      held.clear();
    };
  }, []);

  useFrame(({ camera, size }, rawDt) => {
    // Slow frames (software rendering) still move the founder at full speed; only a stall, such as a hidden tab, is cut short.
    const dt = Math.min(rawDt, 0.25);
    const s = useGame.getState();
    const f = useFounder.getState();
    const live = controllable(s) && clockLive(s.game, s.running);
    const pose = founderPose;
    let moved: Point | null = null;
    // How far the founder can go this frame, with any dash on top.
    const d = dash.current;
    let reach = 0;
    if (live) {
      reach = SPEED * dt + (DASH.speed - SPEED) * Math.min(d.left, dt);
      d.left = Math.max(0, d.left - dt);
      d.cool = Math.max(0, d.cool - dt);
    }

    // Steering by keys, relative to where the camera looks.
    let ahead = 0;
    let side = 0;
    keys.current.forEach((k) => {
      ahead += MOVE_KEYS[k][0];
      side += MOVE_KEYS[k][1];
    });
    if (!controllable(s)) keys.current.clear();
    if (live && (ahead || side)) {
      if (f.goal) f.walkTo(null);
      route.current = null;
      camera.getWorldDirection(v);
      const len = Math.hypot(v.x, v.z) || 1;
      const fx = v.x / len;
      const fz = v.z / len;
      let dx = fx * ahead - fz * side;
      let dz = fz * ahead + fx * side;
      const n = Math.hypot(dx, dz);
      // Steps shorter than a floor cell, so a long frame or a dash cannot carry the founder through something thin.
      const steps = Math.ceil(reach / 0.1);
      dx = (dx / n) * (reach / steps);
      dz = (dz / n) * (reach / steps);
      let next: Point = pose;
      for (let i = 0; i < steps; i++) next = slide(grid, next, dx, dz);
      if (next.x !== pose.x || next.z !== pose.z) moved = { x: next.x - pose.x, z: next.z - pose.z };
      pose.x = next.x;
      pose.z = next.z;
    } else if (live && f.goal) {
      // Walking where a click sent it, re-planning if the goal or the floor changed.
      const r = route.current;
      if (!r || r.goal !== f.goal || r.grid !== grid) {
        const to = "station" in f.goal ? station(s.game, f.goal.station) : f.goal;
        const points = findPath(grid, pose, to);
        route.current = points ? { goal: f.goal, grid, points } : null;
        if (!points) {
          // Never expected (nav.test.ts walks to every machine), but a job that cannot be reached must not hold up the week.
          if (f.job && "station" in f.goal && f.job.station === f.goal.station) {
            s.notify(`The founder cannot get there. Dropped: ${f.job.label.toLowerCase()}.`, "error");
            f.setJob(null);
          }
          f.walkTo(null);
        }
      }
      // Sent to a machine, the founder stops as soon as it can work it.
      if ("station" in f.goal && canWork(s.game, f.goal.station, pose)) {
        route.current = null;
        f.walkTo(null);
      }
      const points = route.current?.points;
      if (points) {
        let step = reach;
        const from = { x: pose.x, z: pose.z };
        while (step > 0 && points.length) {
          const p = points[0];
          const gap = Math.hypot(p.x - pose.x, p.z - pose.z);
          if (gap <= step) {
            pose.x = p.x;
            pose.z = p.z;
            step -= gap;
            points.shift();
          } else {
            pose.x += ((p.x - pose.x) / gap) * step;
            pose.z += ((p.z - pose.z) / gap) * step;
            step = 0;
          }
        }
        if (pose.x !== from.x || pose.z !== from.z) moved = { x: pose.x - from.x, z: pose.z - from.z };
        if (!points.length) {
          route.current = null;
          f.walkTo(null);
        }
      }
    }

    // The machine whose zone the founder stands in, if any.
    const near = machineAt(s.game, workable(s.game), pose);
    if (near !== f.near) f.setNear(near);

    // Work the job in hand while standing at its machine.
    let working = false;
    const job: Job | null = f.job;
    if (job) {
      const inReach = !moved && canWork(s.game, job.station, pose);
      working = inReach && live;
      const next = workOn(job, { inReach, live, dt });
      if (next === "finished") {
        f.setJob(null);
        s.act(job.action);
      } else if (next !== job) {
        f.setJob(next);
      }
    }
    const inspecting = s.game.incident?.inspecting?.equipment;
    if (!moved && inspecting && inspecting === near && live) working = true;

    // Turn to face the way it walks, or the machine it works.
    let want: number | null = null;
    if (moved) want = heading(moved.x, moved.z);
    else {
      // Facing the side of the machine it works from.
      const at = job && canWork(s.game, job.station, pose) ? job.station : near && inspecting === near ? near : null;
      if (at) {
        const p = workPoint(s.game, at, pose);
        if (p.x !== pose.x || p.z !== pose.z) want = heading(p.x - pose.x, p.z - pose.z);
      }
    }
    if (want !== null) {
      const turn = wrapAngle(want - pose.yaw);
      pose.yaw += Math.sign(turn) * Math.min(Math.abs(turn), TURN_RATE * dt);
    }

    if (body.current) {
      body.current.position.set(pose.x, 0, pose.z);
      body.current.rotation.y = pose.yaw;
    }
    // The ring flares out on a dash.
    ring.current?.scale.setScalar(1 + 0.7 * (d.left / DASH.seconds));

    // The spot a click on the floor is heading for.
    if (target.current) {
      const goal = useFounder.getState().goal;
      target.current.visible = !!goal && !("station" in goal);
      if (goal && !("station" in goal)) target.current.position.set(goal.x, 0.03, goal.z);
    }

    // Only a change of what the founder is doing needs React; moving does not.
    const doing: Activity = moved ? "walk" : working ? "work" : "idle";
    if (doing !== shown.current) {
      shown.current = doing;
      setActivity(doing);
    }

    if (bubbleEl) {
      v.set(pose.x, BUBBLE_Y, pose.z).project(camera);
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      bubbleEl.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      bubbleEl.style.visibility = "visible";
    }
  });

  const onFloor = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    e.stopPropagation();
    const s = useGame.getState();
    if (s.game.phase !== "incident") s.select(null);
    if (controllable(s)) useFounder.getState().walkTo({ x: e.point.x, z: e.point.z });
  };

  return (
    <>
      <group ref={body}>
        {/* Scaled up, its stride is longer, so the walk plays slower to keep its feet from sliding. */}
        <group scale={SCALE}>
          <Creature species="mushnubKing" activity={activity} position={[0, 0, 0]} pace={SPEED / SCALE} />
        </group>
        <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
          <ringGeometry args={[0.36, 0.46, 40]} />
          <meshBasicMaterial color={MARK} transparent opacity={0.9} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      <ZoneOutline />
      <mesh ref={target} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.16, 0.24, 32]} />
        <meshBasicMaterial color={MARK} transparent opacity={0.75} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* The whole floor catches clicks; machines sit above it and catch theirs first. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[ROOM.cx, 0.004, ROOM.cz]} onClick={onFloor}>
        <planeGeometry args={[ROOM.w, ROOM.d]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </>
  );
}

/** The square the founder can work a machine from, drawn on the floor while it stands in it. */
function ZoneOutline() {
  const near = useFounder((f) => f.near);
  const key = useGame((s) => (near ? JSON.stringify(zone(s.game, near)) : null));
  const points = useMemo<[number, number, number][] | null>(() => {
    if (!key) return null;
    const z = JSON.parse(key) as ReturnType<typeof zone>;
    const y = 0.03;
    return [
      [z.x0, y, z.z0],
      [z.x1, y, z.z0],
      [z.x1, y, z.z1],
      [z.x0, y, z.z1],
      [z.x0, y, z.z0],
    ];
  }, [key]);
  if (!points) return null;
  return <Line points={points} color={MARK} lineWidth={2} dashed dashSize={0.3} gapSize={0.18} transparent opacity={0.85} />;
}

/**
 * What the founder is up to, over its head: the job it is walking to or
 * working, the investigation in progress, or the machine it can work from
 * where it stands (pressing the bubble, or Space, opens it).
 */
export function FounderBubble() {
  const job = useFounder((s) => s.job);
  const near = useFounder((s) => s.near);
  const inspecting = useGame((s) => s.game.incident?.inspecting ?? null);
  const name = useGame((s) => (near ? equipmentInfo(s.game, near).name : null));
  const open = useGame((s) => !!near && s.selected === near);
  const bind = (el: HTMLElement | null) => {
    bubbleEl = el;
  };

  let content: ReactNode = null;
  if (job) {
    const progress = job.total > 0 ? job.done / job.total : 0;
    content = (
      <div className="founder-bubble" ref={bind} role="status" data-state={progress > 0 ? "working" : "walking"}>
        <span className="founder-bubble-icon" aria-hidden="true">
          <Icon name={EQUIPMENT_ICON[job.station]} size={16} />
        </span>
        <span>{job.label}</span>
        {progress > 0 && <Bar value={progress} />}
      </div>
    );
  } else if (inspecting && inspecting.equipment === near) {
    content = (
      <div className="founder-bubble" ref={bind} role="status" data-state="working">
        <span className="founder-bubble-icon" aria-hidden="true">
          <Icon name="search" size={16} />
        </span>
        <span>Investigating</span>
        <Bar value={1 - inspecting.remaining / inspecting.total} />
      </div>
    );
  } else if (near && name) {
    content = (
      <button type="button" className="founder-bubble is-prompt" ref={bind} aria-pressed={open} onClick={() => interact(near)}>
        <kbd>Space</kbd>
        <span>{name}</span>
      </button>
    );
  }
  return <div className="eq-labels founder-layer">{content}</div>;
}

function Bar({ value }: { value: number }) {
  return (
    <span className="founder-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <span style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </span>
  );
}
