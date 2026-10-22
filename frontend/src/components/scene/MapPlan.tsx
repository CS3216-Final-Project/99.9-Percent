import { memo } from "react";
import type { Floor } from "@/game/floors";
import {
  GLASS,
  OBSTACLES,
  ROOM_OBSTACLES,
  SERVER_GLASS,
  SHAFT,
  serverObstacles,
  type Obstacle,
  type Racks,
} from "./floorplan";
import { ROOM } from "./layout";
import { zoneAreas } from "./places";

/*
 * The plan both maps are drawn from: a floor's zones, furniture, glass, shaft and walls, in world metres. The round
 * minimap turns and clips it; the menu's map pans and zooms it. Drawn again only when the floor or the machines
 * change, so the moving parts — avatar, crew, marks — never make it redraw.
 */

const shape = (o: Obstacle, key: string) =>
  "box" in o ? (
    <rect key={key} x={o.box[0]} y={o.box[1]} width={o.box[2] - o.box[0]} height={o.box[3] - o.box[1]} />
  ) : (
    <circle key={key} cx={o.disc[0]} cy={o.disc[1]} r={o.disc[2]} />
  );

/**
 * The still part of a floor's plan: its zones, each tinted apart from the ones it meets, then walls, glass, the shaft
 * and furniture.
 */
export const Plan = memo(function Plan({ floor, racks }: { floor: Floor; racks: Racks }) {
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
