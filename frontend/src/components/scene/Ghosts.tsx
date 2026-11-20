import { Edges, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useGame } from "@/game/store";
import type { Campaign } from "@/sim/campaignTypes";
import { changeOf, changeOfScheduled, ghostParts, installing, type GhostPart, type GhostTone } from "./ghostSpec";
import { GHOST } from "./palette";
import type { FloorLayout } from "./trafficLayout";

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** Opacity that breathes while the player considers a change, and holds steady once it is paid for. */
function useBreath<T extends THREE.Material>(base: number, flashing: boolean) {
  const material = useRef<T>(null);
  const still = useMemo(() => reducedMotion(), []);
  useFrame(({ clock }) => {
    if (!material.current) return;
    material.current.opacity = flashing && !still ? base * (0.55 + 0.45 * Math.sin(clock.elapsedTime * 5.5) ** 2) : base;
  });
  return material;
}

function GhostRack({ part, flashing }: { part: Extract<GhostPart, { type: "rack" }>; flashing: boolean }) {
  const material = useBreath<THREE.MeshBasicMaterial>(flashing ? 0.62 : 0.42, flashing);
  const color = flashing ? GHOST.flash : GHOST[part.tone];
  return (
    <mesh position={[part.x, part.h / 2, part.z]} renderOrder={2}>
      <boxGeometry args={[part.w, part.h, part.d]} />
      <meshBasicMaterial ref={material} color={color} transparent opacity={0.42} depthWrite={false} toneMapped={false} />
      <Edges color={color} />
    </mesh>
  );
}

function GhostCable({ points, tone, flashing }: { points: [number, number][]; tone: GhostTone; flashing: boolean }) {
  const cableColor = flashing ? GHOST.flash : GHOST[tone];
  const line = useRef<{ material: { dashOffset: number } } | null>(null);
  const still = useMemo(() => reducedMotion(), []);
  useFrame((_, dt) => {
    if (line.current && flashing && !still) line.current.material.dashOffset -= dt * 1.4;
  });
  const pts = useMemo(() => points.map(([x, z]) => [x, 0.09, z] as [number, number, number]), [points]);
  return <Line ref={line as never} points={pts} color={cableColor} lineWidth={3} dashed dashSize={0.35} gapSize={0.22} transparent opacity={0.95} />;
}

/** The traffic limit: a low firewall of bricks across the aisle. */
function GhostWall({ part, flashing }: { part: Extract<GhostPart, { type: "wall" }>; flashing: boolean }) {
  const material = useBreath<THREE.MeshBasicMaterial>(0.6, flashing);
  const bricks = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let row = 0; row < 3; row++) for (let k = 0; k < 4; k++) out.push([0, 0.16 + row * 0.3, -0.75 + k * 0.5 + (row % 2) * 0.25]);
    return out;
  }, []);
  return (
    <group position={[part.x, 0, part.z]}>
      {bricks.map((p, i) => (
        <mesh key={i} position={p} renderOrder={2}>
          <boxGeometry args={[0.28, 0.26, 0.46]} />
          <meshBasicMaterial ref={i === 0 ? material : undefined} color={flashing ? GHOST.flash : part.tone === "add" ? GHOST.wall : GHOST.remove} transparent opacity={0.6} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** A ring that swells from a server's foot: a repair, a probe or a spare set aside. */
function GhostPulse({ part, flashing }: { part: Extract<GhostPart, { type: "pulse" }>; flashing: boolean }) {
  const ring = useRef<THREE.Mesh>(null);
  const still = useMemo(() => reducedMotion(), []);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const p = still ? 0.6 : (clock.elapsedTime * (flashing ? 1.4 : 0.8)) % 1;
    ring.current.scale.setScalar(0.5 + p);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - p);
  });
  return (
    <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[part.x, 0.05, part.z]}>
      <ringGeometry args={[0.7, 0.85, 40]} />
      <meshBasicMaterial color={flashing ? GHOST.flash : GHOST[part.tone]} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function Part({ part, flashing }: { part: GhostPart; flashing: boolean }) {
  switch (part.type) {
    case "rack": return <GhostRack part={part} flashing={flashing} />;
    case "cable": return <GhostCable points={part.points} tone={part.tone} flashing={flashing} />;
    case "wall": return <GhostWall part={part} flashing={flashing} />;
    case "pulse": return <GhostPulse part={part} flashing={flashing} />;
  }
}

/** A progress ring on the floor under an installing change, filling until it activates. */
function Progress({ x, z, progress }: { x: number; z: number; progress: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.06, z]}>
      <ringGeometry args={[0.72, 0.86, 40, 1, Math.PI / 2, -Math.PI * 2 * Math.max(0.02, progress)]} />
      <meshBasicMaterial color={GHOST.add} transparent opacity={0.9} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

const anchorOf = (parts: GhostPart[]) => {
  const p = parts.find(x => x.type !== "cable") ?? parts[0];
  if (!p) return null;
  return p.type === "cable" ? { x: p.points.at(-1)![0], z: p.points.at(-1)![1] } : { x: p.x, z: p.z };
};

/**
 * Ghosts of changes in the room: the one the player is pointing at or confirming flashes in gold, changes already
 * paid for stand steady with a progress ring. Completed changes are handled by MachineFeedback.
 */
export function Ghosts({ campaign, layout }: { campaign: Campaign; layout: FloorLayout }) {
  const previewAction = useGame(s => s.previewAction);
  const preview = useMemo(() => {
    const change = previewAction ? changeOf(previewAction, campaign) : null;
    const extra = campaign.pending.filter(a => a.cancelledStep === undefined && (a.type === "add-app" || a.type === "create-spare")).length;
    return change ? ghostParts(change, campaign, layout, extra) : [];
  }, [previewAction, campaign, layout]);
  const pending = useMemo(() => installing(campaign).map(x => {
    const parts = ghostParts(changeOfScheduled(x.action), campaign, layout, x.extraApps);
    return { id: x.action.id, parts, progress: x.progress, at: anchorOf(parts) };
  }), [campaign, layout]);
  return (
    <group>
      {preview.map((part, i) => <Part key={`p${i}`} part={part} flashing />)}
      {pending.map(p => (
        <group key={p.id}>
          {p.parts.map((part, i) => <Part key={i} part={part} flashing={false} />)}
          {p.at && <Progress x={p.at.x} z={p.at.z} progress={p.progress} />}
        </group>
      ))}
    </group>
  );
}
