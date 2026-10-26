"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { MapControls as MapControlsImpl } from "three-stdlib";
import { useGame } from "@/game/store";
import { fromAvatar, type Viewpoint } from "@/game/viewpoints";
import { SHAFT } from "./floorplan";
import { ROOM } from "./layout";
import { CABIN, CABIN_WALLS, inCabin } from "./lift";
import { FLOOR_Y } from "./levels";
import { now, riding, viewHeight } from "./ride";
import { avatar, busyProgress, held, napBlend, TURN_KEYS } from "./walk";
import { eyeNudge, lookLocked, nap, scriptedPose } from "./funScript";
import {
  blendPose,
  dimAt,
  FIRST,
  firstPose,
  FOLLOW,
  followPose,
  headingFromOffset,
  LOOK_PER_PIXEL,
  MOUSE_LOOK_PER_PIXEL,
  POINT,
  pointTurn,
  overviewOffset,
  VIEW_EASE,
  type Pose,
  type Wall,
} from "./views";
import { wallUp, type WallId } from "./wallState";
import { cameras, lookApi, mouse, resetRig, rig, setEyelids, setViewFade, viewNow } from "./viewState";
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

/** Lock the pointer to the room, or say so if the browser will not, as an embedded browser may not. */
function lockPointer(el: HTMLElement, refused: () => void): void {
  if (!el.requestPointerLock) return refused();
  try {
    const p = el.requestPointerLock() as unknown;
    if (p && typeof (p as Promise<void>).catch === "function") (p as Promise<void>).catch(refused);
  } catch {
    refused();
  }
}

/** How long to wait for the pointer to lock before taking the browser's silence as a no. */
const LOCK_WAIT_MS = 1500;

/** Tell the page the pointer's state changed: locked, given back, or never to be had here. */
const lockNews = () => window.dispatchEvent(new Event("nn:look-lock"));

/**
 * What asks for the cursor when it opens over the room. An inspection's reading is the room answering a click, so
 * looking round carries on through it, and the next click puts it away.
 */
const DIALOG = '[role="dialog"]:not(.inspection-reveal), [role="alertdialog"]';

function letGoOfPointer(): void {
  if (document.pointerLockElement) document.exitPointerLock?.();
}

/** The floor the avatar's feet are on, riding included. */
const footing = () => (riding() ? viewHeight() : FLOOR_Y[avatar.floor] + avatar.lift);

/**
 * What the follow view keeps within: with the avatar in the elevator's car, the car's walls and under its ceiling,
 * so it never looks in through the roof; otherwise the room, clear of the shaft.
 */
const followWithin = (): [readonly Wall[], number, number] => (inCabin(avatar.x, avatar.z) ? [CABIN_WALLS, FOLLOW.fov, CABIN.h] : [SHAFT, FOLLOW.fov, ROOM.wallH]);

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

/** Tell the page which camera draws, for the browser tests and anything styled by it. */
function markCamera(canvas: HTMLCanvasElement, perspective: boolean): void {
  canvas.closest(".stage-canvas")?.setAttribute("data-camera", perspective ? "perspective" : "overview");
}

/** Turning: Q and E swing, through the eyes the left and right arrows turn, and pointing turns where nothing locks. */
function turnFor(dt: number, instant: boolean): void {
  const { lookSpeed, invertY } = useGame.getState().controls;
  const spin = viewNow.spin;
  if (Math.abs(spin) > 1e-4) {
    const step = instant || Math.abs(spin) < 0.004 ? spin : spin * Math.min(1, dt * 10);
    viewNow.heading += step;
    viewNow.spin -= step;
  }
  if (viewNow.want === "first") viewNow.heading += ((held.has(TURN_KEYS.left) ? 1 : 0) - (held.has(TURN_KEYS.right) ? 1 : 0)) * FIRST.turnRate * lookSpeed * dt;
  // Where the pointer cannot be locked, the view turns towards where the mouse points, unless the room is dragged.
  const p = viewNow.pointing;
  if (fromAvatar(viewNow.want) && viewNow.lockRefused && !viewNow.locked && !viewNow.dragging && p) {
    viewNow.heading -= pointTurn(p.x) * POINT.yaw * lookSpeed * dt;
    tilt(pointTurn(invertY ? -p.y : p.y) * POINT.pitch * lookSpeed * dt);
  }
}

/** Look further down by `by` radians, or up for less than nothing: the eyes in first person, the camera's height in follow. */
function tilt(by: number): void {
  if (viewNow.want === "first") viewNow.eyesPitch = THREE.MathUtils.clamp(viewNow.eyesPitch + by, -FIRST.pitch, FIRST.pitch);
  else viewNow.pitch = THREE.MathUtils.clamp(viewNow.pitch + by, FOLLOW.lowest, FOLLOW.highest);
}

export function ViewRig() {
  const set = useThree((s) => s.set);
  const get = useThree((s) => s.get);
  const gl = useThree((s) => s.gl);
  const fov = useGame((s) => s.graphics.fov);
  /** How far the view has glid toward a scripted pose, easing 0.6 s each way, which prop it glid to, and how shut the eyelids were. */
  const scriptGlide = useRef(0);
  const scriptedProp = useRef<string | null>(null);
  const eyelidsWere = useRef(0);

  // A new room starts from the overview, keeping its canvas's own camera for it, and hands that camera back, and the
  // pointer, when it goes. The page is told so: a canvas replaced mid-view must not leave the old canvas's camera named.
  useEffect(() => {
    const own = get().camera as THREE.OrthographicCamera;
    if (own.isOrthographicCamera) cameras.overview = own;
    resetRig();
    markCamera(gl.domElement, false);
    return () => {
      letGoOfPointer();
      if (cameras.overview) set({ camera: cameras.overview });
      resetRig();
      setViewFade(0);
      markCamera(gl.domElement, false);
    };
  }, [set, get, gl]);

  // Looking round: drag on the room, or in first person with a mouse, simply move it. First person takes the mouse
  // as it opens, as a game would; Escape gives the cursor back without ending walk mode, and a click on the room
  // takes the mouse again, that click doing nothing else.
  useEffect(() => {
    const canvas = gl.domElement;
    const host = canvas.parentElement ?? canvas;
    let drag: { id: number; x: number; y: number; moved: boolean } | null = null;
    let unlockedAt = -Infinity;
    const covered = () => !!document.querySelector(".modal-backdrop:not(:has(> .inspection-reveal)), .company-message-backdrop");
    const looking = () => viewNow.want !== "overview" && viewNow.perspective && !covered();
    const turn = (dx: number, dy: number) => {
      const { lookSpeed, invertY } = useGame.getState().controls;
      const k = (viewNow.locked ? MOUSE_LOOK_PER_PIXEL : LOOK_PER_PIXEL) * lookSpeed;
      viewNow.heading -= dx * k;
      tilt((invertY ? -dy : dy) * k);
    };
    // A browser that will not lock the pointer, as an embedded one may not, looks round by pointing instead.
    const refuse = () => {
      if (viewNow.lockRefused) return;
      viewNow.lockRefused = true;
      lockNews();
    };
    // Some browsers neither lock nor say no: no lock soon after asking counts as no, until a lock does arrive.
    let waiting = 0;
    const tryLock = () => {
      lockPointer(canvas, refuse);
      window.clearTimeout(waiting);
      waiting = window.setTimeout(() => {
        if (document.pointerLockElement !== canvas) refuse();
      }, LOCK_WAIT_MS);
    };
    mouse.take = () => {
      if (finePointer()) tryLock();
    };
    // Choosing a view from the avatar, by V or the View mode menu, takes the mouse there and then, while the key or
    // click that chose it still lets the page lock the pointer. Going from one such view to the other keeps it.
    const stopTaking = useGame.subscribe((s, prev) => {
      const now = s.started && s.walking && fromAvatar(s.viewpoint);
      const was = prev.started && prev.walking && fromAvatar(prev.viewpoint);
      if (now && !was) mouse.take();
    });
    const down = (e: PointerEvent) => {
      if (!looking() || viewNow.locked || (e.pointerType === "mouse" && e.button !== 0)) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    };
    // Where the mouse is over the room, for looking round by pointing.
    const point = (e: PointerEvent) => {
      if (covered()) { viewNow.pointing=null;return; }
      if (e.pointerType !== "mouse" || viewNow.locked) return;
      const r = canvas.getBoundingClientRect();
      viewNow.pointing = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1 };
    };
    const away = () => {
      viewNow.pointing = null;
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
      viewNow.dragging = true;
      drag.x = e.clientX;
      drag.y = e.clientY;
      turn(dx, dy);
    };
    const up = (e: PointerEvent) => {
      if (drag?.id !== e.pointerId) return;
      drag = null;
      viewNow.dragging = false;
    };
    const click = (e: MouseEvent) => {
      // With the mouse taken, the reading an inspection opened cannot be clicked, so a click puts it away, and only that.
      const s = useGame.getState();
      if (viewNow.locked && s.roomInspection) {
        e.stopPropagation();
        s.dismissRoomInspection();
        return;
      }
      // Behind the avatar with the mouse taken there is no dot to aim with, so a click does nothing.
      if (viewNow.locked && viewNow.want === "follow") {
        e.stopPropagation();
        return;
      }
      // A view from the avatar is asked for, even while it is still easing in: the click is for the mouse, not the
      // room. Where the pointer cannot be locked, a click walks and picks as everywhere else.
      if (!fromAvatar(viewNow.want) || viewNow.locked || viewNow.lockRefused || !finePointer()) return;
      // The click that takes the pointer is only that: it neither walks nor picks anything.
      e.stopPropagation();
      tryLock();
    };
    const wheel = (e: WheelEvent) => {
      if (viewNow.want !== "follow" || !viewNow.perspective) return;
      e.preventDefault();
      lookApi.dolly(Math.exp(-e.deltaY * 0.0015));
    };
    const lockChanged = () => {
      const locked = document.pointerLockElement === canvas;
      if (viewNow.locked && !locked) {
        unlockedAt = performance.now();
        const state = useGame.getState();
        if (state.roomInspection && !document.querySelector(".component-inspection")) {
          state.dismissRoomInspection();
          viewNow.quietPause = true;
        }
      }
      viewNow.locked = locked;
      if (locked) {
        // The browser said yes: whatever happens to the lock later, it was not refused.
        window.clearTimeout(waiting);
        viewNow.lockRefused = false;
        viewNow.quietPause = false;
      }
      lockNews();
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // The interactive Campaign dialog owns Escape, including during pointer release.
      if (document.querySelector(".component-inspection")) return;
      const state = useGame.getState();
      // The workspace owns Escape even when opening it released the mouse from walk mode.
      if (state.view === "tech" || state.view === "history") return;
      if (state.roomInspection) {
        e.stopImmediatePropagation();
        state.dismissRoomInspection();
        if (document.pointerLockElement === canvas || viewNow.locked) {
          viewNow.quietPause = true;
          lockNews();
          letGoOfPointer();
        }
        return;
      }
      if (viewNow.quietPause) {
        e.stopImmediatePropagation();
        if (performance.now() - unlockedAt < 250) return;
        viewNow.quietPause = false;
        lockNews();
        return;
      }
      // Escape lets go of the pointer, and that is all it does.
      if (document.pointerLockElement === canvas || performance.now() - unlockedAt < 250) {
        e.stopImmediatePropagation();
        letGoOfPointer();
      }
    };
    const keys = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const view = useGame.getState().view;
      if (view === "tech" || view === "history") return;
      if (!looking() || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable || el.closest('[role="dialog"], [role="menu"], [role="listbox"]'))) return;
      // As in the overview, where Q swings the camera round to the right and E to the left.
      if (e.key === "q" || e.key === "Q") lookApi.swing(-SWING);
      else if (e.key === "e" || e.key === "E") lookApi.swing(SWING);
    };
    // A dialog or a guide's card opening over the room needs the cursor, so the mouse is let go to reach it.
    const dialogs = new MutationObserver((records) => {
      for (const r of records)
        for (const n of r.addedNodes)
          if (n instanceof Element && (n.matches(DIALOG) || n.querySelector(DIALOG))) {
            if (covered()) { drag=null;viewNow.dragging=false;viewNow.pointing=null; }
            if (viewNow.locked) letGoOfPointer();
            return;
          }
    });
    dialogs.observe(document.body, { childList: true, subtree: true });
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", point);
    canvas.addEventListener("pointerleave", away);
    document.addEventListener("pointerlockerror", refuse);
    window.addEventListener("pointermove", moveBy);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    host.addEventListener("click", click, { capture: true });
    canvas.addEventListener("wheel", wheel, { passive: false });
    document.addEventListener("pointerlockchange", lockChanged);
    window.addEventListener("keydown", escape, { capture: true });
    window.addEventListener("keydown", keys);
    return () => {
      stopTaking();
      dialogs.disconnect();
      mouse.take = () => {};
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", point);
      canvas.removeEventListener("pointerleave", away);
      document.removeEventListener("pointerlockerror", refuse);
      window.clearTimeout(waiting);
      viewNow.pointing = null;
      viewNow.dragging = false;
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
      if (want === "overview") {
        if (viewNow.quietPause) {
          viewNow.quietPause = false;
          lockNews();
        }
        letGoOfPointer();
      }
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
      markCamera(state.gl.domElement, wantPerspective);
      const overview = cameras.overview;
      if (wantPerspective) set({ camera: cameras.perspective });
      else if (overview) {
        fitOrthographic(overview, state.size);
        set({ camera: overview });
      }
    }
    if (!wantPerspective) {
      viewNow.inHead = false;
      scriptGlide.current = 0;
      scriptedProp.current = null;
      setEyelids(0, "open");
      eyelidsWere.current = 0;
      return;
    }
    // Busy with a thing that frames itself in this view — the nap or the arcade anywhere, a held thing in follow — looking round is frozen.
    const lookingLocked = avatar.busy !== null && lookLocked(avatar.busy.prop, showing === "first" ? "first" : "follow");
    if (!lookingLocked) turnFor(dt, instant);

    // Where the camera goes: dimming away from a view, it holds still; otherwise it is where the view puts it.
    let pose: Pose;
    if (m && crossing && !m.cut && rig.drawn) pose = rig.drawn;
    else {
      const y = footing();
      rig.lastSeen = { x: avatar.x, y, z: avatar.z };
      const busyF = avatar.busy ? (busyProgress(t) ?? 0) : 0;
      const nudge = showing === "first" && avatar.busy && !instant ? eyeNudge(avatar.busy.prop, busyF) : 0;
      const live =
        showing === "first"
          ? firstPose(avatar.x, y, avatar.z, viewNow.heading, viewNow.eyesPitch + nudge, fov)
          : trail(followPose(avatar.x, y, avatar.z, viewNow.heading, viewNow.pitch, viewNow.distance, ...followWithin()), dt, instant);
      pose = m && !crossing && m.pose ? blendPose(m.pose, live, instant ? 1 : (t - m.at) / VIEW_EASE) : live;
      // A fun thing that frames the view: into the pod while napping, up to the cabinet's screen while playing,
      // round the avatar's side while it sips, bites or gulps.
      const view = showing === "first" ? "first" : "follow";
      let scripted: Pose | null = null;
      let weight = 0;
      if (avatar.busy) {
        scripted = scriptedPose(avatar.busy.prop, busyF, view, y);
        if (avatar.busy.prop === "nap") weight = napBlend.value;
        else if (scripted) {
          scriptGlide.current = instant ? 1 : Math.min(1, scriptGlide.current + dt / 0.6);
          weight = scriptGlide.current;
          scriptedProp.current = avatar.busy.prop;
        }
      } else {
        if (napBlend.value > 0.001) {
          scripted = scriptedPose("nap", 0, view, y);
          weight = napBlend.value;
        }
        scriptGlide.current = instant ? 0 : Math.max(0, scriptGlide.current - dt / 0.6);
        if (scriptGlide.current > 0 && scriptedProp.current) {
          scripted = scripted ?? scriptedPose(scriptedProp.current, 0, view, y);
          weight = Math.max(weight, scriptGlide.current);
        }
      }
      if (scripted && weight > 0) pose = blendPose(pose, scripted, weight);
      if (showing === "first") rig.trailing = null;
    }
    // The nap's eyelids over first person: as shut as the sleeper's eyes, or the dark under the hood.
    const shut = showing === "first" && avatar.busy?.prop === "nap" ? nap(busyProgress(t) ?? 0).eyes : 0;
    const was = eyelidsWere.current;
    setEyelids(shut, shut < 0.05 ? "open" : shut > 0.95 ? "shut" : shut > was ? "closing" : shut < was ? "opening" : "shut");
    eyelidsWere.current = shut;
    rig.drawn = pose;
    viewNow.inHead = showing === "first" && (!m || crossing || (t - m.at) / VIEW_EASE > 0.6);
    aim(cameras.perspective, pose, state.size);
    raiseWalls();
  });

  return null;
}
