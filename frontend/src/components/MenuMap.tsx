import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { attentionOn, FLOOR_NAME, FLOORS, type Attention, type Floor } from "@/game/floors";
import { useGame } from "@/game/store";
import { Icon } from "./icons";
import { EQUIPMENT_ICON, STATE_META } from "./presentation";
import { tipProps } from "./tips";
import { crewOn } from "./scene/crewSpots";
import { ELEVATOR_SPOT, type Racks } from "./scene/floorplan";
import { ROOM } from "./scene/layout";
import { FLOOR_NUMBER } from "./scene/levels";
import { Plan } from "./scene/MapPlan";
import {
  allPlaces,
  centreView,
  findPlaces,
  HOME_VIEW,
  initialView,
  MAP_ZOOM,
  panView,
  placeLabels,
  placesOn,
  textWidth,
  viewBoxOf,
  ZONE_KIND_NAME,
  zoneKindOf,
  zoomView,
  type FixedLabel,
  type LabelAsk,
  type LabelBox,
  type MapView,
  type Place,
  type PlaceModel,
  type ZoneKind,
} from "./scene/mapPlaces";
import { placeAt, whereLine, zoneNamesOn } from "./scene/places";
import { riding } from "./scene/ride";
import { buildModel, racksOf } from "./scene/sceneModel";
import { avatarSpot, walkTo } from "./scene/walk";
import "./scene/views.css";
import "./MenuMap.css";

/*
 * The menu's Map tab: a top-down plan of the building the way a pause-menu map works, beside the corner minimap.
 * Floor tabs switch the plan and badge the other floor when it needs the player; a line says where the avatar is.
 * The plan drags and zooms about the cursor, and its pins — labelled equipment, fun things, the crew, the avatar —
 * keep their size on screen at any zoom, so they read like map blips rather than room furniture. Everything on a
 * floor can be found through the search or the directory beneath, and picking one opens a card that can take the
 * room's view to it or send the walking avatar there, both only when the run is free to follow (not mid-guide).
 */

interface MapModel {
  racks: Racks;
  model: PlaceModel;
  attention: Record<Floor, Attention>;
}

function useMapModel(): MapModel {
  const key = useGame((s) => {
    const m = buildModel(s.game);
    const model: PlaceModel = {
      names: m.names,
      built: m.built,
      states: m.states,
      footprints: m.footprints,
      symptomatic: m.symptomatic,
      inspecting: m.inspecting,
    };
    const attention: Record<Floor, Attention> = { office: attentionOn("office", m), servers: attentionOn("servers", m) };
    return JSON.stringify({ racks: racksOf(m), model, attention });
  });
  return useMemo(() => JSON.parse(key) as MapModel, [key]);
}

type Picked = { place: Place } | { spot: { floor: Floor; x: number; z: number } };

const LAYERS = [
  ["equipment", "Equipment", "server"],
  ["people", "People", "user"],
  ["fun", "Things to do", "party"],
  ["names", "Zone names", "floor"],
] as const;
type Layer = (typeof LAYERS)[number][0];

const KIND_ORDER: ZoneKind[] = ["machines", "work", "break", "plant"];
const ELEVATOR_CENTRE: [number, number] = [(ELEVATOR_SPOT[0] + ELEVATOR_SPOT[2]) / 2, (ELEVATOR_SPOT[1] + ELEVATOR_SPOT[3]) / 2];

export function MenuMap() {
  const started = useGame((s) => s.started);
  const walking = useGame((s) => s.walking);
  const guided = useGame((s) => s.tour !== null);
  const roomFloor = useGame((s) => s.floor);
  const { racks, model, attention } = useMapModel();
  const [floor, setFloor] = useState<Floor>(() => useGame.getState().floor);
  const [layers, setLayers] = useState<Record<Layer, boolean>>({ equipment: true, people: true, fun: true, names: true });
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Picked | null>(null);
  const [view, setView] = useState<MapView>(HOME_VIEW);
  // The crew and the avatar move without React, so a light tick redraws them a few times a second.
  const [, setTick] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const [svgWidth, setSvgWidth] = useState(780);
  const drag = useRef<{ id: number; x: number; y: number; view: MapView } | null>(null);
  const dragged = useRef(false);
  const [panning, setPanning] = useState(false);
  const gridId = `map-grid-${useId()}`;

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => (n + 1) % 1e6), 200);
    return () => window.clearInterval(id);
  }, []);

  // World metres per CSS pixel, so pins and labels hold their screen size at any zoom or width.
  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth || el.getBoundingClientRect().width;
      if (w > 0) setSvgWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Phones open closer in, centred on the avatar, so a metre gets enough pixels for labels to read.
  useLayoutEffect(() => {
    const w = svgRef.current?.clientWidth ?? 0;
    if (w > 0) {
      setSvgWidth(w);
      setView(initialView(w, focusFor(floor)));
    }
    // The opening framing only: later resizes keep the view the player chose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll zooms about the point under the cursor; the page must not scroll instead.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const m = el.getScreenCTM();
      const p = m ? new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()) : null;
      setView((v) => zoomView(v, e.deltaY < 0 ? 1.25 : 1 / 1.25, p ? [p.x, p.y] : undefined));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const places = placesOn(floor, model);
  const matches = query.trim() ? findPlaces(allPlaces(model), query) : null;
  const shown = matches === null ? null : matches.filter((p) => (p.kind === "equipment" ? layers.equipment : p.kind === "fun" ? layers.fun : true));
  const a = avatarSpot(walking && started);
  const canWalk = walking && started && !riding() && a.floor === floor;
  const where = whereLine(a.floor, a.x, a.z, a.to, floor);
  const s = ROOM.w / view.k / svgWidth;
  const box = viewBoxOf(view);
  const crew = layers.people ? crewOn(floor) : [];

  // Label positions are worked out in screen pixels so they keep their size at any zoom, like map blips.
  const toPx = (x: number, z: number): [number, number] => [(x - box.x) / s, (z - box.y) / s];
  const bounds: LabelBox = { x: 0, y: 0, w: svgWidth, h: (svgWidth * ROOM.d) / ROOM.w };
  const fixed: FixedLabel[] = layers.names
    ? zoneNamesOn(floor).map(([n, x, z]) => {
        const [px, py] = toPx(x, z);
        const w = textWidth(n, 12);
        // A name that would run past the frame is nudged back inside it.
        const bx = Math.min(Math.max(px - w / 2, 4), Math.max(4, svgWidth - w - 4));
        return { key: n, box: { x: bx, y: py - 8, w, h: 16 } };
      })
    : [];
  const asks: LabelAsk[] = [];
  if (layers.people && a.floor === floor && !a.to) {
    const [px, py] = toPx(a.x, a.z);
    asks.push({ key: "you", x: px, y: py, text: "You", clear: 16 });
  }
  const equipmentPins = layers.equipment ? places.filter((p) => p.kind === "equipment") : [];
  const funPins = layers.fun && floor === "office" ? places.filter((p) => p.kind === "fun") : [];
  for (const p of equipmentPins) {
    const [px, py] = toPx(p.x, p.z);
    asks.push({ key: p.key, x: px, y: py, text: p.name, clear: 13 });
  }
  for (const p of funPins) {
    const [px, py] = toPx(p.x, p.z);
    asks.push({ key: p.key, x: px, y: py, text: p.name, clear: 11 });
  }
  if (layers.names) {
    const [px, py] = toPx(ELEVATOR_CENTRE[0], ELEVATOR_CENTRE[1]);
    asks.push({ key: `zone:${floor}:Elevator`, x: px, y: py, text: "Elevator", clear: 1.3 / s });
  }
  const labels = placeLabels(asks, fixed, bounds, 12);

  function focusFor(f: Floor): [number, number] | null {
    const spot = avatarSpot(walking && started);
    return spot.floor === f && !spot.to ? [spot.x, spot.z] : null;
  }

  const pick = (place: Place) => {
    setPicked({ place });
    if (place.floor !== floor) setFloor(place.floor);
    if (view.k > 1) setView((v) => centreView(v, place.x, place.z));
  };

  const pickSpot = (x: number, z: number) => setPicked({ spot: { floor, x, z } });

  const showFloor = (f: Floor) => {
    setFloor(f);
    setPicked((p) => (p && "spot" in p ? null : p));
    setView(initialView(svgWidth, focusFor(f)));
  };

  const centreOnYou = () => {
    const spot = avatarSpot(walking && started);
    if (spot.floor !== floor) {
      setFloor(spot.floor);
      setPicked((p) => (p && "spot" in p ? null : p));
    }
    setView((v) => centreView({ ...v, k: Math.max(v.k, 2) }, spot.x, spot.z));
  };

  const pin = (place: Place) => {
    const isPicked = picked !== null && "place" in picked && picked.place.key === place.key;
    const cls = `map-pin kind-${place.kind} state-${place.state ?? "none"}${place.mark ? ` mark-${place.mark}` : ""}${isPicked ? " is-picked" : ""}`;
    const [px, py] = toPx(place.x, place.z);
    const lab = labels.placed.get(place.key);
    return (
      <g
        key={place.key}
        className={cls}
        data-key={place.key}
        transform={`translate(${place.x} ${place.z}) scale(${s})`}
        onClick={(e) => {
          e.stopPropagation();
          pick(place);
        }}
      >
        {place.kind === "equipment" ? (
          <>
            <rect x={-13} y={-13} width={26} height={26} rx={6} />
            <svg x={-8} y={-8} width={16} height={16} className="map-pin-icon">
              <Icon name={EQUIPMENT_ICON[place.equipment!]} size={16} />
            </svg>
            {place.mark && (
              <g className="map-pin-mark" transform="translate(10 -10)">
                <circle r={6} />
                <text y={2.2}>!</text>
              </g>
            )}
          </>
        ) : (
          <>
            <circle r={11} />
            <svg x={-6} y={-6} width={12} height={12} className="map-pin-icon">
              <Icon name="party" size={12} />
            </svg>
          </>
        )}
        {lab && (
          <text className="map-pin-label" x={lab.box.x + lab.box.w / 2 - px} y={lab.box.y + 2 - py} style={{ fontSize: 12 }}>
            {place.name}
          </text>
        )}
      </g>
    );
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    // Capturing the pointer would retarget the click away from the zoom buttons and the pins.
    const target = e.target as Element;
    if (target.closest("button") || target.closest(".map-pin")) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, view };
    dragged.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    setPanning(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.hypot(dx, dy) > 4) dragged.current = true;
    if (dragged.current) setView(panView(d.view, -dx * s, -dy * s));
  };
  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
    setPanning(false);
  };
  const onClick = (e: MouseEvent<SVGSVGElement>) => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    const m = svgRef.current?.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    if (p.x >= ROOM.x0 && p.x <= ROOM.x1 && p.y >= ROOM.z0 && p.y <= ROOM.z1) pickSpot(p.x, p.y);
  };

  const chipFor = (p: Place) => {
    const isPicked = picked !== null && "place" in picked && picked.place.key === p.key;
    const cls = `chip${p.kind === "zone" ? " chip-plain" : ""}${isPicked ? " is-selected" : ""}${p.mark === "alert" ? " is-alert" : ""}`;
    const tip = p.kind === "equipment" ? `${STATE_META[p.state!].word}. ${p.zone}` : p.kind === "fun" ? p.zone : undefined;
    return (
      <button key={p.key} type="button" className={cls} aria-pressed={isPicked} onClick={() => pick(p)} {...tipProps(tip)}>
        {p.kind === "equipment" && (
          <>
            <i className={`menu-map-dot tone-${STATE_META[p.state!].tone}`} aria-hidden="true" />
            <span className="chip-icon">
              <Icon name={EQUIPMENT_ICON[p.equipment!]} />
            </span>
          </>
        )}
        {p.kind === "fun" && (
          <span className="chip-icon">
            <Icon name="party" />
          </span>
        )}
        {p.name}
        {matches !== null && p.floor !== floor && <span className="menu-map-floor-tag">{FLOOR_NAME[p.floor]}</span>}
      </button>
    );
  };

  const card = () => {
    if (!picked) return null;
    const place: Place =
      "place" in picked
        ? picked.place
        : {
            key: "spot",
            kind: "zone",
            floor: picked.spot.floor,
            name: placeAt(picked.spot.floor, picked.spot.x, picked.spot.z),
            x: picked.spot.x,
            z: picked.spot.z,
            zone: placeAt(picked.spot.floor, picked.spot.x, picked.spot.z),
          };
    const isSpot = !("place" in picked);
    const kicker = isSpot ? "Spot" : place.kind === "equipment" ? "Equipment" : place.kind === "zone" ? "Place" : "Thing to do";
    const icon = isSpot ? "walk" : place.kind === "equipment" ? EQUIPMENT_ICON[place.equipment!] : place.kind === "fun" ? "party" : "map";
    const whereText = place.kind === "zone" && !isSpot ? FLOOR_NAME[place.floor] : `${place.zone}, ${FLOOR_NAME[place.floor].toLowerCase()}`;
    const meta = place.state ? STATE_META[place.state] : null;
    const store = useGame.getState();
    return (
      <div className="menu-map-card" role="group" aria-label="Selected place">
        <span className="chip-icon">
          <Icon name={icon} />
        </span>
        <span className="menu-map-card-text">
          <span className="menu-map-card-kicker">{kicker}</span>
          <strong>{place.name}</strong>
          <span className="muted">{whereText}</span>
        </span>
        {meta && (
          <span className={`tag tag-${meta.tone === "muted" ? "ok" : meta.tone}`}>
            <Icon name={meta.icon} size={12} />
            {meta.word}
          </span>
        )}
        {place.mark === "alert" && <span className="tag tag-critical">Incident</span>}
        {place.mark === "busy" && <span className="tag">Being investigated</span>}
        {guided ? (
          <span className="menu-map-card-note muted">Finish the guide to use these shortcuts.</span>
        ) : (
          <>
            <span className="btn-row">
              {place.kind === "equipment" && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    store.select(place.equipment!);
                    store.focusCamera(place.equipment!);
                    store.openView(null);
                  }}
                >
                  <Icon name="camera" size={16} />Show in room
                </button>
              )}
              {place.kind !== "equipment" && place.floor !== roomFloor && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    store.goToFloor(place.floor, "map");
                    store.openView(null);
                  }}
                >
                  <Icon name="camera" size={16} />Show in room
                </button>
              )}
              <button
                type="button"
                className="btn"
                disabled={!canWalk || place.floor !== floor}
                onClick={() => {
                  if (walkTo(place.x, place.z)) {
                    useGame.getState().noteMapWalk();
                    useGame.getState().openView(null);
                  } else useGame.getState().notify("There is no way to walk there.", "info");
                }}
              >
                <Icon name="walk" size={16} />Walk here
              </button>
            </span>
            {(!canWalk || place.floor !== floor) && <span className="menu-map-card-note muted">Turn on Walk mode on this floor to walk here.</span>}
          </>
        )}
        <button type="button" className="icon-btn" aria-label="Clear selection" onClick={() => setPicked(null)}>
          <Icon name="close" />
        </button>
      </div>
    );
  };

  return (
    <section className="menu-map" aria-label="Floor plan">
      <div className="menu-map-head">
        <div className="menu-map-floors" role="group" aria-label="Map floor">
          {FLOORS.map((f) => (
            <button key={f} type="button" aria-pressed={f === floor} onClick={() => showFloor(f)}>
              <span className="floor-number" aria-hidden="true">
                {FLOOR_NUMBER[f]}
              </span>
              {FLOOR_NAME[f]}
              {f !== floor && attention[f] !== "none" && (
                <span className={`floor-badge tone-${attention[f]}`}>
                  <span className="visually-hidden">{attention[f] === "alert" ? ", incident here" : ", needs a look"}</span>
                </span>
              )}
            </button>
          ))}
        </div>
        <p className="menu-map-you" aria-live="polite">
          <Icon name="locate" size={16} />
          <strong>You are here:</strong> {where}
        </p>
      </div>
      <div className="menu-map-tools">
        <label className="field menu-map-find">
          <span className="visually-hidden">Find on the map</span>
          <input type="search" value={query} placeholder="Find a place or equipment" onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="menu-map-show">
          <span className="menu-map-show-label">Show</span>
          <div className="menu-map-layers" role="group" aria-label="Show on the map">
            {LAYERS.map(([id, label, icon]) => (
              <button
                key={id}
                type="button"
                className="menu-map-layer"
                aria-pressed={layers[id]}
                onClick={() => setLayers((l) => ({ ...l, [id]: !l[id] }))}
                {...tipProps(`Show ${label.toLowerCase()} on the plan`)}
              >
                <Icon name={layers[id] ? "check" : icon} size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div
        className={`menu-map-frame${view.k > 1 ? " is-zoomed" : ""}${panning ? " is-panning" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <svg ref={svgRef} className="menu-map-plan" viewBox={`${box.x.toFixed(2)} ${box.y.toFixed(2)} ${box.w.toFixed(2)} ${box.h.toFixed(2)}`} aria-hidden="true" onClick={onClick}>
          <defs>
            <pattern id={gridId} width={1} height={1} patternUnits="userSpaceOnUse">
              <path d="M1 0H0V1" />
            </pattern>
          </defs>
          <Plan floor={floor} racks={racks} zoneClass={(zone) => (zone.tone === null ? "is-elevator" : `kind-${zoneKindOf(zone.name)}`)} />
          <rect className="map-grid" x={ROOM.x0} y={ROOM.z0} width={ROOM.w} height={ROOM.d} fill={`url(#${gridId})`} />
          {layers.names && (
            <g className="map-names">
              {zoneNamesOn(floor)
                .filter(([n]) => !labels.hidden.has(n))
                .map(([n, , z]) => {
                  const fb = fixed.find((f) => f.key === n)!;
                  return (
                    <text key={n} x={(fb.box.x + fb.box.w / 2) * s + box.x} y={z} style={{ fontSize: 12 * s }}>
                      {n}
                    </text>
                  );
                })}
            </g>
          )}
          {layers.people && (
            <g className="map-crew">
              {crew.map(([x, z], i) => (
                <circle key={i} cx={x} cy={z} r={5 * s} />
              ))}
            </g>
          )}
          {funPins.map(pin)}
          {equipmentPins.map(pin)}
          {layers.names &&
            (() => {
              const lab = labels.placed.get(`zone:${floor}:Elevator`);
              if (!lab) return null;
              const [px, py] = toPx(ELEVATOR_CENTRE[0], ELEVATOR_CENTRE[1]);
              return (
                <g transform={`translate(${ELEVATOR_CENTRE[0]} ${ELEVATOR_CENTRE[1]}) scale(${s})`}>
                  <text className="map-pin-label is-quiet" x={lab.box.x + lab.box.w / 2 - px} y={lab.box.y + 2 - py} style={{ fontSize: 12 }}>
                    Elevator
                  </text>
                </g>
              );
            })()}
          {layers.people && a.floor === floor && !a.to && (
            <g className="map-avatar" transform={`translate(${a.x} ${a.z}) scale(${s})`}>
              <circle className="map-you-pulse" r={14} />
              <g transform={`rotate(${(-a.yaw * 180) / Math.PI}) scale(1.3)`}>
                <circle r={11} />
                <path d="M0 -9 L7 6 L0 2.5 L-7 6 Z" />
              </g>
              {(() => {
                const lab = labels.placed.get("you");
                if (!lab) return null;
                const [px, py] = toPx(a.x, a.z);
                return (
                  <text className="map-pin-label" x={lab.box.x + lab.box.w / 2 - px} y={lab.box.y + 2 - py} style={{ fontSize: 12 }}>
                    You
                  </text>
                );
              })()}
            </g>
          )}
          {picked !== null && "spot" in picked && picked.spot.floor === floor && (
            <circle className="map-destination" cx={picked.spot.x} cy={picked.spot.z} r={8 * s} style={{ strokeWidth: 2.5 * s }} />
          )}
        </svg>
        <div className="menu-map-zoom" role="group" aria-label="Map zoom">
          <button type="button" className="icon-btn" aria-label="Zoom in" disabled={view.k >= MAP_ZOOM.max} onClick={() => setView((v) => zoomView(v, MAP_ZOOM.step))} {...tipProps("Zoom in")}>
            <Icon name="plus" size={18} />
          </button>
          <button type="button" className="icon-btn" aria-label="Zoom out" disabled={view.k <= MAP_ZOOM.min} onClick={() => setView((v) => zoomView(v, 1 / MAP_ZOOM.step))} {...tipProps("Zoom out")}>
            <Icon name="minus" size={18} />
          </button>
          <button type="button" className="icon-btn" aria-label="Fit the floor" onClick={() => setView(HOME_VIEW)} {...tipProps("Fit the whole floor")}>
            <Icon name="fit" size={18} />
          </button>
          <button type="button" className="icon-btn" aria-label="Centre on you" disabled={a.to !== null} onClick={centreOnYou} {...tipProps("Centre on you")}>
            <Icon name="locate" size={18} />
          </button>
        </div>
        <div className="menu-map-scale" aria-hidden="true">
          <i style={{ width: 5 / s }} />
          <span>5 m</span>
        </div>
        <p className="menu-map-hint">Drag to move, scroll to zoom</p>
      </div>
      <ul className="menu-map-legend" aria-label="Legend">
        {KIND_ORDER.map((k) => (
          <li key={k}>
            <i className={`menu-map-swatch kind-${k}`} aria-hidden="true" />
            {ZONE_KIND_NAME[k]}
          </li>
        ))}
        {layers.equipment && (
          <li>
            <svg viewBox="-16 -16 32 32" className="menu-map-legend-sym" aria-hidden="true">
              <g className="map-pin kind-equipment state-ok">
                <rect x={-10} y={-10} width={20} height={20} rx={5} />
              </g>
            </svg>
            Equipment
          </li>
        )}
        {layers.fun && (
          <li>
            <svg viewBox="-16 -16 32 32" className="menu-map-legend-sym" aria-hidden="true">
              <g className="map-pin kind-fun">
                <circle r={9} />
              </g>
            </svg>
            Thing to do
          </li>
        )}
        {layers.people && (
          <>
            <li>
              <svg viewBox="-16 -16 32 32" className="menu-map-legend-sym" aria-hidden="true">
                <g className="map-crew">
                  <circle r={5} />
                </g>
              </svg>
              Person
            </li>
            <li>
              <svg viewBox="-16 -16 32 32" className="menu-map-legend-sym" aria-hidden="true">
                <g className="map-avatar">
                  <path d="M0 -9 L7 6 L0 2.5 L-7 6 Z" />
                </g>
              </svg>
              You
            </li>
          </>
        )}
        <li>
          <svg viewBox="-16 -16 32 32" className="menu-map-legend-sym" aria-hidden="true">
            <g className="map-pin mark-alert">
              <g className="map-pin-mark">
                <circle r={7} />
                <text y={2.5}>!</text>
              </g>
            </g>
          </svg>
          Incident
        </li>
      </ul>
      {card()}
      {matches === null ? (
        <section className="menu-section" aria-label="Places on this floor">
          {layers.equipment && (
            <>
              <h4>Equipment ({places.filter((p) => p.kind === "equipment").length})</h4>
              <div className="chips">{places.filter((p) => p.kind === "equipment").map(chipFor)}</div>
            </>
          )}
          <h4>Places ({places.filter((p) => p.kind === "zone").length})</h4>
          <div className="chips">{places.filter((p) => p.kind === "zone").map(chipFor)}</div>
          {floor === "office" && layers.fun && (
            <>
              <h4>Things to do ({places.filter((p) => p.kind === "fun").length})</h4>
              <div className="chips">{places.filter((p) => p.kind === "fun").map(chipFor)}</div>
            </>
          )}
        </section>
      ) : (
        <section className="menu-section" aria-label="Matches">
          <div className="chips">{shown!.map(chipFor)}</div>
          {shown!.length === 0 && <p className="menu-note">Nothing called “{query.trim()}” on either floor.</p>}
        </section>
      )}
    </section>
  );
}
