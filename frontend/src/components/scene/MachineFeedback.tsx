import { useContext, useEffect, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GHOST } from "./palette";
import { machineScale, MACHINE_POP_SECONDS } from "./machineCues";
import { MachineFeedbackContext as Context, type Feedback } from "./useMachineFeedback";
import "./MachineFeedback.css";

/** First rendered frame starts each cue, so a busy renderer doesn't consume it while compiling. */
export function MachineFeedbackClock() {
  const { active } = useContext(Context);
  useFrame(({ clock }) => {
    for (const [id, cue] of active) {
      cue.born ??= clock.elapsedTime;
      if (clock.elapsedTime - cue.born >= MACHINE_POP_SECONDS) active.delete(id);
    }
  });
  useEffect(() => () => active.clear(), [active]);
  return null;
}

/** The hardware stays planted on its original footprint; only this visual child stretches. */
export function MachineMotion({ id, position, height, children }: { id: string; position: [number, number, number]; height: number; children: ReactNode }) {
  const { active, reduced } = useContext(Context);
  const body = useRef<THREE.Group>(null), fx = useRef<THREE.Group>(null), ring = useRef<THREE.Mesh>(null), sparks = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!body.current || !fx.current) return;
    const cue = active.get(id);
    const age = cue ? clock.elapsedTime - (cue.born ??= clock.elapsedTime) : MACHINE_POP_SECONDS;
    const visible = !!cue && age < MACHINE_POP_SECONDS;
    if (cue) body.current.scale.set(...machineScale(cue.kind, age, reduced));
    else body.current.scale.setScalar(1);
    fx.current.visible = visible;
    if (!visible) return;
    const p = age / MACHINE_POP_SECONDS;
    if (ring.current) {
      ring.current.scale.setScalar(reduced ? 1 : 0.65 + p * 1.5);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = reduced ? 0.8 : (1 - p) * 0.9;
    }
    if (sparks.current) {
      sparks.current.visible = !reduced;
      sparks.current.position.y = height * Math.max(1, body.current.scale.y) + 0.25 + p * 0.4;
      sparks.current.scale.setScalar(Math.sin(Math.PI * p) * 0.9);
    }
  });
  return <group position={position}>
    <group ref={body} name={`machine:${id}`}>{children}</group>
    <group ref={fx} visible={false}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]} raycast={() => undefined}>
        <ringGeometry args={[0.65, 0.78, 32]}/><meshBasicMaterial color={GHOST.done} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={sparks}>
        {[[-0.65, 0, -0.15], [0.65, 0, 0.15], [0, 0.3, 0.45]].map((p, i) => <mesh key={i} position={p as [number, number, number]} raycast={() => undefined}>
          <octahedronGeometry args={[0.13, 0]}/><meshBasicMaterial color={GHOST.add} toneMapped={false}/>
        </mesh>)}
      </group>
    </group>
  </group>;
}

/** A tiny number/label above the existing equipment button; it never intercepts a click. */
export function MachineChangeNote({ id, fleet = false }: { id: string; fleet?: boolean }) {
  const { active, latest } = useContext(Context);
  const cue = latest.find(c => c.label === id || (fleet && c.label.startsWith("app-")));
  const current = cue && cue.targets.some(target => active.get(target)?.id === cue.id);
  return current ? <span key={cue.id} className="machine-change-note" aria-hidden="true">{cue.kind === "grow" ? "↑ " : "✦ "}{cue.badge}</span> : null;
}

export function MachineFeedbackAnnouncement({ feedback }: { feedback: Feedback }) {
  return <span className="visually-hidden" role="status" aria-label="Machine activation" aria-live="polite" aria-atomic="true">
    <span key={feedback.latest.map(c => c.id).join(":")}>{feedback.latest.map(c => c.announcement).join(" ")}</span>
  </span>;
}
