"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useGame } from "@/game/store";
import type { Activity } from "./cast";
import { Creature } from "./creatures";
import { standing } from "./crewSpots";
import { FLOOR_Y } from "./levels";
import { now, shownFloor } from "./ride";
import { carY, onErrandEnd } from "./trips";
import { bothFloors, SHAFT_CLIP } from "./viewState";
import { errandEnded, PACE, populate, stepVisitors, visitors, type Visitor } from "./crowd";

/*
 * The people about the building (crowd.ts): stepped once a frame here and each drawn as a creature, on the floor
 * it stands on, or in the elevator's car at the car's height. One floor is drawn at a time, so those on the other
 * are hidden but carry on. They show on the map with the crew.
 */

/** The same people on every visit, so a reload does not reshuffle the building. */
const SEED = 9_999;

export function Visitors({ count }: { count: number }) {
  // The same crowd carries on through a remount; only a new number of people starts afresh.
  const people = useMemo(() => {
    if (visitors().length !== count) populate(count, SEED);
    return visitors().slice();
  }, [count]);
  useEffect(() => onErrandEnd(errandEnded), []);
  useFrame((_, dt) => {
    const s = useGame.getState();
    stepVisitors(dt, now(), s.walking && s.started);
  });
  return (
    <>
      {people.map((v) => (
        <Person key={`${count}-${v.id}`} visitor={v} />
      ))}
    </>
  );
}

function Person({ visitor: v }: { visitor: Visitor }) {
  const g = useRef<THREE.Group>(null);
  const [activity, setActivity] = useState<Activity>(v.activity);
  const shown = useRef(activity);
  useEffect(() => (g.current ? standing(g.current) : undefined), []);
  useFrame(() => {
    const aboard = v.doing === "aboard";
    if (g.current) {
      g.current.position.set(v.x, aboard ? carY() : FLOOR_Y[v.floor], v.z);
      g.current.rotation.y = v.yaw;
      // Riders go where the car goes, cut to the part of the shaft in view like the car itself.
      g.current.visible = aboard || bothFloors() || v.floor === shownFloor();
    }
    const doing: Activity = v.moving ? "walk" : v.doing === "linger" ? v.activity : "idle";
    if (doing !== shown.current) {
      shown.current = doing;
      setActivity(doing);
    }
  });
  return (
    <group ref={g}>
      <Creature species={v.species} activity={activity} position={[0, 0, 0]} phase={v.id * 1.7} pace={PACE.walk} clip={SHAFT_CLIP} />
    </group>
  );
}
