import * as THREE from "three";

/**
 * Small procedural textures drawn on canvases. They give the racks and screens
 * believable detail without shipping any image assets.
 */

export type PanelVariant = "server" | "db" | "network" | "cache" | "storage";
export type Led = "ok" | "warn" | "critical" | "off" | "standby" | "temp";

export const LED_COLORS: Record<Led, string> = {
  ok: "#62d39a",
  warn: "#f0b040",
  critical: "#ff5a4f",
  off: "#20262c",
  standby: "#d9a441",
  temp: "#6fb4e8",
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

  m.fillStyle = "#12161a";
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
      m.fillStyle = "#2a3139";
      m.fillRect(6, y + 1, W - 12, uh - 3);
      m.fillStyle = "#1a1f25";
      for (let v = 0; v < 14; v++) m.fillRect(12 + v * 5, y + 5, 2.5, uh - 11);
      m.fillStyle = "#353d47";
      m.fillRect(6, y + 1, W - 12, 1.5);
      dot(W - 18, y + uh / 2, 2.6, color);
      if (noise(i) > 0.35) dot(W - 28, y + uh / 2, 1.8, lit ? "#7fb6ff" : "#20262c");
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
        m.fillStyle = "#2b323a";
        m.fillRect(x + 1.5, y + 1.5, cw - 3, rh - 3);
        m.fillStyle = "#1b2026";
        m.fillRect(x + 5, y + rh * 0.3, cw - 10, rh * 0.42);
        m.fillStyle = "#3a434d";
        m.fillRect(x + 1.5, y + 1.5, cw - 3, 1.5);
        dot(x + cw - 8, y + rh - 8, 2.2, color);
      }
    }
  } else if (variant === "network") {
    const rows = 9;
    const rh = (H - 12) / rows;
    for (let r = 0; r < rows; r++) {
      const y = 6 + r * rh;
      m.fillStyle = "#262d34";
      m.fillRect(6, y + 1, W - 12, rh - 3);
      for (let p = 0; p < 12; p++) {
        const x = 11 + p * 9;
        m.fillStyle = "#0d1013";
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
      m.fillStyle = "#2a3139";
      m.fillRect(6, y + 1, W - 12, uh - 3);
      for (let b = 0; b < 8; b++) {
        const x = 12 + b * 10;
        m.fillStyle = "#1a1f25";
        m.fillRect(x, y + 8, 6, uh - 18);
        if (lit && noise(i * 17 + b) > 0.25) {
          m.fillStyle = "#7fb6ff";
          m.fillRect(x + 1, y + uh - 16, 4, 3);
          e.fillStyle = "#7fb6ff";
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
    code: "#0f1a24",
    idle: "#0b1016",
    dash: "#0d1820",
    alert: "#2a0f0e",
    chart: "#0f1a22",
    deploy: "#101a16",
    "deploy-busy": "#241b0c",
    off: "#07090b",
  };
  g.fillStyle = bg[kind];
  g.fillRect(0, 0, W, H);

  if (kind === "code") {
    const palette = ["#7fb6ff", "#9ad7b3", "#d9c48a", "#c9d3dd"];
    for (let i = 0; i < 13; i++) {
      const indent = Math.floor(noise(i) * 4) * 12;
      g.fillStyle = palette[Math.floor(noise(i + 40) * palette.length)];
      g.fillRect(12 + indent, 12 + i * 11, 30 + noise(i + 9) * 130, 4);
    }
  } else if (kind === "idle") {
    g.fillStyle = "#1c2630";
    g.fillRect(W / 2 - 40, H / 2 - 3, 80, 6);
  } else if (kind === "dash" || kind === "alert") {
    const line = kind === "alert" ? "#ff6a5e" : "#62d39a";
    for (let r = 0; r < 2; r++) {
      for (let col = 0; col < 3; col++) {
        const x = 10 + col * 82;
        const y = 10 + r * 74;
        g.fillStyle = kind === "alert" ? "#3a1513" : "#132430";
        g.fillRect(x, y, 72, 64);
        g.strokeStyle = col === 1 && r === 0 ? "#7fb6ff" : line;
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
    g.strokeStyle = "#2b3a47";
    g.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      g.beginPath();
      g.moveTo(14, i * 30);
      g.lineTo(W - 14, i * 30);
      g.stroke();
    }
    g.strokeStyle = "#7fb6ff";
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
    const c1 = kind === "deploy" ? "#62d39a" : "#f0b040";
    for (let i = 0; i < 5; i++) {
      g.fillStyle = "#1c2a25";
      g.fillRect(14, 14 + i * 27, W - 28, 18);
      g.fillStyle = i < 3 || kind === "deploy" ? c1 : "#4a4333";
      g.fillRect(14, 14 + i * 27, (W - 28) * (kind === "deploy" ? 1 : [1, 1, 0.6, 0.2, 0.1][i]), 18);
    }
  }

  const t = finish(c);
  screenCache.set(kind, t);
  return t;
}

export function floorTiles(): THREE.CanvasTexture {
  if (floorTexture) return floorTexture;
  const S = 128;
  const [c, g] = canvas(S, S);
  g.fillStyle = "#59636d";
  g.fillRect(0, 0, S, S);
  // Faint mottling so the tiles do not look like flat paint.
  for (let i = 0; i < 260; i++) {
    const v = 86 + Math.floor(noise(i) * 20);
    g.fillStyle = `rgba(${v},${v + 6},${v + 12},0.35)`;
    g.fillRect(noise(i + 500) * S, noise(i + 900) * S, 3, 3);
  }
  g.strokeStyle = "#3a434c";
  g.lineWidth = 3;
  g.strokeRect(0, 0, S, S);
  g.strokeStyle = "rgba(255,255,255,0.05)";
  g.lineWidth = 1;
  g.strokeRect(3, 3, S - 6, S - 6);
  const t = finish(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  floorTexture = t;
  return t;
}
