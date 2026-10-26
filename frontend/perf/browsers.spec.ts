import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { test, expect, expectRoom, openRoomControls, seedSave } from "../e2e/fixtures";
import { GRAPHICS_QUALITIES, type GraphicsQuality } from "../src/game/persist";
import { newGame } from "../src/sim";

/*
 * A playtest of the room in each browser engine (Chromium, Firefox, WebKit, and installed Chrome or Edge), timed by
 * animation frames alone so it runs where the Chromium-only probe (probe.spec.ts) cannot. For each quality it opens a
 * saved company and records the room standing still, the company running, the camera turning, the ride to the office
 * and the office. Each window prints rendered fps, frame-time percentiles and hitches (frames over 50, 100 and
 * 250 ms) with when the worst ones fell. Results go to test-results/perf/browsers-<browser>.json.
 */

const SECONDS = Number(process.env.PERF_SECONDS ?? 8);
const MODES = (process.env.PERF_MODES?.split(",").map((m) => m.trim()).filter(Boolean) ?? [...GRAPHICS_QUALITIES]) as GraphicsQuality[];
const OUT = path.resolve("test-results/perf");

function installFrameClock() {
  const P = { on: false, frames: [] as number[], longTasks: [] as number[], start() { P.frames = []; P.longTasks = []; P.on = true; }, stop() { P.on = false; return { frames: P.frames, longTasks: P.longTasks }; } };
  (window as unknown as { __frames: typeof P }).__frames = P;
  const tick = (t: number) => { if (P.on) P.frames.push(t); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (P.on) P.longTasks.push(e.duration); }).observe({ type: "longtask", buffered: false }); } catch { /* Firefox and WebKit have no long task timing */ }
}

const q = (s: number[], p: number) => (s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0);
const r1 = (n: number) => Math.round(n * 10) / 10;

async function measure(page: Page, name: string, act?: () => Promise<void>) {
  await page.evaluate(() => (window as unknown as { __frames: { start(): void } }).__frames.start());
  const started = Date.now();
  if (act) await act();
  const left = SECONDS * 1000 - (Date.now() - started);
  if (left > 0) await page.waitForTimeout(left);
  const { frames, longTasks } = await page.evaluate(() => (window as unknown as { __frames: { stop(): { frames: number[]; longTasks: number[] } } }).__frames.stop());
  const gaps = frames.slice(1).map((t, i) => t - frames[i]);
  const sorted = [...gaps].sort((a, b) => a - b);
  const span = frames.length > 1 ? (frames[frames.length - 1] - frames[0]) / 1000 : SECONDS;
  const worst = gaps.map((g, i) => ({ at: r1((frames[i + 1] - frames[0]) / 1000), ms: r1(g) })).sort((a, b) => b.ms - a.ms).slice(0, 5);
  const s = {
    fps: r1(gaps.length / span),
    frameMs: { p50: r1(q(sorted, 0.5)), p95: r1(q(sorted, 0.95)), p99: r1(q(sorted, 0.99)), max: r1(sorted.at(-1) ?? 0) },
    hitches: { over50: gaps.filter((g) => g > 50).length, over100: gaps.filter((g) => g > 100).length, over250: gaps.filter((g) => g > 250).length },
    longTasks: longTasks.length ? { count: longTasks.length, maxMs: r1(Math.max(...longTasks)) } : null,
    worst,
  };
  console.log(`  ${name.padEnd(9)} ${String(s.fps).padStart(5)} fps  p50/p95/p99/max ${s.frameMs.p50}/${s.frameMs.p95}/${s.frameMs.p99}/${s.frameMs.max} ms  >50/100/250 ${s.hitches.over50}/${s.hitches.over100}/${s.hitches.over250}  worst ${worst.map((w) => `${w.ms}@${w.at}s`).join(" ")}`);
  return s;
}

for (const quality of MODES) {
  test(`playtest ${quality}`, async ({ page, context, browserName }, info) => {
    test.setTimeout(90_000 + SECONDS * 6000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error" || /WebGL|GL_|shader/i.test(m.text())) errors.push(m.text().slice(0, 200)); });
    await context.addInitScript(installFrameClock);
    await context.addInitScript((g) => localStorage.setItem("nn.graphics.v1", JSON.stringify({ quality: g, fov: 75, skipElevator: false })), quality);
    await seedSave(page, newGame(1, "perf"));
    await page.goto("/");
    await page.getByRole("button", { name: "Continue company", exact: true }).click();
    await expectRoom(page, 30_000);
    const renderer = await page.locator("main canvas").evaluate((c) => {
      const gl = (c as HTMLCanvasElement).getContext("webgl2");
      if (!gl) return null;
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      return `${String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER))}; parallel compile ${!!gl.getExtension("KHR_parallel_shader_compile")}`;
    });
    const label = info.project.name;
    console.log(`\n[${label} ${quality}] ${browserName} ${info.project.use.channel ?? ""} on ${process.platform}  renderer: ${renderer}  dpr ${await page.evaluate(() => devicePixelRatio)}`);
    const w: Record<string, unknown> = {};
    w.opening = await measure(page, "opening");
    w.still = await measure(page, "still");
    const run = page.getByRole("button", { name: "Run", exact: true });
    w.running = await measure(page, "running", async () => { if (await run.isVisible()) await run.click(); });
    w.turning = await measure(page, "turning", async () => {
      await page.mouse.move(200, 200);
      for (const key of ["q", "q", "e", "e", "q", "e"]) { await page.keyboard.press(key); await page.waitForTimeout(500); }
    });
    w.ride = await measure(page, "ride", async () => {
      await openRoomControls(page);
      await page.locator('.floor-menu button[data-floor="office"]').click({ timeout: 30_000 });
    });
    w.office = await measure(page, "office");
    fs.mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: path.join(OUT, `browsers-${label}-${quality}.png`) });
    if (errors.length) console.log(`  errors: ${[...new Set(errors)].slice(0, 5).join(" | ")}`);
    const file = path.join(OUT, `browsers-${label}.json`);
    const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
    all[quality] = { browserName, os: process.platform, renderer, errors: [...new Set(errors)], windows: w };
    fs.writeFileSync(file, JSON.stringify(all, null, 2));
    expect((w.still as { fps: number }).fps).toBeGreaterThan(0);
  });
}

