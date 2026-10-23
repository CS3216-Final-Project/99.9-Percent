import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useGame } from "@/game/store";
import type { Floor } from "@/game/floors";
import type { EquipmentId } from "@/sim";
import type { Footprint } from "./layout";
import { GHOST } from "./palette";
import { beamTargets, type BeamTarget } from "./spotSpec";
import type { FloorLayout } from "./trafficLayout";

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

const BEAM_TOP = 4.4;

function Beam({ at }: { at: BeamTarget }) {
  const beam = useRef<THREE.MeshBasicMaterial>(null);
  const still = useMemo(() => reducedMotion(), []);
  useFrame(({ clock }) => {
    if (beam.current && !still) beam.current.opacity = 0.13 + 0.05 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.2));
  });
  const r = Math.max(at.w, at.d) / 2;
  return (
    <group position={[at.x, 0, at.z]}>
      <mesh position={[0, BEAM_TOP / 2, 0]} renderOrder={3}>
        <cylinderGeometry args={[r * 0.72, r, BEAM_TOP, 24, 1, true]} />
        <meshBasicMaterial ref={beam} color={GHOST.add} transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} renderOrder={3}>
        <ringGeometry args={[r * 0.82, r * 0.97, 40]} />
        <meshBasicMaterial color={GHOST.add} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** The light beams and pad rings the guidance spotlight drops on the machines it names. */
export function SpotBeams({ floor, footprints, layout }: { floor: Floor; footprints: Record<EquipmentId, Footprint>; layout: FloorLayout }) {
  const spot = useGame(s => s.spotlight);
  const targets = useMemo(() => beamTargets(spot, footprints, layout).filter(t => t.floor === floor), [spot, footprints, layout, floor]);
  return <>{targets.map((t, i) => <Beam key={`${t.x}:${t.z}:${i}`} at={t} />)}</>;
}

const PATH_RING = new THREE.MeshBasicMaterial({ color: GHOST.path, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false });
const PATH_PAD = new THREE.MeshBasicMaterial({ color: GHOST.path, transparent: true, opacity: 0.26, depthWrite: false, toneMapped: false });

/**
 * Guided Mode's server room highlight: a steady glow on the floor under every machine the requests pass through,
 * so the request path reads at a glance among the room's furnishing. It never pulses; the spotlight's beams do.
 */
export function PathGlow({ footprints, layout, cache }: { footprints: Record<EquipmentId, Footprint>; layout: FloorLayout; cache: boolean }) {
  const targets = useMemo(() => beamTargets(["gateway", "app", "db", ...(cache ? ["cache"] : [])], footprints, layout).filter(t => t.floor === "servers"), [footprints, layout, cache]);
  return <>{targets.map((t, i) => (
    <group key={`${t.x}:${t.z}:${i}`} position={[t.x, 0.03, t.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh material={PATH_PAD} renderOrder={2}><planeGeometry args={[t.w + 0.5, t.d + 0.5]} /></mesh>
      <mesh material={PATH_RING} renderOrder={2}><ringGeometry args={[Math.max(t.w, t.d) / 2 + 0.2, Math.max(t.w, t.d) / 2 + 0.32, 40]} /></mesh>
    </group>
  ))}</>;
}
