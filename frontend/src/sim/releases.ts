import { BALANCE } from "./balance";
import { fixEffort } from "./derive";
import { newId } from "./state";
import { TECH } from "./tech";
import type { DeployRecord, GameState, Release } from "./types";

/** Put a release into production: this is the moment its effect switches on. */
export function applyRelease(s: GameState, release: Release): void {
  if (release.kind === "tech" && release.techId) {
    if (!s.techDone.includes(release.techId)) s.techDone.push(release.techId);
    if (release.techId === "caching") s.cacheWarmth = 0;
    if (release.techId === "larger_servers" || release.techId === "load_balancing") {
      s.lastCapacityTurn.app = s.turn;
    }
    if (release.techId === "caching" || release.techId === "cache_tuning" || release.techId === "replicas") {
      s.lastCapacityTurn.db = s.turn;
    }
  } else if (release.kind === "db_upgrade" && release.dbTier !== undefined) {
    s.infra.dbTier = Math.max(s.infra.dbTier, release.dbTier);
    s.lastCapacityTurn.db = s.turn;
  }
}

/** The most recent deployment a rollback can still reach, if any. */
export function rollbackTarget(s: GameState): DeployRecord | null {
  for (let i = s.deploys.length - 1; i >= 0; i--) {
    const d = s.deploys[i];
    if (d.rolledBack) continue;
    if (d.turn < s.turn - BALANCE.deploy.rollbackWindow) return null;
    return d;
  }
  return null;
}

/**
 * Undo a deployment. The release returns to the queue; if it was the cause of a
 * regression it needs a fix task before it can ship again.
 */
export function revertDeploy(s: GameState, rec: DeployRecord, needsFix: boolean): Release {
  rec.rolledBack = true;
  if (rec.kind === "tech" && rec.techId) {
    s.techDone = s.techDone.filter((t) => t !== rec.techId);
  } else if (rec.kind === "db_upgrade" && rec.dbTier !== undefined) {
    s.infra.dbTier = Math.max(0, Math.min(s.infra.dbTier, rec.dbTier - 1));
  }
  const release: Release = {
    id: rec.releaseId,
    title: rec.title,
    kind: rec.kind,
    techId: rec.techId,
    dbTier: rec.dbTier,
    size: rec.size,
    tested: rec.tested,
    needsFix,
    readyTurn: s.turn,
  };
  s.releases.push(release);
  if (needsFix) {
    s.tasks.push({
      id: newId(s, "task"),
      kind: "fix_release",
      title: `Fix: ${rec.title}`,
      effort: fixEffort(release),
      progress: 0,
      assigned: 0,
      startedTurn: s.turn,
      costPaid: 0,
      releaseId: release.id,
    });
  }
  if (s.latentRegression?.releaseId === rec.releaseId) s.latentRegression = null;
  return release;
}

export function releaseTitle(kind: "tech" | "db_upgrade", ref: { techId?: Release["techId"]; dbTier?: number }): string {
  if (kind === "tech" && ref.techId) return TECH[ref.techId].name;
  if (ref.dbTier !== undefined) return `Database upgrade to ${BALANCE.db.tiers[ref.dbTier].name}`;
  return "Release";
}
