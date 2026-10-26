import { defineConfig, devices } from '@playwright/test';

/*
 * The cross-browser playtest (perf/browsers.spec.ts), run by hand, never in CI: `npm run perf:browsers`. Headed by
 * default so each browser draws on the machine's graphics card. PERF_BROWSERS picks the engines (default
 * chromium,firefox,webkit; add chrome or msedge for the installed branded browsers), PERF_MODES the qualities,
 * PERF_SECONDS each window's length and PERF_HEADLESS=1 runs without windows.
 */
const port = Number(process.env.PLAYWRIGHT_PORT ?? 4176);
const wanted = (process.env.PERF_BROWSERS ?? 'chromium,firefox,webkit').split(',').map((b) => b.trim());
const desktop = { viewport: { width: 1440, height: 900 } };
const all = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'], ...desktop, launchOptions: { args: ['--ignore-gpu-blocklist'] } } },
  { name: 'chrome', use: { ...devices['Desktop Chrome'], ...desktop, channel: 'chrome' } },
  { name: 'msedge', use: { ...devices['Desktop Edge'], ...desktop, channel: 'msedge' } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'], ...desktop } },
  { name: 'webkit', use: { ...devices['Desktop Safari'], ...desktop } },
];

export default defineConfig({
  testDir: './perf',
  testMatch: 'browsers.spec.ts',
  tsconfig: './tsconfig.app.json',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240_000,
  expect: { timeout: 30_000 },
  reporter: [['list']],
  outputDir: 'test-results/perf-artifacts',
  use: { baseURL: `http://127.0.0.1:${port}`, headless: process.env.PERF_HEADLESS === '1' },
  projects: all.filter((p) => wanted.includes(p.name)),
  webServer: {
    command: `npx vite preview --outDir ${process.env.PERF_DIST ?? 'dist'} --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
