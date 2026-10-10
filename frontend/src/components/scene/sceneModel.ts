import {
  EQUIPMENT_ORDER,
  equipmentInfo,
  has,
  metrics,
  monitoringLevel,
  symptomaticEquipment,
  type EquipmentId,
  type EquipmentState,
  type GameState,
} from "@/sim";
import { footprint, MAX_TEMP_SHOWN, type Footprint } from "./layout";
import type { Led } from "./textures";

/* ------------------------------------------------------------------ */
/* Scene model: the few facts the 3D view needs, as a stable snapshot  */
/* ------------------------------------------------------------------ */

export interface SceneModel {
  opening: boolean;
  incident: boolean;
  hosts: Led[];
  temp: number;
  lb: boolean;
  standby: boolean;
  cache: boolean;
  dbCabinets: number;
  dbLed: Led;
  replica: boolean;
  backup: boolean;
  monitoring: 0 | 1 | 2;
  engineers: number;
  busy: number;
  releases: number;
  promos: number;
  flow: number;
  states: Record<EquipmentId, EquipmentState>;
  names: Record<EquipmentId, string>;
  built: Record<EquipmentId, boolean>;
  footprints: Record<EquipmentId, Footprint>;
  symptomatic: EquipmentId[];
  inspected: EquipmentId[];
  inspecting: EquipmentId | null;
}

export function buildModel(s: GameState): SceneModel {
  const inc = s.phase === "incident" ? s.incident : null;
  const inspected = inc ? inc.evidence.map((e) => e.equipment) : [];
  const named = has(s, "monitoring") || has(s, "health_checks");
  // During an incident the racks only show what the player has actually looked at.
  const reveal = (id: EquipmentId) => !inc || inspected.includes(id);
  const m = metrics(s);

  const hosts: Led[] = s.infra.appHosts.map((h, i) => {
    if(s.campaign && !s.campaign.apps[i].routed) return "off";
    if (h.status === "failed") return reveal("app") ? "off" : "ok";
    if (h.status === "degraded") return named ? "warn" : "ok";
    if (!inc && m.appUtil >= 1) return "critical";
    if (!inc && m.appUtil >= 0.85 && named) return "warn";
    return "ok";
  });
  const dbStatus = s.infra.dbHost.status;
  const dbLed: Led =
    dbStatus === "failed"
      ? reveal("db")
        ? "off"
        : "ok"
      : dbStatus === "degraded" && named
        ? "warn"
        : !inc && m.dbUtil >= 1
          ? "critical"
          : !inc && m.dbUtil >= 0.85 && named
            ? "warn"
            : "ok";

  const states = {} as SceneModel["states"];
  const names = {} as SceneModel["names"];
  const built = {} as SceneModel["built"];
  const footprints = {} as SceneModel["footprints"];
  for (const id of EQUIPMENT_ORDER) {
    const info = equipmentInfo(s, id);
    states[id] = info.state;
    names[id] = info.name;
    built[id] = info.built;
    footprints[id] = footprint(s, id);
  }

  return {
    opening: !!s.campaign,
    incident: s.campaign ? !!s.campaign.incident : !!inc,
    hosts,
    temp: Math.min(inc ? (s.pendingTurn?.autoscaled ?? 0) : s.live.tempServers, MAX_TEMP_SHOWN),
    lb: has(s, "load_balancing"),
    standby: has(s, "standby"),
    cache: has(s, "caching"),
    dbCabinets: s.infra.dbTier + 1,
    dbLed,
    replica: has(s, "replicas"),
    backup: has(s, "backups"),
    monitoring: monitoringLevel(s),
    engineers: s.engineers,
    busy: s.campaign ? (s.campaign.pending.some(a=>a.type==="add-app"||a.type==="upgrade-db")?4:0) : s.tasks.reduce((n, t) => n + t.assigned, 0),
    releases: s.releases.length,
    promos: s.activePromos.length,
    flow: Math.round(Math.min(1.4, Math.max(m.appUtil, 0.25)) * 10) / 10,
    states,
    names,
    built,
    footprints,
    symptomatic: inc ? symptomaticEquipment(s) : [],
    inspected,
    inspecting: inc?.inspecting?.equipment ?? null,
  };
}
