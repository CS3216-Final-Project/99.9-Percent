"use client";

import { memo, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { EQUIPMENT_ORDER } from "@/sim";
import { FLOOR_NAME, FLOORS, floorOf, type Floor } from "@/game/floors";
import { useGame } from "@/game/store";
import { Icon } from "../icons";
import { crewOn } from "./crewSpots";
import {
  GLASS,
  OBSTACLES,
  ROOM_OBSTACLES,
  SERVER_GLASS,
  SERVER_ROOMS,
  SERVER_ZONE_NAMES,
  SHAFT,
  SPOTS,
  ZONE_NAMES,
  serverObstacles,
  type Obstacle,
  type Racks,
} from "./floorplan";
import { ROOM } from "./layout";
import { FLOOR_NUMBER } from "./levels";
import { placeAt, whereLine } from "./places";
import "./views.css";
import { ride, riding } from "./ride";
import { buildModel, racksOf } from "./sceneModel";
import { avatar, walkTo } from "./walk";

/*
 * A small floor plan in the room's corner: the floor in view with its zones named, the avatar as an arrow and the
 * crew as dots, with a badge where an incident is, and a line saying where the avatar is. It is drawn from the same
 * plan as the room (floorplan.ts), so the two cannot disagree. Tabs change floor like the floor menu; in walk mode a
 * click on the plan walks the avatar there. Screen readers hear the line, not the drawing.
 */

/** Metres of margin round the building on the plan. */
const PAD = 0.8;
const BOX = { x: ROOM.x0 - PAD, z: ROOM.z0 - PAD, w: ROOM.w + 2 * PAD, d: ROOM.d + 2 * PAD };
/**
 * How often the plan is redrawn, in milliseconds: often enough to follow the avatar on the move, and less often while
 * only the crew wander, so the map costs little while the room is busy drawing.
 */
const REDRAW_MS = { walking: 200, still: 500 };

/** The parts of the game the plan shows: the machines standing, and the equipment that needs looking at. */
interface MapModel {
  racks: Racks;
  marks: { id: string; floor: Floor; x: number; z: number; tone: "alert" | "busy"; name: string }[];
}

function useMapModel(): MapModel {
  const key = useGame((s) => {
    const m = buildModel(s.game);
    const marks = EQUIPMENT_ORDER.filter((id) => m.symptomatic.includes(id) || m.inspecting === id).map((id) => ({
      id,
      floor: floorOf(id),
      x: m.footprints[id].x,
      z: m.footprints[id].z,
      tone: m.inspecting === id ? ("busy" as const) : ("alert" as const),
      name: m.names[id],
    }));
    return JSON.stringify({ racks: racksOf(m), marks });
  });
  return useMemo(() => JSON.parse(key) as MapModel, [key]);
}

const shape = (o: Obstacle, key: string) =>
  "box" in o ? (
    <rect key={key} x={o.box[0]} y={o.box[1]} width={o.box[2] - o.box[0]} height={o.box[3] - o.box[1]} />
  ) : (
    <circle key={key} cx={o.disc[0]} cy={o.disc[1]} r={o.disc[2]} />
  );

/** A zone just entered, glowing on the plan for a moment; `n` counts entries, so entering again glows again. */
interface Entered {
  name: string;
  n: number;
}

/**
 * The still part of a floor's plan: walls, glass, the shaft, furniture and the zones' names. Drawn again only when
 * the floor, the machines or the zone just entered change, not each time the avatar and the crew are redrawn.
 */
const Plan = memo(function Plan({ floor, racks, entered }: { floor: Floor; racks: Racks; entered: Entered | null }) {
  const furniture = floor === "office" ? [...OBSTACLES, ...ROOM_OBSTACLES] : serverObstacles(racks);
  const glass = floor === "office" ? GLASS : SERVER_GLASS;
  const names: [string, number, number][] =
    floor === "office" ? ZONE_NAMES : [...SERVER_ZONE_NAMES, ...SERVER_ROOMS.map(([n, r]): [string, number, number] => [n, (r[0] + r[2]) / 2, n === "Server hall" ? r[1] + 1.4 : (r[1] + r[3]) / 2])];
  return (
    <>
      <rect className="map-floor" x={ROOM.x0} y={ROOM.z0} width={ROOM.w} height={ROOM.d} />
      <g className="map-furniture">{furniture.map((o, i) => shape(o, `${o.name}-${i}`))}</g>
      <g className="map-glass">
        {glass.map(([x1, z1, x2, z2], i) => (
          <line key={i} x1={x1} y1={z1} x2={x2} y2={z2} />
        ))}
      </g>
      <g className="map-shaft">
        {SHAFT.map(([x1, z1, x2, z2], i) => (
          <line key={i} x1={x1} y1={z1} x2={x2} y2={z2} />
        ))}
      </g>
      <rect className="map-walls" x={ROOM.x0} y={ROOM.z0} width={ROOM.w} height={ROOM.d} />
      <g className="map-names">
        {names.map(([name, x, z]) =>
          entered?.name === name ? (
            <text key={`${name}-${entered.n}`} className="is-entered" x={x} y={z}>
              {name}
            </text>
          ) : (
            <text key={name} x={x} y={z}>
              {name}
            </text>
          ),
        )}
      </g>
    </>
  );
});

/** Where the avatar is drawn and said to be: walking, where it walks; otherwise in the founder's chair upstairs. */
function avatarSpot(walking: boolean) {
  if (!walking) return { floor: "office" as Floor, x: SPOTS.founder.x, z: SPOTS.founder.z, yaw: SPOTS.founder.rot, to: null as Floor | null };
  return { floor: avatar.floor, x: avatar.x, z: avatar.z, yaw: avatar.yaw, to: riding() ? ride.to : null };
}

export function Minimap({ onFloor }: { onFloor: (floor: Floor) => void }) {
  const started = useGame((s) => s.started);
  const open = useGame((s) => s.mapOpen);
  const floor = useGame((s) => s.floor);
  const walking = useGame((s) => s.walking && s.started);
  const model = useMapModel();
  const svg = useRef<SVGSVGElement>(null);
  const [, redraw] = useState(0);
  const [where, setWhere] = useState(() => {
    const a = avatarSpot(walking);
    return whereLine(a.floor, a.x, a.z, a.to);
  });
  const [entered, setEntered] = useState<Entered | null>(null);
  /** The place the avatar was last in on foot, to tell when it walks into another. */
  const place = useRef<string | null>(null);

  // Follow the avatar and the crew a few times a second while the map is open, and the line whenever it changes.
  useEffect(() => {
    if (!started) return;
    const tick = () => {
      const a = avatarSpot(walking);
      const line = whereLine(a.floor, a.x, a.z, a.to);
      setWhere((was) => (was === line ? was : line));
      // A zone walked into glows on the plan for a moment.
      const now = walking && !a.to ? placeAt(a.floor, a.x, a.z) : null;
      if (now && place.current && now !== place.current) setEntered((was) => ({ name: now, n: (was?.n ?? 0) + 1 }));
      place.current = now;
      if (open) redraw((n) => (n + 1) % 1e6);
    };
    tick();
    const id = window.setInterval(tick, walking ? REDRAW_MS.walking : REDRAW_MS.still);
    return () => window.clearInterval(id);
  }, [started, open, walking]);

  if (!started) return null;
  const set = useGame.getState().setMapOpen;
  if (!open)
    return (
      <div className="room-map is-closed">
        <button type="button" className="map-toggle" onClick={() => set(true)} aria-expanded={false}>
          <Icon name="map" size={18} />
          Map
        </button>
        <p className="visually-hidden" aria-live="polite">
          {where}
        </p>
      </div>
    );

  const a = avatarSpot(walking);
  const here = !a.to && a.floor === floor;
  const crew = crewOn(floor);
  const destination = walking && here ? avatar.path[avatar.path.length - 1] : undefined;
  const canWalk = walking && here;

  const click = (e: MouseEvent<SVGSVGElement>) => {
    const el = svg.current;
    if (!canWalk || !el || riding()) return;
    const m = el.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    if (walkTo(p.x, p.y)) useGame.getState().noteMapWalk();
  };

  return (
    <section className={`room-map${canWalk ? " can-walk" : ""}`} aria-label="Map">
      <div className="map-head">
        <div className="map-floors" role="group" aria-label="Map floor">
          {FLOORS.map((f) => (
            <button key={f} type="button" aria-pressed={f === floor} onClick={() => f !== floor && onFloor(f)}>
              <span className="floor-number" aria-hidden="true">
                {FLOOR_NUMBER[f]}
              </span>
              {f === "office" ? "Office" : "Servers"}
              <span className="visually-hidden"> ({FLOOR_NAME[f]})</span>
            </button>
          ))}
        </div>
        <button type="button" className="map-toggle" onClick={() => set(false)} aria-expanded={true} aria-label="Hide map">
          <Icon name="close" size={16} />
        </button>
      </div>
      <svg ref={svg} className="map-plan" viewBox={`${BOX.x} ${BOX.z} ${BOX.w} ${BOX.d}`} aria-hidden="true" onClick={click}>
        <Plan floor={floor} racks={model.racks} entered={entered} />
        <g className="map-crew">
          {crew.map(([x, z], i) => (
            <circle key={i} cx={x} cy={z} r={0.42} />
          ))}
        </g>
        {model.marks
          .filter((mark) => mark.floor === floor)
          .map((mark) => (
            <g key={mark.id} className={`map-mark tone-${mark.tone}`} transform={`translate(${mark.x} ${mark.z})`}>
              <circle r={1.1} />
              <text y={0.45}>!</text>
            </g>
          ))}
        {destination && <circle className="map-destination" cx={destination[0]} cy={destination[1]} r={0.55} />}
        {here && (
          <g className="map-avatar" transform={`translate(${a.x} ${a.z}) rotate(${((-a.yaw * 180) / Math.PI).toFixed(1)})`}>
            <circle r={1.15} />
            <path d="M0 -0.95 L0.7 0.6 L0 0.25 L-0.7 0.6 Z" />
          </g>
        )}
      </svg>
      <p className="map-where" aria-live="polite">
        {where}
      </p>
      {model.marks.length > 0 && (
        <p className="visually-hidden">
          {model.marks.map((mark) => `${mark.tone === "busy" ? "Being investigated" : "Incident"}: ${mark.name}, ${FLOOR_NAME[mark.floor].toLowerCase()}`).join(". ")}
        </p>
      )}
    </section>
  );
}
