import { defineConfig, devices } from '@playwright/test';

/*
 * Frame-time probe for the 3D room, run by hand (never in CI): `npm run perf:probe`. Unlike playwright.config.ts it
 * opens a headed Chromium so the real graphics card draws, and runs one scenario at a time for steady numbers. Set
 * PERF_MODES=low,high to probe some qualities only, PERF_HEADLESS=1 to try the headless browser (software
 * rendering unless the GPU is reachable there) and PERF_SECONDS to change how long each window is measured.
 */
const port = Number(process.env.PLAYWRIGHT_PORT ?? 4175);
// PERF_DIST=dist-perf serves an unminified build (`npx vite build --minify false --outDir dist-perf`), so the CPU
// profile names real functions.
const dist = process.env.PERF_DIST ?? 'dist';

export default defineConfig({
  testDir: './perf',
  testMatch: 'probe.spec.ts',
  tsconfig: './tsconfig.app.json',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  outputDir: 'test-results/perf-artifacts',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    headless: process.env.PERF_HEADLESS === '1',
    launchOptions: {
      // Another window over the probe's must not throttle its frames and timers, or a window measures 1 fps.
      args: [
        '--ignore-gpu-blocklist',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-background-timer-throttling',
        ...(process.env.PERF_HEADLESS === '1' ? ['--use-angle=d3d11', '--enable-gpu-rasterization'] : []),
      ],
    },
  },
  projects: [{ name: 'perf', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npx vite preview --outDir ${dist} --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
