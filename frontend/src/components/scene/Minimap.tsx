"use client";

import { memo, useEffect, useId, useMemo, useRef, useState, type MouseEvent } from "react";
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
import { DIAL_RADIUS, dialTurn, halfWidthAngle, northOnDial, onRim, toDial, viewWedge } from "./mapDial";
import { FLOOR_NUMBER } from "./levels";
import { placeAt, whereLine, zoneAreas } from "./places";
import "./views.css";
import { ride, riding } from "./ride";
import { buildModel, racksOf } from "./sceneModel";
import { avatar, walkTo } from "./walk";
import { viewNow } from "./viewState";

/*
 * A round map in the room's corner, the way a game's minimap works: centred on the avatar while it walks, or on what
 * the overview looks at, and turned so the way the view faces is up. It shows the floor in view with its zones named,
 * the avatar as an arrow, the crew as dots and, in first person, the wedge the eyes see. A badge marks equipment that
 * needs looking at, sitting on the rim when it lies beyond it, and an N on the rim points to the back wall. A line
 * underneath says where the avatar is. It is drawn from the same plan as the room (floorplan.ts), so the two cannot
 * disagree. Tabs change floor like the floor menu; in walk mode a click on the map walks the avatar there. Screen
 * readers hear the line, not the drawing.
 */
/**
 * How often, in milliseconds, the map checks whether what it is drawn with has changed: the crew coming and going,
 * the avatar changing floor, a walk's destination. Where things are is kept up every frame without drawing again.
 */
const RESHAPE_MS = 150;

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
 * The still part of a floor's plan: its zones, each tinted apart from the ones it meets, then walls, glass, the shaft
 * and furniture. Drawn again only when the floor or the machines change, not each time the dial turns or the avatar
 * and the crew are redrawn.
 */
const Plan = memo(function Plan({ floor, racks }: { floor: Floor; racks: Racks }) {
  const furniture = floor === "office" ? [...OBSTACLES, ...ROOM_OBSTACLES] : serverObstacles(racks);
  const glass = floor === "office" ? GLASS : SERVER_GLASS;
  return (
    <>
      <rect className="map-floor" x={ROOM.x0} y={ROOM.z0} width={ROOM.w} height={ROOM.d} />
      <g className="map-zones">
        {zoneAreas(floor).map((zone, i) => (
          <polygon
            key={`${zone.name}-${i}`}
            className={zone.tone === null ? "is-elevator" : `tone-${zone.tone}`}
            data-zone={zone.name}
            points={zone.points.map(([x, z]) => `${x.toFixed(2)},${z.toFixed(2)}`).join(" ")}
          />
        ))}
      </g>
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
    </>
  );
});

/** The zones' names on a floor, where they hang in the room. */
function namesOn(floor: Floor): [string, number, number][] {
  return floor === "office" ? ZONE_NAMES : [...SERVER_ZONE_NAMES, ...SERVER_ROOMS.map(([n, r]): [string, number, number] => [n, (r[0] + r[2]) / 2, n === "Server hall" ? r[1] + 1.4 : (r[1] + r[3]) / 2])];
}

/** The zones' names, each turned back against the dial so it always reads upright. */
function Names({ floor, dial, entered }: { floor: Floor; dial: Dial; entered: Entered | null }) {
  return (
    <g className="map-names">
      {namesOn(floor).map(([name, x, z]) => (
        <text key={entered?.name === name ? `${name}-${entered.n}` : name} className={entered?.name === name ? "is-entered" : undefined} x={x} y={z} transform={nameAt(dial, x, z)}>
          {name}
        </text>
      ))}
    </g>
  );
}

/** Where the avatar is drawn and said to be: walking, where it walks; otherwise in the founder's chair upstairs. */
function avatarSpot(walking: boolean) {
  if (!walking) return { floor: "office" as Floor, x: SPOTS.founder.x, z: SPOTS.founder.z, yaw: SPOTS.founder.rot, to: null as Floor | null };
  return { floor: avatar.floor, x: avatar.x, z: avatar.z, yaw: avatar.yaw, to: riding() ? ride.to : null };
}

/** How the dial sits this moment: what it is centred on and which way it faces, and where the avatar is. */
function dialNow(walking: boolean, floor: Floor) {
  const a = avatarSpot(walking);
  const here = !a.to && a.floor === floor;
  const canWalk = walking && here;
  // Centred on the avatar while it walks this floor, else on what the overview looks at; turned with the view.
  const seenFromAvatar = walking && viewNow.perspective && viewNow.want !== "overview";
  const heading = seenFromAvatar ? viewNow.heading : viewNow.overview.heading;
  const [cx, cz] = canWalk ? [a.x, a.z] : [viewNow.overview.x, viewNow.overview.z];
  return { a, here, canWalk, heading, cx, cz, turn: dialTurn(heading), wedge: here && seenFromAvatar && viewNow.want === "first" };
}
type Dial = ReturnType<typeof dialNow>;

const n2 = (v: number) => v.toFixed(2);

/*
 * Where each moving part is drawn, as the attribute it takes: worked out the same way when React draws the map and
 * on every frame between, when the map moves them without drawing anything again.
 */
const worldAt = (d: Dial) => `rotate(${n2(d.turn)}) translate(${n2(-d.cx)} ${n2(-d.cz)})`;
const avatarAt = (d: Dial) => `translate(${n2(d.a.x)} ${n2(d.a.z)}) rotate(${n2((-d.a.yaw * 180) / Math.PI)})`;
const nameAt = (d: Dial, x: number, z: number) => `rotate(${n2(-d.turn)} ${x} ${z})`;
function northAt(d: Dial): string {
  const [x, y] = northOnDial(d.heading, DIAL_RADIUS - 1.6);
  return `translate(${n2(x)} ${n2(y)})`;
}
function wedgeAt(d: Dial, fov: number): string {
  const [o, l, r] = viewWedge(d.a.x, d.a.z, d.heading, halfWidthAngle(fov, 16 / 9), 7);
  return `M${n2(o[0])} ${n2(o[1])} L${n2(l[0])} ${n2(l[1])} L${n2(r[0])} ${n2(r[1])} Z`;
}
function markAt(d: Dial, x: number, z: number): { transform: string; off: boolean } {
  const { at, off } = onRim(toDial(x, z, d.cx, d.cz, d.heading), DIAL_RADIUS - 1.5);
  return { transform: `translate(${n2(at[0])} ${n2(at[1])})`, off };
}

/** Where a walk is headed, while the avatar walks the floor shown. */
const destinationOf = (d: Dial, walking: boolean) => (walking && d.here ? avatar.path[avatar.path.length - 1] : undefined);

/** What the map is drawn with, apart from where things are: when this changes, React draws it again. */
function shapeOf(d: Dial, walking: boolean, floor: Floor): string {
  const end = destinationOf(d, walking);
  return [d.here, d.canWalk, d.wedge, crewOn(floor).length, end ? `${n2(end[0])},${n2(end[1])}` : ""].join("|");
}

/** Set an attribute only when it changes, so a still map writes nothing. */
function put(el: Element | null | undefined, name: string, value: string): void {
  if (el && el.getAttribute(name) !== value) el.setAttribute(name, value);
}

export function Minimap({ onFloor }: { onFloor: (floor: Floor) => void }) {
  const started = useGame((s) => s.started);
  const open = useGame((s) => s.mapOpen);
  const floor = useGame((s) => s.floor);
  const walking = useGame((s) => s.walking && s.started);
  const model = useMapModel();
  const plan = useRef<SVGSVGElement>(null);
  const world = useRef<SVGGElement>(null);
  const clip = useId();
  const fov = useGame((s) => s.graphics.fov);
  const [, redraw] = useState(0);
  const [where, setWhere] = useState(() => {
    const a = avatarSpot(walking);
    return whereLine(a.floor, a.x, a.z, a.to, open ? floor : null);
  });
  const [entered, setEntered] = useState<Entered | null>(null);
  /** The place the avatar was last in on foot, to tell when it walks into another. */
  const place = useRef<string | null>(null);

  // The line whenever it changes, and the drawing whenever what it is made of does: a few times a second is plenty.
  useEffect(() => {
    if (!started) return;
    let shape = "";
    const tick = () => {
      const a = avatarSpot(walking);
      // Open, the map's tabs already say which floor it shows.
      const line = whereLine(a.floor, a.x, a.z, a.to, open ? floor : null);
      setWhere((was) => (was === line ? was : line));
      // A zone walked into glows on the plan for a moment.
      const now = walking && !a.to ? placeAt(a.floor, a.x, a.z) : null;
      if (now && place.current && now !== place.current) setEntered((was) => ({ name: now, n: (was?.n ?? 0) + 1 }));
      place.current = now;
      if (!open) return;
      const next = shapeOf(dialNow(walking, floor), walking, floor);
      if (next === shape) return;
      shape = next;
      redraw((n) => (n + 1) % 1e6);
    };
    tick();
    const id = window.setInterval(tick, RESHAPE_MS);
    return () => window.clearInterval(id);
  }, [started, open, walking, floor]);

  // Where everything is, every frame: the dial turns and slides with the camera as it moves, and the avatar and the
  // crew walk across it, without React drawing the map again.
  useEffect(() => {
    if (!started || !open) return;
    let frame = 0;
    const step = () => {
      frame = requestAnimationFrame(step);
      const svg = plan.current;
      if (!svg) return;
      const d = dialNow(walking, floor);
      put(world.current, "transform", worldAt(d));
      put(svg.querySelector(".map-north"), "transform", northAt(d));
      if (d.here) put(svg.querySelector(".map-avatar"), "transform", avatarAt(d));
      if (d.wedge) put(svg.querySelector(".map-wedge"), "d", wedgeAt(d, fov));
      for (const t of svg.querySelectorAll(".map-names text")) put(t, "transform", nameAt(d, Number(t.getAttribute("x")), Number(t.getAttribute("y"))));
      for (const m of svg.querySelectorAll<SVGGElement>(".map-mark")) {
        const { transform, off } = markAt(d, Number(m.dataset.x), Number(m.dataset.z));
        put(m, "transform", transform);
        m.classList.toggle("is-off", off);
      }
      const crew = crewOn(floor);
      const dots = svg.querySelectorAll(".map-crew circle");
      if (dots.length === crew.length)
        crew.forEach(([x, z], i) => {
          put(dots[i], "cx", n2(x));
          put(dots[i], "cy", n2(z));
        });
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [started, open, walking, floor, fov]);

  if (!started) return null;
  const set = useGame.getState().setMapOpen;
  if (!open)
    return (
      <div className="room-map is-closed">
        <button type="button" className="map-toggle" onClick={() => set(true)} aria-expanded={false}>
          <Icon name="map" size={20} />
          <span>Map</span>
        </button>
        <p className="visually-hidden" aria-live="polite">
          {where}
        </p>
      </div>
    );

  const d = dialNow(walking, floor);
  const crew = crewOn(floor);
  const destination = destinationOf(d, walking);
  const r = DIAL_RADIUS;

  const click = (e: MouseEvent<SVGSVGElement>) => {
    const g = world.current;
    if (!dialNow(walking, floor).canWalk || !g || riding()) return;
    const m = g.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    if (!walkTo(p.x, p.y)) return;
    useGame.getState().noteMapWalk();
    // Where the walk is headed shows at once.
    redraw((n) => (n + 1) % 1e6);
  };

  return (
    <section className={`room-map${d.canWalk ? " can-walk" : ""}`} aria-label="Map">
      <div className="map-dial">
        <svg ref={plan} className="map-plan" viewBox={`${-r} ${-r} ${2 * r} ${2 * r}`} aria-hidden="true" onClick={click}>
          <defs>
            <clipPath id={clip}>
              <circle r={r} />
            </clipPath>
          </defs>
          <circle className="map-outside" r={r} />
          <g clipPath={`url(#${clip})`}>
            <g ref={world} className="map-world" transform={worldAt(d)}>
              <Plan floor={floor} racks={model.racks} />
              {d.wedge && <path className="map-wedge" d={wedgeAt(d, fov)} />}
              <Names floor={floor} dial={d} entered={entered} />
              <g className="map-crew">
                {crew.map(([x, z], i) => (
                  <circle key={i} cx={n2(x)} cy={n2(z)} r={0.42} />
                ))}
              </g>
              {destination && <circle className="map-destination" cx={destination[0]} cy={destination[1]} r={0.55} />}
              {d.here && (
                <g className="map-avatar" transform={avatarAt(d)}>
                  <circle r={1.15} />
                  <path d="M0 -0.95 L0.7 0.6 L0 0.25 L-0.7 0.6 Z" />
                </g>
              )}
            </g>
          </g>
          {model.marks
            .filter((mark) => mark.floor === floor)
            .map((mark) => {
              const { transform, off } = markAt(d, mark.x, mark.z);
              return (
                <g key={mark.id} className={`map-mark tone-${mark.tone}${off ? " is-off" : ""}`} data-x={mark.x} data-z={mark.z} transform={transform}>
                  <circle r={1.1} />
                  <text y={0.45}>!</text>
                </g>
              );
            })}
          <circle className="map-rim" r={r - 0.2} />
          <g className="map-north" transform={northAt(d)}>
            <circle r={1.05} />
            <text y={0.42}>N</text>
          </g>
        </svg>
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
        <button type="button" className="map-toggle map-close" onClick={() => set(false)} aria-expanded={true} aria-label="Hide map">
          <Icon name="close" size={16} />
        </button>
      </div>
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
