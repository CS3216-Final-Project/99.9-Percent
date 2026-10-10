"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useDetail, type Detail } from "./detail";
import { buildProp, shade, type PropItem, type Sign, type Surface } from "./propModels";

/*
 * Draws the detailed machines built in propModels.ts. Every model of one kind
 * and variant shares one instanced mesh per surface, so all the machines of a
 * kind cost a handful of draw calls together.
 */

/** One material per surface and level of detail. Basic detail stays matte and cheap; HD is physically based. */
const MATERIALS: Record<Surface, Record<Detail, THREE.Material>> = {
  matte: {
    basic: new THREE.MeshLambertMaterial({ vertexColors: true }),
    hd: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0 }),
  },
  gloss: {
    basic: new THREE.MeshLambertMaterial({ vertexColors: true }),
    hd: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.16, metalness: 0 }),
  },
  metal: {
    basic: new THREE.MeshLambertMaterial({ vertexColors: true }),
    hd: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.36, metalness: 0.55 }),
  },
  chrome: {
    basic: new THREE.MeshLambertMaterial({ vertexColors: true }),
    hd: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 1 }),
  },
  glass: {
    basic: new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.3, depthWrite: false }),
    hd: new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.24, roughness: 0.04, metalness: 0, depthWrite: false }),
  },
  glow: {
    basic: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    hd: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  },
};

const UP = new THREE.Vector3(0, 1, 0);

function matrixFor(it: PropItem): THREE.Matrix4 {
  const s = it.s ?? 1;
  return new THREE.Matrix4().compose(new THREE.Vector3(...it.p), new THREE.Quaternion().setFromAxisAngle(UP, it.rot ?? 0), new THREE.Vector3(s, s, s));
}

function PropInstances({ geometry, surface, matrices }: { geometry: THREE.BufferGeometry; surface: Surface; matrices: THREE.Matrix4[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const material = MATERIALS[surface][useDetail()];
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [matrices]);
  const shadows = surface !== "glass" && surface !== "glow";
  return <instancedMesh key={matrices.length} ref={ref} args={[geometry, undefined, matrices.length]} material={material} castShadow={shadows} receiveShadow={surface !== "glow"} />;
}

const signTextures = new Map<string, THREE.CanvasTexture>();

/** A lit sign with lettering, redrawn once the pixel font has loaded. */
function signTexture(sign: Sign): THREE.CanvasTexture {
  const key = `${sign.text}|${sign.bg}|${sign.fg}`;
  const hit = signTextures.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = Math.round((512 * sign.h) / sign.w);
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  const draw = () => {
    const grad = g.createLinearGradient(0, 0, 0, c.height);
    grad.addColorStop(0, shade(sign.bg, 1.5));
    grad.addColorStop(1, sign.bg);
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.shadowColor = sign.fg;
    g.shadowBlur = 12;
    g.fillStyle = sign.fg;
    // As large as the sign is tall, but never wider than nine tenths of it.
    let size = Math.round(c.height * 0.62);
    g.font = `700 ${size}px "Pixelify Sans", sans-serif`;
    const width = g.measureText(sign.text).width;
    if (width > c.width * 0.9) {
      size = Math.floor((size * c.width * 0.9) / width);
      g.font = `700 ${size}px "Pixelify Sans", sans-serif`;
    }
    g.fillText(sign.text, c.width / 2, c.height / 2 + 2);
  };
  draw();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  document.fonts?.load('700 40px "Pixelify Sans"').then(() => {
    draw();
    t.needsUpdate = true;
  });
  signTextures.set(key, t);
  return t;
}

function SignPlane({ sign, item }: { sign: Sign; item: PropItem }) {
  const map = useMemo(() => signTexture(sign), [sign]);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ map, toneMapped: false }), [map]);
  useEffect(() => () => material.dispose(), [material]);
  const s = item.s ?? 1;
  return (
    <group position={item.p} rotation={[0, item.rot ?? 0, 0]} scale={s}>
      <mesh position={sign.p} rotation={[sign.tilt ?? 0, 0, 0]} material={material}>
        <planeGeometry args={[sign.w, sign.h]} />
      </mesh>
    </group>
  );
}

/** Draw detailed props: every model of one kind and variant shares one instanced mesh per surface. */
export function DetailedProps({ items }: { items: PropItem[] }) {
  const groups = useMemo(() => {
    const byKey = new Map<string, PropItem[]>();
    for (const it of items) {
      const key = `${it.kind}:${it.variant ?? ""}`;
      byKey.set(key, [...(byKey.get(key) ?? []), it]);
    }
    return [...byKey].map(([key, list]) => ({ key, list, built: buildProp(list[0].kind, list[0].variant), matrices: list.map(matrixFor) }));
  }, [items]);
  return (
    <group>
      {groups.map((g) => (
        <group key={g.key}>
          {[...g.built.geometries].map(([surface, geometry]) => (
            <PropInstances key={surface} geometry={geometry} surface={surface} matrices={g.matrices} />
          ))}
          {g.built.signs.flatMap((sign, i) => g.list.map((item, j) => <SignPlane key={`${i}-${j}`} sign={sign} item={item} />))}
        </group>
      ))}
    </group>
  );
}
