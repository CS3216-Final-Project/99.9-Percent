import * as THREE from "three";

/**
 * Small procedural textures drawn on canvases. They give the racks and screens
 * believable detail without shipping any image assets.
 */

export type PanelVariant = "server" | "db" | "network" | "cache" | "storage";
export type Led = "ok" | "warn" | "critical" | "off" | "standby" | "temp";

export const LED_COLORS: Record<Led, string> = {
  ok: "#3ddc84",
  warn: "#ff9f1a",
  critical: "#ff4d5e",
  off: "#2a2547",
  standby: "#ffc53d",
  temp: "#4cb8ff",
};

interface PanelTextures {
  map: THREE.CanvasTexture;
  emissive: THREE.CanvasTexture;
}

const panelCache = new Map<string, PanelTextures>();
const screenCache = new Map<string, THREE.CanvasTexture>();
let floorTexture: THREE.CanvasTexture | null = null;

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d") as CanvasRenderingContext2D];
}

/** Deterministic pseudo-random so textures look the same on every load. */
function noise(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function finish(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  // Up close the textures stay blocky, like the interface's pixel icons.
  t.magFilter = THREE.NearestFilter;
  return t;
}

export function panelTextures(variant: PanelVariant, led: Led): PanelTextures {
  const key = `${variant}:${led}`;
  const hit = panelCache.get(key);
  if (hit) return hit;

  const W = 128;
  const H = 256;
  const [mc, m] = canvas(W, H);
  const [ec, e] = canvas(W, H);
  const color = LED_COLORS[led];
  const lit = led !== "off";

  m.fillStyle = "#1b1736";
  m.fillRect(0, 0, W, H);
  e.fillStyle = "#000";
  e.fillRect(0, 0, W, H);

  const dot = (x: number, y: number, r: number, c: string) => {
    m.fillStyle = c;
    m.beginPath();
    m.arc(x, y, r, 0, Math.PI * 2);
    m.fill();
    if (lit) {
      e.fillStyle = c;
      e.beginPath();
      e.arc(x, y, r + 0.6, 0, Math.PI * 2);
      e.fill();
    }
  };

  if (variant === "server") {
    const units = 11;
    const uh = (H - 12) / units;
    for (let i = 0; i < units; i++) {
      const y = 6 + i * uh;
      m.fillStyle = "#2f2a55";
      m.fillRect(6, y + 1, W - 12, uh - 3);
      m.fillStyle = "#221e42";
      for (let v = 0; v < 14; v++) m.fillRect(12 + v * 5, y + 5, 2.5, uh - 11);
      m.fillStyle = "#3e3870";
      m.fillRect(6, y + 1, W - 12, 1.5);
      dot(W - 18, y + uh / 2, 2.6, color);
      if (noise(i) > 0.35) dot(W - 28, y + uh / 2, 1.8, lit ? "#4cb8ff" : "#2a2547");
    }
  } else if (variant === "db" || variant === "storage") {
    const cols = variant === "db" ? 3 : 4;
    const rows = variant === "db" ? 7 : 4;
    const cw = (W - 14) / cols;
    const rh = (H - 14) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c2 = 0; c2 < cols; c2++) {
        const x = 7 + c2 * cw;
        const y = 7 + r * rh;
        m.fillStyle = "#322c5c";
        m.fillRect(x + 1.5, y + 1.5, cw - 3, rh - 3);
        m.fillStyle = "#211c40";
        m.fillRect(x + 5, y + rh * 0.3, cw - 10, rh * 0.42);
        m.fillStyle = "#463f7a";
        m.fillRect(x + 1.5, y + 1.5, cw - 3, 1.5);
        dot(x + cw - 8, y + rh - 8, 2.2, color);
      }
    }
  } else if (variant === "network") {
    const rows = 9;
    const rh = (H - 12) / rows;
    for (let r = 0; r < rows; r++) {
      const y = 6 + r * rh;
      m.fillStyle = "#2c2752";
      m.fillRect(6, y + 1, W - 12, rh - 3);
      for (let p = 0; p < 12; p++) {
        const x = 11 + p * 9;
        m.fillStyle = "#14112a";
        m.fillRect(x, y + rh * 0.42, 6, rh * 0.34);
        const n = noise(r * 31 + p);
        if (n > 0.3) dot(x + 3, y + rh * 0.26, 1.5, n > 0.9 ? LED_COLORS.warn : color);
      }
    }
  } else {
    const units = 5;
    const uh = (H - 12) / units;
    for (let i = 0; i < units; i++) {
      const y = 6 + i * uh;
      m.fillStyle = "#2f2a55";
      m.fillRect(6, y + 1, W - 12, uh - 3);
      for (let b = 0; b < 8; b++) {
        const x = 12 + b * 10;
        m.fillStyle = "#221e42";
        m.fillRect(x, y + 8, 6, uh - 18);
        if (lit && noise(i * 17 + b) > 0.25) {
          m.fillStyle = "#4cb8ff";
          m.fillRect(x + 1, y + uh - 16, 4, 3);
          e.fillStyle = "#4cb8ff";
          e.fillRect(x + 1, y + uh - 16, 4, 3);
        }
      }
      dot(W - 16, y + uh / 2, 2.6, color);
    }
  }

  const out = { map: finish(mc), emissive: finish(ec) };
  panelCache.set(key, out);
  return out;
}

export type ScreenKind = "code" | "idle" | "dash" | "alert" | "chart" | "deploy" | "deploy-busy" | "off";

export function screenTexture(kind: ScreenKind): THREE.CanvasTexture {
  const hit = screenCache.get(kind);
  if (hit) return hit;
  const W = 256;
  const H = 160;
  const [c, g] = canvas(W, H);

  const bg: Record<ScreenKind, string> = {
    code: "#16133a",
    idle: "#100e26",
    dash: "#14123a",
    alert: "#3a0f1e",
    chart: "#14123a",
    deploy: "#10261e",
    "deploy-busy": "#2e1d0a",
    off: "#0a0918",
  };
  g.fillStyle = bg[kind];
  g.fillRect(0, 0, W, H);

  if (kind === "code") {
    const palette = ["#4cb8ff", "#3ddc84", "#ffc53d", "#e8e2ff", "#ff7ad9"];
    for (let i = 0; i < 13; i++) {
      const indent = Math.floor(noise(i) * 4) * 12;
      g.fillStyle = palette[Math.floor(noise(i + 40) * palette.length)];
      g.fillRect(12 + indent, 12 + i * 11, 30 + noise(i + 9) * 130, 4);
    }
  } else if (kind === "idle") {
    g.fillStyle = "#2a2547";
    g.fillRect(W / 2 - 40, H / 2 - 3, 80, 6);
  } else if (kind === "dash" || kind === "alert") {
    const line = kind === "alert" ? "#ff4d5e" : "#3ddc84";
    for (let r = 0; r < 2; r++) {
      for (let col = 0; col < 3; col++) {
        const x = 10 + col * 82;
        const y = 10 + r * 74;
        g.fillStyle = kind === "alert" ? "#4a1630" : "#221e4a";
        g.fillRect(x, y, 72, 64);
        g.strokeStyle = col === 1 && r === 0 ? "#4cb8ff" : line;
        g.lineWidth = 2;
        g.beginPath();
        for (let i = 0; i <= 10; i++) {
          const px = x + 6 + i * 6;
          const base = kind === "alert" ? 44 - i * 3 : 40;
          const py = y + base - noise(r * 50 + col * 13 + i) * 22;
          if (i === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.stroke();
      }
    }
  } else if (kind === "chart") {
    g.strokeStyle = "#2f2a55";
    g.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      g.beginPath();
      g.moveTo(14, i * 30);
      g.lineTo(W - 14, i * 30);
      g.stroke();
    }
    g.strokeStyle = "#ffc53d";
    g.lineWidth = 3;
    g.beginPath();
    for (let i = 0; i <= 12; i++) {
      const px = 16 + i * 18.5;
      const py = H - 22 - Math.pow(i / 12, 1.8) * 105 - noise(i) * 10;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.stroke();
  } else if (kind === "deploy" || kind === "deploy-busy") {
    const c1 = kind === "deploy" ? "#3ddc84" : "#ff9f1a";
    for (let i = 0; i < 5; i++) {
      g.fillStyle = "#1d2a3a";
      g.fillRect(14, 14 + i * 27, W - 28, 18);
      g.fillStyle = i < 3 || kind === "deploy" ? c1 : "#4a3a2a";
      g.fillRect(14, 14 + i * 27, (W - 28) * (kind === "deploy" ? 1 : [1, 1, 0.6, 0.2, 0.1][i]), 18);
    }
  }

  const t = finish(c);
  screenCache.set(kind, t);
  return t;
}

export function floorTiles(): THREE.CanvasTexture {
  if (floorTexture) return floorTexture;
  // A 16-pixel tile drawn pixel by pixel: base, a lit top-left edge and a dark grout line.
  const S = 16;
  const [c, g] = canvas(S, S);
  g.fillStyle = "#544e8c";
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 10; i++) {
    g.fillStyle = noise(i) > 0.5 ? "#5a5494" : "#4f4985";
    g.fillRect(Math.floor(noise(i + 500) * 13) + 1, Math.floor(noise(i + 900) * 13) + 1, 1, 1);
  }
  g.fillStyle = "#615ba0";
  g.fillRect(1, 1, S - 2, 1);
  g.fillRect(1, 1, 1, S - 2);
  g.fillStyle = "#3a3468";
  g.fillRect(0, S - 1, S, 1);
  g.fillRect(S - 1, 0, 1, S);
  const t = finish(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  floorTexture = t;
  return t;
}
