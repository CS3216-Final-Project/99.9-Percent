import fs from "node:fs";
import path from "node:path";
import type { CDPSession, Page } from "@playwright/test";
import { test, expect, expectRoom, openRoomControls, seedSave } from "../e2e/fixtures";
import { GRAPHICS_QUALITIES, type GraphicsQuality } from "../src/game/persist";
import { newGame } from "../src/sim";

/*
 * Measures what the room costs to draw at each graphics quality, in a real browser on this machine's graphics card.
 * For each quality it opens a saved company, then records a few windows in turn: the opening (shader warm-up), the
 * room standing still, the company running, and the player interacting (turning, hovering, riding the elevator).
 * Every window records each animation frame's interval and what WebGL did in it (draws, shader links, texture
 * uploads), the browser's long tasks and a sampled CPU profile. Results go to test-results/perf/<quality>.json and a
 * summary is printed. Judge the numbers against the display's refresh rate: a capped quality draws fewer frames on
 * purpose, so compare rendered-frame intervals, long frames and long tasks rather than raw fps alone.
 */

const SECONDS = Number(process.env.PERF_SECONDS ?? 12);
const MODES = (process.env.PERF_MODES?.split(",").map((m) => m.trim()).filter(Boolean) ?? [...GRAPHICS_QUALITIES]) as GraphicsQuality[];
const OUT = path.resolve("test-results/perf");

type Tick = [t: number, draws: number, links: number, linkMs: number, tex: number, texBytes: number, paramMs: number, bufferBytes: number, programs: number, mipmaps: number];
interface Capture { ticks: Tick[]; longTasks: [start: number, duration: number][]; stalls: [at: number, call: string, ms: number][]; startedAt: number; renderer: string | null; canvas: [number, number, number, number] | null; mem: [number | undefined, number | undefined]; contexts: number; counters: Record<string, number> }

/** Installed before any page script: counts what WebGL does per animation frame and listens for long tasks. */
function installProbe() {
  type Counters = Record<string, number>;
  const counters: Counters = { draws: 0, links: 0, linkMs: 0, compiles: 0, tex: 0, texSub: 0, texBytes: 0, paramMs: 0, bufferBytes: 0, programs: 0, mipmaps: 0, readPixels: 0, getError: 0 };
  const P = { on: false, ticks: [] as number[][], longTasks: [] as [number, number][], stalls: [] as [number, string, number][], renderer: null as string | null, canvas: null as HTMLCanvasElement | null, contexts: 0, mem0: undefined as number | undefined, counters, start() {}, stop(): unknown { return null; } };
  (window as unknown as { __perf: typeof P }).__perf = P;
  const proto = WebGL2RenderingContext.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
  const wrap = (name: string, fn: (this: unknown, orig: (...a: unknown[]) => unknown, args: unknown[]) => unknown) => {
    const orig = proto[name];
    if (!orig) return;
    proto[name] = function (this: unknown, ...args: unknown[]) { return fn.call(this, orig, args); };
  };
  const count = (key: string) => function (this: unknown, orig: (...a: unknown[]) => unknown, args: unknown[]) { counters[key]++; return orig.apply(this, args); };
  const timed = (key: string, countKey?: string) => function (this: unknown, orig: (...a: unknown[]) => unknown, args: unknown[]) {
    const t = performance.now();
    const r = orig.apply(this, args);
    const took = performance.now() - t;
    counters[key] += took;
    if (countKey) counters[countKey]++;
    // Any wait over 5 ms is kept with its time, whether or not a window is open, so a stall between windows shows.
    if (took > 5) P.stalls.push([Math.round(t), key, Math.round(took)]);
    return r;
  };
  for (const n of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced", "drawRangeElements"]) wrap(n, count("draws"));
  wrap("useProgram", count("programs"));
  wrap("compileShader", count("compiles"));
  wrap("generateMipmap", count("mipmaps"));
  wrap("readPixels", count("readPixels"));
  wrap("getError", count("getError"));
  wrap("linkProgram", timed("linkMs", "links"));
  // Synchronous round trips to the GPU process: each waits for every command queued before it, so a shader the
  // driver compiles lazily at its first draw is paid for here.
  for (const n of ["getProgramParameter", "getShaderParameter", "getProgramInfoLog", "getShaderInfoLog", "getError", "finish", "readPixels", "getUniformLocation", "getActiveUniform", "getActiveAttrib", "getAttribLocation"]) wrap(n, timed("paramMs"));
  // Bytes a texture call uploads: the long forms name a width and height (after the offsets for a sub-image), the
  // short forms take an image, canvas or bitmap, and the compressed forms a byte array.
  const texBytes = (args: unknown[], sub: boolean) => {
    const src = args[args.length - 1] as { width?: number; height?: number; byteLength?: number } | null;
    const w = sub ? 4 : 3;
    if (args.length >= 9 && typeof args[w] === "number" && typeof args[w + 1] === "number") return (args[w] as number) * (args[w + 1] as number) * 4;
    if (src && typeof src.width === "number" && typeof src.height === "number") return src.width * src.height * 4;
    if (src && typeof src.byteLength === "number") return src.byteLength;
    return 0;
  };
  for (const n of ["texImage2D", "compressedTexImage2D", "texImage3D"]) {
    wrap(n, function (this: unknown, orig, args) { counters.tex++; counters.texBytes += texBytes(args, false); return orig.apply(this, args); });
  }
  for (const n of ["texSubImage2D", "compressedTexSubImage2D"]) {
    wrap(n, function (this: unknown, orig, args) { counters.tex++; counters.texSub++; counters.texBytes += texBytes(args, true); return orig.apply(this, args); });
  }
  wrap("bufferData", function (this: unknown, orig, args) {
    const d = args[1] as number | { byteLength?: number } | null;
    counters.bufferBytes += typeof d === "number" ? d : (d?.byteLength ?? 0);
    return orig.apply(this, args);
  });
  const getContext = HTMLCanvasElement.prototype.getContext as (this: HTMLCanvasElement, type: string, ...rest: unknown[]) => RenderingContext | null;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
    const ctx = getContext.call(this, type, ...rest);
    if (ctx && (type === "webgl2" || type === "webgl") && P.canvas !== this) {
      P.contexts++;
      if (!P.canvas) {
        P.canvas = this;
        try {
          const gl = ctx as WebGL2RenderingContext;
          const info = gl.getExtension("WEBGL_debug_renderer_info");
          P.renderer = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
        } catch { /* only a label */ }
      }
    }
    return ctx;
  } as typeof HTMLCanvasElement.prototype.getContext;
  const snap = () => ({ ...counters });
  let prev = snap();
  const tick = (t: number) => {
    if (P.on) {
      const c = counters;
      P.ticks.push([t, c.draws - prev.draws, c.links - prev.links, c.linkMs - prev.linkMs, c.tex - prev.tex, c.texBytes - prev.texBytes, c.paramMs - prev.paramMs, c.bufferBytes - prev.bufferBytes, c.programs - prev.programs, c.mipmaps - prev.mipmaps]);
      prev = snap();
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (P.on) P.longTasks.push([e.startTime, e.duration]);
    }).observe({ type: "longtask", buffered: false });
  } catch { /* no long task timing */ }
  const memory = () => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
  P.start = () => { P.ticks = []; P.longTasks = []; P.stalls = []; prev = snap(); P.mem0 = memory(); P.on = true; };
  P.stop = () => {
    P.on = false;
    const canvas = P.canvas;
    return { ticks: P.ticks, longTasks: P.longTasks, stalls: P.stalls, startedAt: Math.round(performance.now()), renderer: P.renderer, canvas: canvas ? [canvas.width, canvas.height, canvas.clientWidth, canvas.clientHeight] : null, mem: [P.mem0, memory()], contexts: P.contexts, counters: { ...counters } };
  };
}

const quantile = (sorted: number[], q: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0);
const round = (n: number, d = 1) => Number(n.toFixed(d));

interface Profile { nodes: { id: number; callFrame: { functionName: string; url: string; lineNumber: number }; children?: number[] }[]; samples?: number[]; timeDeltas?: number[] }

/** Self and inclusive time per function from a sampled CPU profile, the heaviest first. */
function hotspots(profile: Profile, n = 30) {
  const byId = new Map(profile.nodes.map((nd) => [nd.id, nd]));
  const parent = new Map<number, number>();
  for (const nd of profile.nodes) for (const c of nd.children ?? []) parent.set(c, nd.id);
  const label = (id: number) => {
    const f = byId.get(id)!.callFrame;
    const file = f.url ? f.url.slice(f.url.lastIndexOf("/") + 1).replace(/\?.*$/, "") : "";
    return `${f.functionName || "(anonymous)"}${file ? ` ${file}:${f.lineNumber + 1}` : ""}`;
  };
  const self = new Map<string, number>();
  const inclusive = new Map<string, number>();
  // The chain of callers three deep for each function, by inclusive time, so a hot three.js internal can be traced
  // to the pass that ran it (the shadow pass, the main pass or an effect's extra pass).
  const callers = new Map<string, Map<string, number>>();
  let total = 0;
  let maxDelta = 0;
  const samples = profile.samples ?? [];
  const deltas = profile.timeDeltas ?? [];
  for (let i = 0; i < samples.length; i++) {
    const dt = Math.max(0, deltas[i] ?? 0);
    // A sample a second or more after the last is the profiler catching up, not a frame: it would be booked to
    // whatever function happened to be running.
    if (dt > 1_000_000) { maxDelta = Math.max(maxDelta, dt); continue; }
    maxDelta = Math.max(maxDelta, dt);
    total += dt;
    const leaf = label(samples[i]);
    self.set(leaf, (self.get(leaf) ?? 0) + dt);
    const seen = new Set<string>();
    for (let id: number | undefined = samples[i]; id !== undefined; id = parent.get(id)) {
      const k = label(id);
      if (seen.has(k)) continue;
      seen.add(k);
      inclusive.set(k, (inclusive.get(k) ?? 0) + dt);
      const chain: string[] = [];
      for (let a = parent.get(id), d = 0; a !== undefined && d < 3; a = parent.get(a), d++) chain.push(label(a));
      if (chain.length) {
        const pk = chain.join(" < ");
        const c = callers.get(k) ?? new Map<string, number>();
        c.set(pk, (c.get(pk) ?? 0) + dt);
        callers.set(k, c);
      }
    }
  }
  const top = (m: Map<string, number>) => [...m].filter(([k]) => !/^\(root\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ fn: k, ms: round(v / 1000), share: round((100 * v) / Math.max(1, total)) }));
  const calledFrom = (fn: string) => [...(callers.get(fn) ?? [])].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${round(v / 1000)}`);
  const watched = top(inclusive).filter((h) => /getProgram|getParameters|updateMatrixWorld|traverse|setFromAxisAngle|getBoundingClientRect|renderTransparency|WebGLShadowMap|triangulateShape|getProgramInfoLog|\(garbage collector\)/.test(h.fn)).map((h) => ({ fn: h.fn, ms: h.ms, callers: calledFrom(h.fn) }));
  return { sampledMs: round(total / 1000), maxDeltaMs: round(maxDelta / 1000), self: top(self), inclusive: top(inclusive), watched };
}

function summarise(c: Capture, seconds: number) {
  const ticks = c.ticks;
  const display: number[] = [];
  const rendered: number[] = [];
  const heavy: { at: number; ms: number; links: number; linkMs: number; tex: number; texMB: number; paramMs: number; bufferMB: number }[] = [];
  let lastRendered: number | null = null;
  let draws = 0;
  let renderedFrames = 0;
  let programs = 0;
  const totals = { links: 0, linkMs: 0, tex: 0, texBytes: 0, paramMs: 0, bufferBytes: 0, mipmaps: 0 };
  for (let i = 0; i < ticks.length; i++) {
    const [t, d, links, linkMs, tex, texBytes, paramMs, bufferBytes, prog, mip] = ticks[i];
    if (i > 0) display.push(t - ticks[i - 1][0]);
    totals.links += links; totals.linkMs += linkMs; totals.tex += tex; totals.texBytes += texBytes; totals.paramMs += paramMs; totals.bufferBytes += bufferBytes; totals.mipmaps += mip;
    if (d > 0) {
      renderedFrames++;
      draws += d;
      programs += prog;
      if (lastRendered !== null) {
        const gap = t - lastRendered;
        rendered.push(gap);
        if (gap > 80) heavy.push({ at: round((t - ticks[0][0]) / 1000, 2), ms: round(gap), links, linkMs: round(linkMs), tex, texMB: round(texBytes / 1048576, 2), paramMs: round(paramMs), bufferMB: round(bufferBytes / 1048576, 2) });
      }
      lastRendered = t;
    }
  }
  const sorted = [...rendered].sort((a, b) => a - b);
  const sortedDisplay = [...display].sort((a, b) => a - b);
  const span = ticks.length > 1 ? (ticks[ticks.length - 1][0] - ticks[0][0]) / 1000 : seconds;
  const longTasks = c.longTasks.map(([, d]) => d);
  return {
    seconds: round(span, 1),
    renderer: c.renderer,
    canvas: c.canvas,
    displayHz: round(display.length / span),
    displayFrameMs: { p50: round(quantile(sortedDisplay, 0.5)), p95: round(quantile(sortedDisplay, 0.95)), max: round(sortedDisplay.at(-1) ?? 0) },
    renderedFps: round(renderedFrames / span),
    renderedFrameMs: { p50: round(quantile(sorted, 0.5)), p95: round(quantile(sorted, 0.95)), p99: round(quantile(sorted, 0.99)), max: round(sorted.at(-1) ?? 0) },
    /** Rendered-frame gaps a player would notice: a hitch, a stall and a freeze. */
    hitches: { over50ms: rendered.filter((g) => g > 50).length, over100ms: rendered.filter((g) => g > 100).length, over250ms: rendered.filter((g) => g > 250).length },
    drawsPerFrame: round(draws / Math.max(1, renderedFrames)),
    programsPerFrame: round(programs / Math.max(1, renderedFrames)),
    gpuWork: { shaderLinks: totals.links, linkMs: round(totals.linkMs), compileWaitMs: round(totals.paramMs), textureUploads: totals.tex, textureUploadsPerFrame: round(totals.tex / Math.max(1, renderedFrames)), textureMB: round(totals.texBytes / 1048576, 1), bufferMB: round(totals.bufferBytes / 1048576, 1), mipmaps: totals.mipmaps },
    longTasks: { count: longTasks.length, totalMs: round(longTasks.reduce((a, b) => a + b, 0)), maxMs: round(Math.max(0, ...longTasks)) },
    heapMB: { start: c.mem[0] ? round(c.mem[0] / 1048576) : null, end: c.mem[1] ? round(c.mem[1] / 1048576) : null },
    heavyFrames: heavy.slice(0, 12),
    /** Synchronous GPU waits over 5 ms, as seconds from the first frame of the window. */
    stalls: c.stalls.map(([at, call, ms]) => ({ at: round((at - (ticks[0]?.[0] ?? at)) / 1000, 2), call, ms })),
    ticksSpan: ticks.length > 1 ? [round((ticks[0][0]) / 1000, 2), round(ticks[ticks.length - 1][0] / 1000, 2)] : null,
  };
}

type Summary = ReturnType<typeof summarise> & { hotspots?: ReturnType<typeof hotspots> };

async function measure(page: Page, cdp: CDPSession, name: string, seconds: number, act?: () => Promise<void>): Promise<Summary> {
  await cdp.send("Profiler.start");
  await page.evaluate(() => (window as unknown as { __perf: { start(): void } }).__perf.start());
  const started = Date.now();
  if (act) await act();
  const left = seconds * 1000 - (Date.now() - started);
  if (left > 0) await page.waitForTimeout(left);
  const capture = (await page.evaluate(() => (window as unknown as { __perf: { stop(): unknown } }).__perf.stop())) as Capture;
  const { profile } = await cdp.send("Profiler.stop");
  const summary: Summary = { ...summarise(capture, seconds), hotspots: hotspots(profile as Profile) };
  const r = summary.renderedFrameMs;
  console.log(`  ${name.padEnd(12)} ${String(summary.renderedFps).padStart(5)} fps  frame p50/p95/p99/max ${r.p50}/${r.p95}/${r.p99}/${r.max} ms  hitches>50/100/250: ${summary.hitches.over50ms}/${summary.hitches.over100ms}/${summary.hitches.over250ms}  long tasks ${summary.longTasks.count} (${summary.longTasks.totalMs} ms, max ${summary.longTasks.maxMs})  draws/frame ${summary.drawsPerFrame}  links ${summary.gpuWork.shaderLinks} (${summary.gpuWork.linkMs}+${summary.gpuWork.compileWaitMs} ms)  tex ${summary.gpuWork.textureUploads} (${summary.gpuWork.textureMB} MB)`);
  if (summary.stalls.length) console.log(`    GPU waits: ${summary.stalls.slice(0, 10).map((s) => `${s.call} ${s.ms} ms @${s.at}s`).join(", ")}${summary.stalls.length > 10 ? ` … ${summary.stalls.length} in all` : ""}`);
  return summary;
}

for (const quality of MODES) {
  test(`probe ${quality}`, async ({ page, context }) => {
    test.setTimeout(60_000 + SECONDS * 6000);
    await context.addInitScript(installProbe);
    await context.addInitScript((q) => localStorage.setItem("nn.graphics.v1", JSON.stringify({ quality: q, fov: 75, skipElevator: false })), quality);
    await seedSave(page, newGame(1, "perf"));
    const cdp = await context.newCDPSession(page);
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", { interval: 250 });
    const windows: Record<string, Summary> = {};
    const opened = Date.now();
    await page.goto("/?perf=1");
    await page.getByRole("button", { name: "Continue company", exact: true }).click();
    // The opening is measured from the moment the room's canvas exists, warm-up included.
    await expect(page.getByRole("main").locator("canvas")).toBeVisible();
    const shownAfter = Date.now() - opened;
    console.log(`\n[${quality}]`);
    windows.opening = await measure(page, cdp, "opening", SECONDS, async () => { await expectRoom(page); });
    console.log(`  renderer: ${windows.opening.renderer}  canvas ${windows.opening.canvas?.join("x")}  display ${windows.opening.displayHz} Hz  canvas shown after ${shownAfter} ms`);
    windows.still = await measure(page, cdp, "still", SECONDS);
    // A picture of each floor at this quality, to judge a change to how the room is drawn by eye.
    fs.mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: path.join(OUT, `${quality}-servers.png`) });
    // What the scene holds, when the room exposes itself (window.__nnRoom = { gl, scene, camera }).
    const census = await page.evaluate(() => {
      const room = (window as unknown as { __nnRoom?: { gl: { info: { render: unknown; memory: unknown; programs?: unknown[] } }; scene: { children: unknown[] } } }).__nnRoom;
      if (!room) return null;
      type Mat = { uuid: string; type: string; name: string; transparent?: boolean; vertexColors?: boolean };
      type Geo = { attributes: Record<string, { itemSize: number; count: number }>; index?: { count: number } | null; morphAttributes: Record<string, unknown[]> };
      type O = { type: string; name: string; visible: boolean; children: O[]; isMesh?: boolean; isSkinnedMesh?: boolean; isInstancedMesh?: boolean; instanceColor?: unknown; count?: number; isBone?: boolean; castShadow?: boolean; customDepthMaterial?: unknown; position: { x: number; y: number; z: number }; material?: Mat | Mat[]; geometry?: Geo };
      const count = (o: O) => {
        const c = { nodes: 0, meshes: 0, visibleMeshes: 0, skinned: 0, bones: 0, casters: 0, shownCasters: 0, transparent: 0, triangles: 0, lights: 0, shownLights: 0 };
        const walk = (n: O, shown: boolean) => {
          c.nodes++;
          const visible = shown && n.visible;
          if (n.isBone) c.bones++;
          if ((n as { isLight?: boolean }).isLight) { c.lights++; if (visible) c.shownLights++; }
          if (n.isMesh) {
            c.meshes++;
            if (visible) c.visibleMeshes++;
            if (n.isSkinnedMesh) c.skinned++;
            if (n.castShadow) c.casters++;
            if (n.castShadow && visible) c.shownCasters++;
            const mats = Array.isArray(n.material) ? n.material : n.material ? [n.material] : [];
            if (mats.some((m) => m.transparent)) c.transparent++;
            if (visible && n.geometry) {
              const g = n.geometry;
              const verts = g.index ? g.index.count : g.attributes.position?.count ?? 0;
              c.triangles += Math.round(verts / 3) * (n.isInstancedMesh ? n.count ?? 1 : 1);
            }
          }
          for (const ch of n.children) walk(ch, visible);
        };
        walk(o, true);
        return c;
      };
      const scene = room.scene as unknown as O;
      // A material drawn by objects of different kinds makes three re-fetch its shader program at every switch
      // (see WebGLRenderer.setProgram): instanced or not, skinned or not, vertex alpha or not. The depth material the
      // shadow pass shares across every caster is counted the same way, by the casters' kinds.
      const traits = (n: O, g: Geo | undefined, m: Mat) => `${n.isInstancedMesh ? "instanced" : ""}${n.isInstancedMesh && n.instanceColor ? "+color" : ""}${n.isSkinnedMesh ? "skinned" : ""}${m.vertexColors && g?.attributes.color?.itemSize === 4 ? "valpha" : ""}${g?.morphAttributes?.position ? "morph" : ""}` || "plain";
      const byMaterial = new Map<string, { label: string; kinds: Map<string, number> }>();
      const casterKinds = new Map<string, number>();
      const heavy: { name: string; type: string; material: string; triangles: number; instances: number }[] = [];
      const walkMats = (n: O, shown: boolean) => {
        const visible = shown && n.visible;
        if (n.isMesh && visible) {
          const mats = Array.isArray(n.material) ? n.material : n.material ? [n.material] : [];
          for (const m of mats) {
            const t = traits(n, n.geometry, m);
            const e = byMaterial.get(m.uuid) ?? { label: `${m.type}${m.name ? ` "${m.name}"` : ""}`, kinds: new Map() };
            e.kinds.set(t, (e.kinds.get(t) ?? 0) + 1);
            byMaterial.set(m.uuid, e);
            if (n.castShadow && !n.customDepthMaterial) { const k = traits(n, n.geometry, { uuid: "", type: "", name: "" }); casterKinds.set(k, (casterKinds.get(k) ?? 0) + 1); }
          }
          const g = n.geometry;
          if (g) {
            const verts = g.index ? g.index.count : g.attributes.position?.count ?? 0;
            const tri = Math.round(verts / 3) * (n.isInstancedMesh ? n.count ?? 1 : 1);
            heavy.push({ name: n.name, type: n.type, material: mats.map((m) => m.type).join("+"), triangles: tri, instances: n.isInstancedMesh ? n.count ?? 1 : 1 });
          }
        }
        for (const ch of n.children) walkMats(ch, visible);
      };
      walkMats(scene, true);
      const mixed = [...byMaterial.values()].filter((e) => e.kinds.size > 1).map((e) => ({ material: e.label, kinds: Object.fromEntries(e.kinds) }));
      heavy.sort((a, b) => b.triangles - a.triangles);
      return {
        total: count(scene),
        groups: scene.children.map((ch) => { const o = ch as O; return { type: o.type, name: o.name, visible: o.visible, y: Math.round(o.position.y * 10) / 10, ...count(o) }; }),
        info: { render: room.gl.info.render, memory: room.gl.info.memory, programs: room.gl.info.programs?.length ?? null },
        programKeys: (room.gl.info.programs as { name: string; cacheKey: string; usedTimes: number }[] | undefined)?.map((p) => ({ name: p.name, key: p.cacheKey, used: p.usedTimes })) ?? null,
        mixedMaterials: mixed,
        shownCasterKinds: Object.fromEntries(casterKinds),
        heaviest: heavy.slice(0, 15),
      };
    });
    // Materials whose version ticks between two looks a second apart are being marked needsUpdate every frame, which
    // makes the renderer refetch their program each time (see WebGLRenderer.setProgram).
    const churn = await page.evaluate(async () => {
      const room = (window as unknown as { __nnRoom?: { scene: { traverse(cb: (o: unknown) => void): void } } }).__nnRoom;
      if (!room) return null;
      type M = { uuid: string; type: string; name: string; version: number };
      const materials = new Map<string, M>();
      room.scene.traverse((o) => {
        const m = (o as { material?: M | M[] }).material;
        for (const x of Array.isArray(m) ? m : m ? [m] : []) materials.set(x.uuid, x);
      });
      const before = new Map([...materials].map(([k, m]) => [k, m.version]));
      await new Promise((r) => setTimeout(r, 1000));
      const churned = [...materials.values()].filter((m) => m.version !== before.get(m.uuid));
      // Who bumps the first one: trap its version for a frame and keep the first caller's stack.
      let stack = "";
      if (churned.length) {
        const m = churned[0] as M & Record<string, unknown>;
        let value = m.version;
        Object.defineProperty(m, "version", { configurable: true, get: () => value, set: (v: number) => { if (!stack) stack = new Error().stack ?? ""; value = v; } });
        await new Promise((r) => setTimeout(r, 100));
        delete (m as Record<string, unknown>).version;
        m.version = value;
      }
      return { churned: churned.map((m) => `${m.type}${m.name ? ` "${m.name}"` : ""} +${m.version - (before.get(m.uuid) ?? 0)}`), stack: stack.split("\n").slice(1, 9).map((l) => l.trim().replace(/\(.*\/assets\//, "(")) };
    });
    if (census) {
      console.log(`  scene: ${JSON.stringify(census.total)} programs ${census.info.programs} memory ${JSON.stringify(census.info.memory)} last render ${JSON.stringify(census.info.render)}`);
      console.log(`  materials re-versioned within a second: ${JSON.stringify(churn)}`);
      for (const g of census.groups) if (g.nodes > 20) console.log(`    ${g.type}${g.name ? ` "${g.name}"` : ""} y=${g.y} visible=${g.visible} nodes ${g.nodes} meshes ${g.meshes} shown ${g.visibleMeshes} skinned ${g.skinned} bones ${g.bones} casters ${g.casters} shownCasters ${g.shownCasters} transparent ${g.transparent} lights ${g.lights} tris ${g.triangles}`);
      console.log(`  lights: ${census.total.lights} in the scene, ${census.total.shownLights} shown`);
      console.log(`  shown casters by kind (shared depth material): ${JSON.stringify(census.shownCasterKinds)}`);
      console.log(`  materials drawn by mixed kinds: ${JSON.stringify(census.mixedMaterials)}`);
      console.log(`  heaviest shown meshes: ${census.heaviest.map((h) => `${h.type}${h.name ? `"${h.name}"` : ""}/${h.material} ${h.triangles}tri${h.instances > 1 ? `×${h.instances}` : ""}`).join(" | ")}`);
    }
    const run = page.getByRole("button", { name: "Run", exact: true });
    windows.running = await measure(page, cdp, "running", SECONDS, async () => { if (await run.isVisible()) await run.click(); });
    windows.interact = await measure(page, cdp, "interacting", SECONDS, async () => {
      // Moves the pointer rather than Playwright's hover, so a panel over a label never stalls the probe.
      try {
        const labels = page.locator(".eq-label");
        const n = Math.min(await labels.count(), 4);
        for (let i = 0; i < n; i++) {
          const box = await labels.nth(i).boundingBox();
          if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
          await page.waitForTimeout(250);
        }
        await page.mouse.move(100, 100);
        for (const key of ["q", "q", "e", "e"]) { await page.keyboard.press(key); await page.waitForTimeout(400); }
        await openRoomControls(page);
        await page.locator('.floor-menu button[data-floor="office"]').click({ timeout: 3000 });
      } catch (e) { console.log(`  (interaction cut short: ${String(e).split("\n")[0]})`); }
    });
    windows.office = await measure(page, cdp, "office", SECONDS);
    await page.screenshot({ path: path.join(OUT, `${quality}-office.png`) });
    // The shader programs the office floor added, by what differs in their cache keys from the nearest program that
    // existed before: a light count would mean the floor changed the lighting and every material was rebuilt.
    const programsBefore = census?.programKeys ?? null;
    const programsAfter = await page.evaluate(() => {
      const room = (window as unknown as { __nnRoom?: { gl: { info: { programs?: { name: string; cacheKey: string; usedTimes: number }[] } } } }).__nnRoom;
      return room?.gl.info.programs?.map((p) => ({ name: p.name, key: p.cacheKey, used: p.usedTimes })) ?? null;
    });
    if (programsBefore && programsAfter) {
      const before = new Set(programsBefore.map((p) => p.key));
      const added = programsAfter.filter((p) => !before.has(p.key));
      console.log(`  programs: ${programsBefore.length} before the ride, ${programsAfter.length} after; new: ${added.length}`);
      const parts = (k: string) => k.split(",");
      for (const p of added.slice(0, 30)) {
        // The closest earlier program of the same material type, and the key fields that differ.
        const a = parts(p.key);
        let best: { diff: string[]; name: string } | null = null;
        for (const q of programsBefore) {
          if (q.name !== p.name) continue;
          const b = parts(q.key);
          const diff = a.map((v, i) => (v !== b[i] ? `${i}:${b[i]}→${v}` : "")).filter(Boolean);
          if (!best || diff.length < best.diff.length) best = { diff, name: q.name };
        }
        console.log(`    + ${p.name} used ${p.used}× ${best ? `differs from an earlier ${best.name} at ${best.diff.slice(0, 8).join(" ")}` : "(no earlier program of this type)"}`);
      }
    }
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, `${quality}.json`), JSON.stringify({ quality, measuredAt: new Date().toISOString(), seconds: SECONDS, census, windows }, null, 2));
    for (const [name, w] of Object.entries(windows)) {
      if (!w.hotspots) continue;
      console.log(`  hotspots (${name}, sampled ${w.hotspots.sampledMs} ms, longest gap ${w.hotspots.maxDeltaMs} ms, self ms): ${w.hotspots.self.slice(0, 8).map((h) => `${h.fn} ${h.ms}`).join(" | ")}`);
      for (const h of w.hotspots.watched) console.log(`    ${h.fn} ${h.ms} ms <- ${h.callers.join(" | ")}`);
    }
    expect(windows.still.renderedFps).toBeGreaterThan(0);
  });
}
