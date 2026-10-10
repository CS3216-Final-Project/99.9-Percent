import { create } from "zustand";
import type { Action, EquipmentId, GameState, RecoveryId } from "@/sim";

/*
 * The founder: the one character the player steers round the office in
 * Classic. Machine work is done in person. An action from a station's panel
 * becomes a job: the founder walks to that machine and works there for a
 * moment, and only then does the action reach the game. Walking away pauses
 * the work. Nothing here is saved; a reload puts the founder back at the door
 * with free hands, and since an action is only paid for when its work is
 * done, nothing is lost.
 *
 * This module holds the rules and the shared state. Where the founder stands
 * and how it moves live in components/scene (stations.ts, nav.ts, Founder.tsx).
 */

/** Which machine fixes each incident recovery. */
const RECOVERY_STATION: Record<RecoveryId, EquipmentId> = {
  scale_out: "app",
  replace_instance: "app",
  restart: "app",
  db_upgrade: "db",
  failover: "db",
  rollback: "deploy",
  rate_limit: "gateway",
};

/**
 * The machine an action is done at, or null for a decision made from a sheet
 * (research, staffing tasks, hints, the review) that happens at once.
 */
export function stationFor(action: Action, game: GameState): EquipmentId | null {
  switch (action.type) {
    case "add_server":
    case "remove_server":
      return "app";
    case "replace_host":
      return game.infra.dbHost.id === action.hostId ? "db" : "app";
    case "start_db_upgrade":
      return "db";
    case "set_traffic_limit":
      return "gateway";
    case "launch_promotion":
      return "growth";
    case "hire_engineer":
    case "start_debt_paydown":
      return "team";
    case "deploy_release":
    case "test_release":
      return "deploy";
    case "incident_inspect":
      return action.equipment;
    case "incident_action":
      return RECOVERY_STATION[action.recovery];
    case "start_tech":
    case "assign_engineers":
    case "cancel_task":
    case "incident_hint":
    case "acknowledge_review":
      return null;
  }
}

/** Seconds of work at the machine before an action lands. An inspection's work is the game's own investigation time. */
const WORK_SECONDS: Record<Action["type"], number> = {
  add_server: 2,
  remove_server: 1,
  replace_host: 2,
  start_db_upgrade: 2.5,
  set_traffic_limit: 1,
  launch_promotion: 1.5,
  hire_engineer: 1.5,
  start_debt_paydown: 1,
  deploy_release: 2,
  test_release: 1.5,
  incident_inspect: 0,
  incident_action: 1.5,
  start_tech: 0,
  assign_engineers: 0,
  cancel_task: 0,
  incident_hint: 0,
  acknowledge_review: 0,
};

/** What the founder is doing, in a few words, for the bubble over its head. */
export function jobLabel(action: Action): string {
  switch (action.type) {
    case "add_server":
      return "Adding a server";
    case "remove_server":
      return "Removing a server";
    case "replace_host":
      return "Replacing a machine";
    case "start_db_upgrade":
      return "Upgrading the database";
    case "set_traffic_limit":
      return action.enabled ? "Limiting traffic" : "Lifting the limit";
    case "launch_promotion":
      return "Launching a promotion";
    case "hire_engineer":
      return "Hiring";
    case "start_debt_paydown":
      return "Planning debt paydown";
    case "deploy_release":
      return "Deploying";
    case "test_release":
      return "Starting tests";
    case "incident_inspect":
      return "Investigating";
    case "incident_action":
      return "Applying the fix";
    default:
      return "Working";
  }
}

export interface Job {
  action: Action;
  station: EquipmentId;
  label: string;
  /** Seconds of work done so far. */
  done: number;
  total: number;
}

export function newJob(action: Action, station: EquipmentId): Job {
  return { action, station, label: jobLabel(action), done: 0, total: WORK_SECONDS[action.type] };
}

/**
 * One frame of a job. Work only adds up while the founder stands at the right
 * machine and the game's clock is live; the job is finished once the work is
 * complete, so an action with no work lands the moment the founder arrives.
 */
export function workOn(job: Job, at: { inReach: boolean; live: boolean; dt: number }): Job | "finished" {
  if (!at.inReach || !at.live) return job;
  const done = Math.min(job.total, job.done + Math.max(0, at.dt));
  return done >= job.total ? "finished" : { ...job, done };
}

/**
 * Whether the founder's time counts. Planning a week is untimed, so the founder
 * always moves then; during an incident the founder moves with the crisis clock,
 * and freezes with it.
 */
export function clockLive(game: GameState, running: boolean): boolean {
  if (game.phase === "management") return true;
  return game.phase === "incident" && running;
}

/** Where the founder is now. Written every frame by the scene, so it lives outside React. */
export const founderPose = { x: 0, z: 0, yaw: 0 };

interface FounderStore {
  /** True while the scene has a founder on the floor; without one, actions happen at once as they always did. */
  present: boolean;
  job: Job | null;
  /** Where a click sent the founder: a machine, or a spot on the floor. Steering by keys clears it. */
  goal: { station: EquipmentId } | { x: number; z: number } | null;
  /** The machine the founder can reach from where it stands. */
  near: EquipmentId | null;
  setPresent: (present: boolean) => void;
  assign: (job: Job) => void;
  walkTo: (goal: FounderStore["goal"]) => void;
  setJob: (job: Job | null) => void;
  setNear: (near: EquipmentId | null) => void;
  reset: () => void;
}

export const useFounder = create<FounderStore>()((set) => ({
  present: false,
  job: null,
  goal: null,
  near: null,
  setPresent: (present) => set({ present }),
  assign: (job) => set({ job, goal: { station: job.station } }),
  walkTo: (goal) => set({ goal }),
  setJob: (job) => set({ job }),
  setNear: (near) => set({ near }),
  reset: () => set({ job: null, goal: null, near: null }),
}));
