import type { Floor } from "./floors";
import type { GameMode } from "./persist";
import { isViewpoint, type Viewpoint } from "./viewpoints";

/*
 * Where the player last stood and looked, per mode: the floor in view, whether walk mode was on and from which
 * view, the avatar's spot and the overview camera's target, angle and zoom. This is browser-local convenience, not progress: it is kept out
 * of the save envelopes entirely, so a corrupt or missing record costs nothing but a return to the default view.
 */

export interface SavedAvatarPosition {
  floor: Floor;
  x: number;
  z: number;
  yaw: number;
}

export interface SavedCameraView {
  /** The point on the floor the camera looks at; its height comes from the floor in view, so it is not stored. */
  target: { x: number; z: number };
  /** The camera's position relative to its target: the angle and tilt of the view. */
  offset: { x: number; y: number; z: number };
  zoom: number;
}

export interface ExplorationState {
  version: 1;
  floor: Floor;
  walking: boolean;
  /** The view walk mode was seen from; records from before there was a choice have none, and mean the overview. */
  viewpoint: Viewpoint;
  /**
   * The player has chosen how to see the room: a view, or walk mode on or off. Until then a run opens in first
   * person. Records from before there was a default have none: one left walking was the player's choice, any other
   * not yet.
   */
  viewChosen: boolean;
  avatar: SavedAvatarPosition | null;
  camera: SavedCameraView | null;
}

const KEYS: Record<GameMode, string> = {
  campaign: "nn.campaign.exploration.v1",
  classic: "nn.classic.exploration.v1",
};

const DEFAULTS: ExplorationState = { version: 1, floor: "servers", walking: false, viewpoint: "overview", viewChosen: false, avatar: null, camera: null };

/** Bounds a stored number can be trusted inside: the building spans a few tens of metres, the camera's stand-off a few hundred. */
const NEAR = 100;
const FAR = 1000;
const ZOOM = { min: 10, max: 140 };

/** The latest valid state of each mode this visit, so a storage failure mid-session does not lose the player's place. */
const remembered = new Map<GameMode, ExplorationState>();
/** Modes whose remembered state never reached storage: memory is then ahead of the store and stays authoritative. */
const unstored = new Set<GameMode>();

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const near = (v: unknown): v is number => finite(v) && Math.abs(v) <= NEAR;
const far = (v: unknown): v is number => finite(v) && Math.abs(v) <= FAR;
const isFloor = (v: unknown): v is Floor => v === "office" || v === "servers";

function avatarOf(v: unknown): SavedAvatarPosition | null {
  if (!v || typeof v !== "object") return null;
  const a = v as Partial<SavedAvatarPosition>;
  if (!isFloor(a.floor) || !near(a.x) || !near(a.z) || !finite(a.yaw)) return null;
  return { floor: a.floor, x: a.x, z: a.z, yaw: a.yaw };
}

function cameraOf(v: unknown): SavedCameraView | null {
  if (!v || typeof v !== "object") return null;
  const c = v as Partial<SavedCameraView>;
  const t = c.target, o = c.offset;
  if (!t || typeof t !== "object" || !o || typeof o !== "object") return null;
  const target = t as { x?: unknown; z?: unknown };
  const offset = o as { x?: unknown; y?: unknown; z?: unknown };
  if (!near(target.x) || !near(target.z)) return null;
  if (!far(offset.x) || !far(offset.y) || !far(offset.z)) return null;
  const length = Math.hypot(offset.x, offset.y, offset.z);
  if (length < 1 || length > FAR) return null;
  if (!finite(c.zoom) || c.zoom < ZOOM.min || c.zoom > ZOOM.max) return null;
  return {
    target: { x: target.x, z: target.z },
    offset: { x: offset.x, y: offset.y, z: offset.z },
    zoom: c.zoom,
  };
}

function parse(raw: string): ExplorationState | null {
  try {
    const s = JSON.parse(raw) as Partial<ExplorationState> | null;
    if (!s || typeof s !== "object" || s.version !== 1) return null;
    return {
      version: 1,
      floor: isFloor(s.floor) ? s.floor : DEFAULTS.floor,
      walking: typeof s.walking === "boolean" ? s.walking : DEFAULTS.walking,
      viewpoint: isViewpoint(s.viewpoint) ? s.viewpoint : DEFAULTS.viewpoint,
      viewChosen: typeof s.viewChosen === "boolean" ? s.viewChosen : s.walking === true,
      avatar: avatarOf(s.avatar),
      camera: cameraOf(s.camera),
    };
  } catch {
    return null;
  }
}

/** A copy callers can mutate freely: the records kept in memory and storage stay untouched. */
function copyOf(s: ExplorationState): ExplorationState {
  return {
    version: 1,
    floor: s.floor,
    walking: s.walking,
    viewpoint: s.viewpoint,
    viewChosen: s.viewChosen,
    avatar: s.avatar ? { ...s.avatar } : null,
    camera: s.camera ? { target: { ...s.camera.target }, offset: { ...s.camera.offset }, zoom: s.camera.zoom } : null,
  };
}

/**
 * The mode's remembered exploration state, or the defaults when none was stored, the record is unreadable, or
 * storage is unavailable. A successfully read `null` or corrupt record clears this visit's memory too, so a
 * cleared store is honoured - unless the memory is ahead of storage because a write just failed, in which case
 * it still applies for the rest of this visit. A read that throws keeps what memory already holds.
 */
export function loadExploration(mode: GameMode): ExplorationState {
  // A write that never reached storage keeps memory ahead of the store: whatever is on disk is stale until a
  // later save lands, so do not read it at all.
  if (unstored.has(mode)) {
    const kept = remembered.get(mode);
    if (kept) return copyOf(kept);
    unstored.delete(mode);
  }
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(KEYS[mode]);
  } catch {
    return copyOf(remembered.get(mode) ?? DEFAULTS);
  }
  if (raw === null) {
    if (!unstored.has(mode)) remembered.delete(mode);
    return copyOf(remembered.get(mode) ?? DEFAULTS);
  }
  const parsed = parse(raw);
  if (parsed === null) {
    remembered.delete(mode);
    unstored.delete(mode);
    return copyOf(DEFAULTS);
  }
  remembered.set(mode, parsed);
  unstored.delete(mode);
  return copyOf(parsed);
}

/**
 * Merge `patch` into the mode's current state and store it. The merged state is kept in memory either way, so a
 * failed write still applies for the rest of the visit; the return says whether it also reached storage.
 */
export function saveExploration(mode: GameMode, patch: Partial<Omit<ExplorationState, "version">>): boolean {
  const base = remembered.get(mode) ?? loadExploration(mode);
  const next: ExplorationState = {
    version: 1,
    floor: patch.floor === undefined ? base.floor : isFloor(patch.floor) ? patch.floor : base.floor,
    walking: patch.walking === undefined ? base.walking : typeof patch.walking === "boolean" ? patch.walking : base.walking,
    viewpoint: patch.viewpoint === undefined ? base.viewpoint : isViewpoint(patch.viewpoint) ? patch.viewpoint : base.viewpoint,
    viewChosen: patch.viewChosen === undefined ? base.viewChosen : typeof patch.viewChosen === "boolean" ? patch.viewChosen : base.viewChosen,
    avatar: patch.avatar === undefined ? base.avatar : avatarOf(patch.avatar),
    camera: patch.camera === undefined ? base.camera : cameraOf(patch.camera),
  };
  remembered.set(mode, next);
  try {
    window.localStorage.setItem(KEYS[mode], JSON.stringify(next));
    unstored.delete(mode);
    return true;
  } catch {
    unstored.add(mode);
    return false;
  }
}
