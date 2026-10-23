import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Campaign } from "@/sim/campaignTypes";
import { TRAFFIC } from "./palette";
import { trafficModel, type TrafficKind } from "./traffic";
import { dots, edgePath, INTERNET_RUN, nodePoint, packetSpeed, pathLength, pointAt, type FloorLayout, type P2 } from "./trafficLayout";

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** A cable on the floor. Its dots stand for requests: their number is the volume, their speed the latency. */
function FlowCable({ points, rate, kind, speed }: { points: P2[]; rate: number; kind: TrafficKind | "idle"; speed: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const total = useMemo(() => pathLength(points), [points]);
  const count = kind === "idle" ? 0 : dots(rate);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const still = useMemo(() => reducedMotion(), []);
  const color = kind === "idle" ? TRAFFIC.idle : TRAFFIC[kind];

  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m || !count || total <= 0) return;
    const run = still ? 0 : clock.elapsedTime * speed;
    for (let i = 0; i < count; i++) {
      let d = (run + (i * total) / count) % (kind === "turned" ? 2 * total : total);
      // Turned-away requests reach the gateway and bounce back out.
      if (d > total) d = 2 * total - d;
      const [x, z] = pointAt(points, d);
      dummy.position.set(x, 0.08, z);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  const segments = useMemo(() => points.slice(1).map((b, i) => ({ a: points[i], b, len: Math.hypot(b[0] - points[i][0], b[1] - points[i][1]) })).filter(s => s.len > 0.01), [points]);
  return (
    <group>
      {segments.map((s, i) => {
        const horizontal = Math.abs(s.b[0] - s.a[0]) > Math.abs(s.b[1] - s.a[1]);
        return (
          <mesh key={i} receiveShadow position={[(s.a[0] + s.b[0]) / 2, 0.025, (s.a[1] + s.b[1]) / 2]}>
            <boxGeometry args={horizontal ? [s.len + 0.2, 0.05, 0.2] : [0.2, 0.05, s.len + 0.2]} />
            <meshStandardMaterial color={TRAFFIC.cable} emissive={color} emissiveIntensity={kind === "idle" ? 0 : 0.12} roughness={0.8} transparent={kind === "idle"} opacity={kind === "idle" ? 0.45 : 1} />
          </mesh>
        );
      })}
      {count > 0 && (
        <instancedMesh ref={mesh} args={[undefined, undefined, count]} key={count}>
          <boxGeometry args={[0.2, 0.08, 0.2]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </instancedMesh>
      )}
    </group>
  );
}

/** Lost requests: dots tipping off the machine that lost them — red when shed, orange when turned away at the door. */
function Drops({ at, rate, color = TRAFFIC.dropped }: { at: P2; rate: number; color?: string }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const count = Math.min(24, dots(rate));
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const still = useMemo(() => reducedMotion(), []);
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    for (let i = 0; i < count; i++) {
      const p = still ? 0.5 : (clock.elapsedTime * 0.7 + i / count) % 1;
      const a = (i * 2.399) % (Math.PI * 2);
      dummy.position.set(at[0] + Math.cos(a) * 0.55 * p, 0.95 * (1 - p * p) + 0.04, at[1] + Math.sin(a) * 0.55 * p);
      dummy.scale.setScalar(1 - 0.7 * p);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  if (!count) return null;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[at[0], 0.03, at[1]]}>
        <circleGeometry args={[0.6, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.28} toneMapped={false} depthWrite={false} />
      </mesh>
      <instancedMesh ref={mesh} args={[undefined, undefined, count]} key={count}>
        <boxGeometry args={[0.2, 0.2, 0.2]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/** Waiting work: a pile of boxes in front of the machine, one for each twelfth of a full queue. */
function Queue({ at, backlog, capacity }: { at: P2; backlog: number; capacity: number }) {
  const boxes = Math.min(12, Math.ceil((12 * backlog) / Math.max(1, capacity)));
  return (
    <group position={[at[0], 0, at[1]]}>
      {Array.from({ length: boxes }, (_, i) => {
        const layer = Math.floor(i / 6), k = i % 6;
        return (
          <mesh key={i} castShadow position={[((k % 3) - 1) * 0.24, 0.1 + layer * 0.2, (Math.floor(k / 3) - 0.5) * 0.24]}>
            <boxGeometry args={[0.2, 0.18, 0.2]} />
            <meshStandardMaterial color={TRAFFIC.queue} roughness={0.7} />
          </mesh>
        );
      })}
    </group>
  );
}

/** The In and Out gates: frames on the hall's west wall and by its east door, lit in their traffic colours. */
export function Gate({ at, kind }: { at: { x: number; z: number }; kind: "in" | "out" }) {
  const glow = kind === "in" ? TRAFFIC.flow : TRAFFIC.served;
  return (
    <group position={[at.x, 0, at.z]}>
      {[-0.7, 0.7].map(dz => (
        <mesh key={dz} castShadow position={[0, 1.1, dz]}>
          <boxGeometry args={[0.18, 2.2, 0.18]} />
          <meshStandardMaterial color={TRAFFIC.gate} roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 2.25, 0]}>
        <boxGeometry args={[0.18, 0.18, 1.58]} />
        <meshStandardMaterial color={TRAFFIC.gate} emissive={glow} emissiveIntensity={0.9} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <planeGeometry args={[0.9, 1.4]} />
        <meshBasicMaterial color={glow} transparent opacity={0.35} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

/**
 * The campaign's requests on the server floor: what enters at In, where it is turned away, which servers carry it,
 * where it waits or is lost, and what reaches Out. Drawn from the recorded snapshot only.
 */
export function CampaignTraffic({ campaign, layout }: { campaign: Campaign; layout: FloorLayout }) {
  const t = useMemo(() => trafficModel(campaign), [campaign]);
  const speed = packetSpeed(campaign.snapshot.latencyMs);
  // A server's two links to the data tier share the trunk; draw the totals once each, not a cable per server.
  const merged = useMemo(() => {
    const out: { key: string; points: P2[]; rate: number; kind: TrafficKind }[] = [];
    const toData = { db: 0, cache: 0 };
    let dataPath: { db?: P2[]; cache?: P2[] } = {};
    for (const e of t.edges) {
      if (e.to === "db" || e.to === "cache") {
        toData[e.to] += e.rate;
        // The longest path, from the farthest server, carries the whole trunk.
        const p = edgePath(e, layout), have = dataPath[e.to];
        if (p && (!have || pathLength(p) > pathLength(have))) dataPath = { ...dataPath, [e.to]: p };
        continue;
      }
      const p = edgePath(e, layout);
      if (p) out.push({ key: `${e.from}>${e.to}:${e.kind}`, points: p, rate: e.rate, kind: e.kind });
    }
    for (const to of ["db", "cache"] as const) if (dataPath[to]) out.push({ key: `apps>${to}`, points: dataPath[to]!, rate: toData[to], kind: "flow" });
    return out;
  }, [t, layout]);
  // Failures hidden behind the door arrive there from several machines; show them as one pile.
  const drops = useMemo(() => [...t.drops.reduce((m, d) => m.set(`${d.at}:${d.tone ?? "dropped"}`, { at: d.at, rate: (m.get(`${d.at}:${d.tone ?? "dropped"}`)?.rate ?? 0) + d.rate, tone: d.tone }), new Map<string, { at: string; rate: number; tone?: string }>())], [t]);
  const idle = useMemo(() => t.dimmed.map(id => ({ id, points: edgePath({ from: "gateway", to: id }, layout) })).filter(x => x.points), [t, layout]);
  return (
    <group>
      <FlowCable points={INTERNET_RUN} rate={0} kind="idle" speed={0} />
      {merged.map(e => <FlowCable key={e.key} points={e.points} rate={e.rate} kind={e.kind} speed={speed} />)}
      {idle.map(x => <FlowCable key={`idle:${x.id}`} points={x.points!} rate={0} kind="idle" speed={0} />)}
      {t.queues.map(q => {
        const at = nodePoint(q.at, layout);
        return at ? <Queue key={`q:${q.at}`} at={at} backlog={q.backlog} capacity={q.capacity} /> : null;
      })}
      {drops.map(([key, d]) => {
        const at = nodePoint(d.at, layout);
        return at ? <Drops key={`d:${key}`} at={at} rate={d.rate} color={d.tone === "turned" ? TRAFFIC.turned : undefined} /> : null;
      })}
    </group>
  );
}
