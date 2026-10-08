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

export type ScreenKind = "code" | "idle" | "dash" | "alert" | "chart" | "deploy" | "deploy-busy" | "off" | "game" | "slides";

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
    game: "#0d0b22",
    slides: "#f4f1ea",
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
  } else if (kind === "game") {
    // A row of pixel invaders over a ground line and a little ship.
    const alien = ["0011100", "0111110", "1101011", "1111111", "0101010"];
    const colors = ["#ff7ad9", "#3ddc84", "#4cb8ff"];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 6; col++) {
        g.fillStyle = colors[row];
        alien.forEach((line, y) =>
          [...line].forEach((bit, x) => {
            if (bit === "1") g.fillRect(28 + col * 36 + x * 3, 18 + row * 28 + y * 3, 3, 3);
          }),
        );
      }
    }
    g.fillStyle = "#ffd84a";
    g.fillRect(118, 132, 20, 8);
    g.fillRect(125, 126, 6, 6);
    g.fillStyle = "#3ddc84";
    g.fillRect(0, 150, W, 3);
  } else if (kind === "slides") {
    g.fillStyle = "#1d1834";
    g.fillRect(16, 16, 150, 12);
    g.fillStyle = "#4cb8ff";
    g.fillRect(16, 50, 70, 80);
    g.fillStyle = "#ff7ad9";
    g.fillRect(96, 80, 40, 50);
    g.fillStyle = "#3ddc84";
    g.fillRect(146, 64, 40, 66);
    g.fillStyle = "#ffc53d";
    g.fillRect(196, 36, 40, 94);
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

/* ------------------------------------------------------------------ */
/* Office textures                                                     */
/* ------------------------------------------------------------------ */

function repeating(t: THREE.CanvasTexture): THREE.CanvasTexture {
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Warm wooden planks for the part of the floor where people work. */
export function woodFloor(): THREE.CanvasTexture {
  const S = 32;
  const [c, g] = canvas(S, S);
  const tones = ["#8a5a3c", "#93623f", "#7f5236", "#8d5d3a"];
  for (let row = 0; row < 4; row++) {
    const y = row * 8;
    g.fillStyle = tones[row];
    g.fillRect(0, y, S, 8);
    g.fillStyle = "#6a4129";
    g.fillRect(0, y + 7, S, 1);
    g.fillRect((row * 11 + 5) % S, y, 1, 7);
    g.fillStyle = "#a06d47";
    for (let i = 0; i < 4; i++) g.fillRect(Math.floor(noise(row * 9 + i) * S), y + 2 + Math.floor(noise(row * 5 + i + 30) * 4), 2, 1);
  }
  return repeating(finish(c));
}

/** Yellow and black tape marking where the server floor begins. */
export function hazardStripes(): THREE.CanvasTexture {
  const [c, g] = canvas(16, 4);
  for (let x = 0; x < 16; x++) {
    for (let y = 0; y < 4; y++) {
      g.fillStyle = (x + y) % 8 < 4 ? "#ffc53d" : "#1d1834";
      g.fillRect(x, y, 1, 1);
    }
  }
  return repeating(finish(c));
}

/** The city at night, seen through the office windows. */
export function skyline(): THREE.CanvasTexture {
  const W = 96;
  const H = 64;
  const [c, g] = canvas(W, H);
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#14112e");
  sky.addColorStop(1, "#45307a");
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#e8e2ff";
  for (let i = 0; i < 16; i++) g.fillRect(Math.floor(noise(i + 70) * W), Math.floor(noise(i + 90) * H * 0.4), 1, 1);
  g.fillStyle = "#fff2c4";
  g.fillRect(72, 6, 6, 8);
  g.fillRect(71, 7, 8, 6);
  let x = 0;
  let i = 0;
  while (x < W) {
    const bw = 8 + Math.floor(noise(i * 3 + 1) * 12);
    const bh = 18 + Math.floor(noise(i * 3 + 2) * 34);
    g.fillStyle = i % 2 ? "#1d1838" : "#262050";
    g.fillRect(x, H - bh, bw, bh);
    for (let wy = H - bh + 3; wy < H - 2; wy += 4) {
      for (let wx = x + 2; wx < x + bw - 2; wx += 3) {
        if (noise(wx * 13 + wy * 7) > 0.55) {
          g.fillStyle = noise(wx + wy * 3) > 0.3 ? "#ffd84a" : "#ff9f43";
          g.fillRect(wx, wy, 1, 2);
        }
      }
    }
    x += bw + 1;
    i++;
  }
  return finish(c);
}

/** The company's neon sign. Redrawn once the pixel font has loaded. */
export function logoSign(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 160);
  const draw = () => {
    g.clearRect(0, 0, 512, 160);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.shadowColor = "#ffd84a";
    g.shadowBlur = 18;
    g.fillStyle = "#ffe680";
    g.font = '700 104px "Pixelify Sans", sans-serif';
    g.fillText("99.99%", 256, 70);
    g.shadowColor = "#ff7ad9";
    g.shadowBlur = 12;
    g.fillStyle = "#ff9be3";
    g.font = '700 30px "Pixelify Sans", sans-serif';
    g.fillText("keep it online", 256, 134);
  };
  draw();
  const t = finish(c);
  t.magFilter = THREE.LinearFilter;
  document.fonts?.load('700 104px "Pixelify Sans"').then(() => {
    draw();
    t.needsUpdate = true;
  });
  return t;
}

/** Today's architecture sketch, with the next idea scribbled in red. */
export function whiteboard(): THREE.CanvasTexture {
  const W = 320;
  const H = 180;
  const [c, g] = canvas(W, H);
  const draw = () => {
    g.fillStyle = "#f7f4ff";
    g.fillRect(0, 0, W, H);
    g.lineWidth = 3;
    g.lineJoin = "round";
    const box = (x: number, y: number, w: number, h: number, color: string, label: string, dashed = false) => {
      g.strokeStyle = color;
      g.setLineDash(dashed ? [6, 5] : []);
      g.strokeRect(x, y, w, h);
      g.setLineDash([]);
      g.fillStyle = color;
      g.font = '600 14px "Rubik", sans-serif';
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(label, x + w / 2, y + h / 2);
    };
    const arrow = (x1: number, y1: number, x2: number, y2: number, color: string) => {
      g.strokeStyle = color;
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke();
      const a = Math.atan2(y2 - y1, x2 - x1);
      g.beginPath();
      g.moveTo(x2, y2);
      g.lineTo(x2 - 9 * Math.cos(a - 0.5), y2 - 9 * Math.sin(a - 0.5));
      g.moveTo(x2, y2);
      g.lineTo(x2 - 9 * Math.cos(a + 0.5), y2 - 9 * Math.sin(a + 0.5));
      g.stroke();
    };
    g.fillStyle = "#1d1834";
    g.font = '700 16px "Rubik", sans-serif';
    g.textAlign = "left";
    g.fillText("v2 architecture", 14, 20);
    box(14, 70, 56, 34, "#1d1834", "users");
    arrow(72, 87, 98, 87, "#1d1834");
    box(100, 70, 44, 34, "#2a7fd0", "LB");
    for (let i = 0; i < 3; i++) {
      arrow(146, 87, 170, 50 + i * 37, "#2a7fd0");
      box(172, 36 + i * 37, 48, 28, "#2a7fd0", "app");
    }
    arrow(222, 87, 244, 87, "#1a8a4a");
    box(246, 70, 60, 34, "#1a8a4a", "DB");
    box(246, 128, 60, 30, "#d6283b", "cache?", true);
    arrow(276, 126, 276, 106, "#d6283b");
    g.fillStyle = "#ffd84a";
    g.fillRect(14, 126, 46, 40);
    g.fillStyle = "#ff9be3";
    g.fillRect(66, 132, 46, 40);
    g.fillStyle = "#1d1834";
    for (let i = 0; i < 3; i++) {
      g.fillRect(20, 136 + i * 9, 30 - i * 6, 2);
      g.fillRect(72, 142 + i * 9, 32 - i * 8, 2);
    }
  };
  draw();
  const t = finish(c);
  t.magFilter = THREE.LinearFilter;
  document.fonts?.load('600 14px "Rubik"').then(() => {
    draw();
    t.needsUpdate = true;
  });
  return t;
}

/** Polished concrete for corridors and the network room. */
export function concreteFloor(): THREE.CanvasTexture {
  const S = 32;
  const [c, g] = canvas(S, S);
  g.fillStyle = "#4a4475";
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = noise(i) > 0.5 ? "#504a7d" : "#443e6c";
    g.fillRect(Math.floor(noise(i + 300) * S), Math.floor(noise(i + 600) * S), 2, 1);
  }
  g.fillStyle = "#3d3764";
  g.fillRect(0, S - 1, S, 1);
  g.fillRect(S - 1, 0, 1, S);
  return repeating(finish(c));
}

/** Short-pile carpet in one colour with a darker fleck. */
export function carpet(base: string, fleck: string): THREE.CanvasTexture {
  const S = 16;
  const [c, g] = canvas(S, S);
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  g.fillStyle = fleck;
  for (let i = 0; i < 26; i++) g.fillRect(Math.floor(noise(i + 40) * S), Math.floor(noise(i + 80) * S), 1, 1);
  return repeating(finish(c));
}

/** Kitchen floor: big pale tiles with dark grout. */
export function kitchenTiles(): THREE.CanvasTexture {
  const S = 16;
  const [c, g] = canvas(S, S);
  g.fillStyle = "#d9d4f0";
  g.fillRect(0, 0, S, S);
  g.fillStyle = "#c9c2e6";
  g.fillRect(0, 0, S / 2, S / 2);
  g.fillRect(S / 2, S / 2, S / 2, S / 2);
  g.fillStyle = "#8f87c9";
  g.fillRect(0, 0, S, 1);
  g.fillRect(0, 0, 1, S);
  g.fillRect(0, S / 2, S, 1);
  g.fillRect(S / 2, 0, 1, S);
  return repeating(finish(c));
}
