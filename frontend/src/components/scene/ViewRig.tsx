"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";
import type { MapControls as MapControlsImpl } from "three-stdlib";
import { useGame } from "@/game/store";
import type { Viewpoint } from "@/game/viewpoints";
import { SHAFT } from "./floorplan";
import { FLOOR_Y } from "./levels";
import { now, riding, viewHeight } from "./ride";
import { avatar, held, TURN_KEYS } from "./walk";
import {
  blendPose,
  dimAt,
  FIRST,
  firstPose,
  FOLLOW,
  followPose,
  headingFromOffset,
  LOOK_PER_PIXEL,
  overviewOffset,
  VIEW_EASE,
  type Pose,
} from "./views";
import { wallUp, type WallId } from "./wallState";
import { cameras, lookApi, resetRig, rig, setViewFade, viewNow } from "./viewState";
import { sceneSound } from "./sceneSounds";

/*
 * The views from the avatar (see views.ts): a perspective camera that follows a few metres behind it or looks through
 * its eyes, and the moves between those and the overview. The canvas's own orthographic camera stays the overview's,
 * kept by CameraRig; this one takes over drawing while a view from the avatar is on, and hands it back after.
 */

/** Q, E and the rotate buttons swing the view by an eighth of a circle, as in the overview. */
const SWING = Math.PI / 4;
/** How loud the whoosh of a change of view is, as a share of the effects volume. */
const WHOOSH = 0.5;

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
/** A mouse or trackpad, where clicking the room in first person takes the pointer for looking round. */
const finePointer = () => window.matchMedia?.("(pointer: fine)").matches ?? false;

/** Lock the pointer to the room, quietly giving up where the browser will not. */
function lockPointer(el: HTMLElement): void {
  try {
    const p = el.requestPointerLock?.() as unknown;
    if (p && typeof (p as Promise<void>).catch === "function") (p as Promise<void>).catch(() => {});
  } catch {
    /* not allowed here: drag to look instead */
  }
}

function letGoOfPointer(): void {
  if (document.pointerLockElement) document.exitPointerLock?.();
}

/** The floor the avatar's feet are on, riding included. */
const footing = () => (riding() ? viewHeight() : FLOOR_Y[avatar.floor]);

const ALL_WALLS: WallId[] = ["back", "left", "front", "right"];

/** The camera follows the avatar from inside the room and under the walls' tops, so all four walls stand. */
function raiseWalls(): void {
  for (const id of ALL_WALLS) wallUp[id] = true;
}

/** The follow view catching up with where it should be, loosely. */
function trail(target: Pose, dt: number, instant: boolean): Pose {
  const was = rig.trailing;
  const next = !was || instant ? target : blendLinear(was, target, 1 - Math.exp(-dt / FOLLOW.lag));
  rig.trailing = next;
  return next;
}

/** Straight-line part way between two poses, for catching up. */
function blendLinear(a: Pose, b: Pose, k: number): Pose {
  const mix = (u: number, v: number) => u + (v - u) * k;
  return { x: mix(a.x, b.x), y: mix(a.y, b.y), z: mix(a.z, b.z), lx: mix(a.lx, b.lx), ly: mix(a.ly, b.ly), lz: mix(a.lz, b.lz), fov: b.fov };
}

/** Back to the overview: centred on where the avatar was, facing the way the view from it did. */
function pickUpOverview(controls: MapControlsImpl | null): void {
  const o = cameras.overview;
  if (!o || !controls) return;
  const off = new THREE.Vector3().subVectors(o.position, controls.target);
  const distance = off.length();
  const polar = Math.acos(THREE.MathUtils.clamp(off.y / Math.max(distance, 1e-6), -1, 1));
  const [ox, oy, oz] = overviewOffset(viewNow.heading, polar, distance);
  const at = rig.lastSeen;
  controls.target.set(at.x, at.y, at.z);
  o.position.set(at.x + ox, at.y + oy, at.z + oz);
  o.lookAt(controls.target);
  controls.update();
}

/** The canvas resizes only the camera drawing, so the overview's is brought up to date as it takes over again. */
function fitOrthographic(camera: THREE.OrthographicCamera, size: { width: number; height: number }): void {
  camera.left = size.width / -2;
  camera.right = size.width / 2;
  camera.top = size.height / 2;
  camera.bottom = size.height / -2;
  camera.updateProjectionMatrix();
}

/** Point the perspective camera along a pose, fitted to the canvas. */
function aim(camera: THREE.PerspectiveCamera, pose: Pose, size: { width: number; height: number }): void {
  camera.position.set(pose.x, pose.y, pose.z);
  camera.lookAt(pose.lx, pose.ly, pose.lz);
  const aspect = size.width / Math.max(1, size.height);
  if (camera.aspect !== aspect || camera.fov !== pose.fov) {
    camera.aspect = aspect;
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
  }
}

/** Turning: Q and E swing, and through the eyes the left and right arrows turn. */
function turnFor(dt: number, instant: boolean): void {
  const spin = viewNow.spin;
  if (Math.abs(spin) > 1e-4) {
    const step = instant || Math.abs(spin) < 0.004 ? spin : spin * Math.min(1, dt * 10);
    viewNow.heading += step;
    viewNow.spin -= step;
  }
  if (viewNow.want === "first") viewNow.heading += ((held.has(TURN_KEYS.left) ? 1 : 0) - (held.has(TURN_KEYS.right) ? 1 : 0)) * FIRST.turnRate * dt;
}

export function ViewRig() {
  const set = useThree((s) => s.set);
  const get = useThree((s) => s.get);
  const gl = useThree((s) => s.gl);
  const fov = useGame((s) => s.graphics.fov);

  // A new room starts from the overview, keeping its canvas's own camera for it, and hands that camera back, and the
  // pointer, when it goes.
  useEffect(() => {
    const own = get().camera as THREE.OrthographicCamera;
    if (own.isOrthographicCamera) cameras.overview = own;
    resetRig();
    return () => {
      letGoOfPointer();
      if (cameras.overview) set({ camera: cameras.overview });
      resetRig();
      setViewFade(0);
    };
  }, [set, get]);

  // Looking round: drag on the room, or with the pointer locked, move the mouse. A click in first person takes the
  // pointer, and that click does nothing else; Escape lets go without ending walk mode.
  useEffect(() => {
    const canvas = gl.domElement;
    const host = canvas.parentElement ?? canvas;
    let drag: { id: number; x: number; y: number; moved: boolean } | null = null;
    let unlockedAt = -Infinity;
    const looking = () => viewNow.want !== "overview" && viewNow.perspective;
    const turn = (dx: number, dy: number) => {
      viewNow.heading -= dx * LOOK_PER_PIXEL;
      if (viewNow.want === "first") viewNow.eyesPitch = THREE.MathUtils.clamp(viewNow.eyesPitch + dy * LOOK_PER_PIXEL, -FIRST.pitch, FIRST.pitch);
      else viewNow.pitch = THREE.MathUtils.clamp(viewNow.pitch + dy * LOOK_PER_PIXEL, FOLLOW.lowest, FOLLOW.highest);
    };
    const down = (e: PointerEvent) => {
      if (!looking() || viewNow.locked || (e.pointerType === "mouse" && e.button !== 0)) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    };
    const moveBy = (e: PointerEvent) => {
      if (viewNow.locked) {
        if (looking()) turn(e.movementX, e.movementY);
        return;
      }
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 6) return;
      drag.moved = true;
      drag.x = e.clientX;
      drag.y = e.clientY;
      turn(dx, dy);
    };
    const up = (e: PointerEvent) => {
      if (drag?.id === e.pointerId) drag = null;
    };
    const click = (e: MouseEvent) => {
      if (viewNow.want !== "first" || !viewNow.perspective || viewNow.locked || !finePointer()) return;
      // The click that takes the pointer is only that: it neither walks nor picks anything.
      e.stopPropagation();
      lockPointer(canvas);
    };
    const wheel = (e: WheelEvent) => {
      if (viewNow.want !== "follow" || !viewNow.perspective) return;
      e.preventDefault();
      lookApi.dolly(Math.exp(-e.deltaY * 0.0015));
    };
    const lockChanged = () => {
      const locked = document.pointerLockElement === canvas;
      if (viewNow.locked && !locked) unlockedAt = performance.now();
      viewNow.locked = locked;
      window.dispatchEvent(new Event("nn:look-lock"));
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Escape lets go of the pointer, and that is all it does.
      if (document.pointerLockElement === canvas || performance.now() - unlockedAt < 250) {
        e.stopImmediatePropagation();
        letGoOfPointer();
      }
    };
    const keys = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (!looking() || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable || el.closest('[role="dialog"], [role="menu"], [role="listbox"]'))) return;
      // As in the overview, where Q swings the camera round to the right and E to the left.
      if (e.key === "q" || e.key === "Q") lookApi.swing(-SWING);
      else if (e.key === "e" || e.key === "E") lookApi.swing(SWING);
    };
    canvas.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", moveBy);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    host.addEventListener("click", click, { capture: true });
    canvas.addEventListener("wheel", wheel, { passive: false });
    document.addEventListener("pointerlockchange", lockChanged);
    window.addEventListener("keydown", escape, { capture: true });
    window.addEventListener("keydown", keys);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", moveBy);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      host.removeEventListener("click", click, { capture: true });
      canvas.removeEventListener("wheel", wheel);
      document.removeEventListener("pointerlockchange", lockChanged);
      window.removeEventListener("keydown", escape, { capture: true });
      window.removeEventListener("keydown", keys);
      if (viewNow.locked) {
        viewNow.locked = false;
        window.dispatchEvent(new Event("nn:look-lock"));
      }
    };
  }, [gl]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const s = useGame.getState();
    const want: Viewpoint = s.started && s.walking ? s.viewpoint : "overview";
    const t = now();
    const controls = state.controls as unknown as MapControlsImpl | null;
    const goingTo = rig.move?.to ?? rig.settled;
    if (want !== goingTo) {
      const from = rig.move ? (viewNow.perspective ? goingTo : "overview") : rig.settled;
      if (from === "overview" && want !== "overview") {
        // Into a view from the avatar: it looks the way the overview did.
        const o = cameras.overview;
        if (o && controls) viewNow.heading = headingFromOffset(o.position.x - controls.target.x, o.position.z - controls.target.z);
        viewNow.pitch = FOLLOW.pitch;
        viewNow.eyesPitch = 0.12;
        rig.trailing = null;
      }
      if (want !== "first") letGoOfPointer();
      // The room was only just drawn: the view it opens in is not a change worth hearing.
      if (rig.started) sceneSound("whoosh", WHOOSH);
      rig.move = { from, to: want, at: t, pose: viewNow.perspective ? rig.drawn : null, cut: false };
      viewNow.want = want;
    }
    rig.started = true;

    const m = rig.move;
    const crossing = !!m && (m.from === "overview" || m.to === "overview");
    const instant = reducedMotion();
    let showing: Viewpoint = rig.settled;
    let dark = 0;
    if (m) {
      const since = instant ? VIEW_EASE : t - m.at;
      if (crossing) {
        const dim = dimAt(since);
        dark = dim.dark;
        showing = dim.cut ? m.to : m.from;
        if (dim.cut && !m.cut) {
          m.cut = true;
          if (m.to === "overview") pickUpOverview(controls);
        }
      } else showing = m.to;
      if (since >= VIEW_EASE) {
        rig.settled = m.to;
        rig.move = null;
      }
    }
    setViewFade(dark);

    // The camera drawing.
    const wantPerspective = showing !== "overview";
    if (wantPerspective !== viewNow.perspective) {
      viewNow.perspective = wantPerspective;
      // The page can tell which camera draws, for the browser tests and anything styled by it.
      state.gl.domElement.closest(".stage-canvas")?.setAttribute("data-camera", wantPerspective ? "perspective" : "overview");
      const overview = cameras.overview;
      if (wantPerspective) set({ camera: cameras.perspective });
      else if (overview) {
        fitOrthographic(overview, state.size);
        set({ camera: overview });
      }
    }
    if (!wantPerspective) {
      viewNow.inHead = false;
      return;
    }
    turnFor(dt, instant);

    // Where the camera goes: dimming away from a view, it holds still; otherwise it is where the view puts it.
    let pose: Pose;
    if (m && crossing && !m.cut && rig.drawn) pose = rig.drawn;
    else {
      const y = footing();
      rig.lastSeen = { x: avatar.x, y, z: avatar.z };
      const live =
        showing === "first"
          ? firstPose(avatar.x, y, avatar.z, viewNow.heading, viewNow.eyesPitch, fov)
          : trail(followPose(avatar.x, y, avatar.z, viewNow.heading, viewNow.pitch, viewNow.distance, SHAFT), dt, instant);
      pose = m && !crossing && m.pose ? blendPose(m.pose, live, instant ? 1 : (t - m.at) / VIEW_EASE) : live;
      if (showing === "first") rig.trailing = null;
    }
    rig.drawn = pose;
    viewNow.inHead = showing === "first" && (!m || crossing || (t - m.at) / VIEW_EASE > 0.6);
    aim(cameras.perspective, pose, state.size);
    raiseWalls();
  });

  return null;
}
