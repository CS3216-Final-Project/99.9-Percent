import { openRoomControls, openCameraControls } from "./fixtures";
import type { Page } from "@playwright/test";
import { test, expect, expectRoom, seedClassicSave, seedSave, unlockChallenge } from "./fixtures";
import { advanceTurn, newGame, newLegacyGame } from "../src/sim";

test.beforeEach(async ({ page }) => {
  await unlockChallenge(page);
  await page.addInitScript(() => localStorage.setItem("nn.mode.v1", "classic"));
  await seedClassicSave(page, advanceTurn(newLegacyGame(1)));
});

const label = (page: Page, name: string) => page.getByRole("main").locator(".eq-labels").getByRole("button", { name, exact: true });
const floor = (page: Page, name: "Office floor" | "Server floor") => page.locator(`.floor-menu button[data-floor="${name === "Office floor" ? "office" : "servers"}"]`);
const walk = (page: Page) => page.locator(".desktop-walk").getByRole("button", { name: "Walk mode", exact: true, includeHidden: true });
const prompt = (page: Page) => page.locator(".walk-prompt");
const exploration = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("nn.classic.exploration.v1") ?? "null"));

async function chooseWalkMode(page: Page) {
  const menu = page.locator(".view-mode-menu");
  await menu.locator(":scope > summary").click();
  await walk(page).click();
}
/** The stored camera view, once its exact JSON has stayed unchanged for a beat longer than the write throttle. */
async function settledView(page: Page): Promise<{ target: { x: number; z: number }; offset: { x: number; y: number; z: number }; zoom: number }> {
  let lastJson = "";
  let unchangedSince = Date.now();
  let view: { target: { x: number; z: number }; offset: { x: number; y: number; z: number }; zoom: number } | null = null;
  await expect
    .poll(
      async () => {
        const camera = (await exploration(page))?.camera ?? null;
        const json = JSON.stringify(camera);
        if (json !== lastJson) {
          lastJson = json;
          unchangedSince = Date.now();
        }
        view = camera;
        return camera !== null && Date.now() - unchangedSince >= 1200;
      },
      { timeout: 45_000, intervals: [300, 350, 400] },
    )
    .toBe(true);
  return view!;
}

/** The centre of a room label's box on screen: where the camera's target, angle and zoom put it. */
async function labelCentre(page: Page, name: string): Promise<{ x: number; y: number }> {
  const box = await label(page, name).boundingBox();
  if (!box) throw new Error(`The ${name} label is not on screen`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
const events = (page: Page, prefix: string) =>
  page.evaluate((p) => (JSON.parse(localStorage.getItem("nn.campaign.analytics.v1") ?? "[]") as { name: string }[]).filter((e) => e.name.startsWith(p)).map((e) => e.name), prefix);

async function open(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Continue week 2" }).click();
  await expectRoom(page);
}

/** Record the frequency of every oscillator the real audio makes, so positional sounds can be heard in the test. */
async function trackEffectFrequencies(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { effectFrequencies: number[] };
    w.effectFrequencies = [];
    const make = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (this: AudioContext) {
      const oscillator = make.call(this);
      queueMicrotask(() => w.effectFrequencies.push(oscillator.frequency.value));
      return oscillator;
    };
  });
  const frequencies = () => page.evaluate(() => (window as unknown as { effectFrequencies: number[] }).effectFrequencies);
  const reset = () => page.evaluate(() => { (window as unknown as { effectFrequencies: number[] }).effectFrequencies = []; });
  return { frequencies, reset };
}

/** Whether `hz` appears in the captured frequencies, allowing a small floating-point tolerance. */
const near = (frequencies: number[], hz: number) => frequencies.some((f) => Math.abs(f - hz) < 0.6);

test("walks the building as an avatar: the elevator by Space, Walk keeping out of Space's way, and Esc to stop", async ({ page }) => {
  // The opening framing and the walk move a share of the way each frame, so software rendering takes a while.
  test.slow();
  await open(page);
  await chooseWalkMode(page);
  await expect(walk(page)).toHaveAttribute("aria-pressed", "true");
  // On the server floor the avatar steps out of the elevator, so the ride is within reach at once.
  await expect(prompt(page)).toContainText("Ride up to the office floor");
  await expect(page.getByRole("status").filter({ hasText: "Ride up to the office floor: press Space" })).toHaveCount(1);
  // Space rides: the Walk button, just pressed, does not take it for itself.
  await page.keyboard.press("Space");
  await expect(walk(page)).toHaveAttribute("aria-pressed", "true");
  await expect(floor(page, "Office floor")).toHaveAttribute("aria-pressed", "true");
  await expect(label(page, "Growth")).toBeVisible();
  // Out of the car upstairs, the way back down is offered.
  await expect(prompt(page)).toContainText("Ride down to the server floor", { timeout: 20_000 });
  await page.keyboard.press("Escape");
  await expect(walk(page)).toHaveAttribute("aria-pressed", "false");
  await expect(prompt(page)).toHaveCount(0);
  expect(await events(page, "walk_")).toEqual(["walk_started", "walk_ended"]);
});

test("in walk mode, clicking equipment walks the avatar to it, and Space then inspects it", async ({ page }) => {
  test.slow();
  // The scan cue's first readout chirp is a fixed 1244 Hz square wave, heard through the real audio.
  const SCAN_CHIRP = 1244;
  const audio = await trackEffectFrequencies(page);
  await open(page);
  await chooseWalkMode(page);
  await expect(prompt(page)).toContainText("Ride up");
  // The monitoring room is just past the elevator, through its glass door.
  await label(page, "Monitoring").click();
  await expect(label(page, "Monitoring")).toHaveAttribute("aria-pressed", "true");
  await expect(prompt(page)).toContainText("Inspect Monitoring", { timeout: 40_000 });
  // An inspection started in the room opens the diagnostic card, with its scan, over the inspector.
  const reveal = page.getByRole("dialog", { name: "Monitoring inspected" });
  await expect(reveal).toBeVisible();
  await expect(reveal.locator(".inspection-status")).toContainText("Healthy");
  await expect(reveal).toContainText("dashboards");
  await expect.poll(async () => near(await audio.frequencies(), SCAN_CHIRP)).toBe(true);
  await reveal.getByRole("button", { name: "Return to room" }).click();
  await expect(reveal).not.toBeVisible();
  // Close the inspector, then Space opens it again from where the avatar stands: a nearby
  // prompt wins even while a room control like Zoom in still holds the page's focus.
  await page.getByRole("complementary", { name: "Details" }).getByRole("button", { name: "Close" }).click();
  await expect(label(page, "Monitoring")).toHaveAttribute("aria-pressed", "false");
  await openCameraControls(page); await page.getByRole("button", { name: "Zoom in", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(reveal).toBeVisible();
  await expect(label(page, "Monitoring")).toHaveAttribute("aria-pressed", "true");
  await reveal.getByRole("button", { name: "Return to room" }).click();
  // The prompt is a button too, for a phone with no Space key.
  await page.getByRole("complementary", { name: "Details" }).getByRole("button", { name: "Close" }).click();
  await prompt(page).click();
  await expect(reveal).toBeVisible();
  await reveal.getByRole("button", { name: "Return to room" }).click();
});

test("Guided Mode: the avatar inspects the Deploy office and the panel reports company operations", async ({ page }) => {
  test.slow();
  await page.route("**/api/**", (r) => r.abort());
  await page.addInitScript(() => localStorage.setItem("nn.mode.v1", "campaign"));
  await seedSave(page, newGame(7, "walk-office"));
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page);
  const metrics = page.getByRole("complementary", { name: "System metrics" });
  await chooseWalkMode(page);
  await expect(prompt(page)).toContainText("Ride up to the office floor");
  await page.keyboard.press("Space");
  await expect(prompt(page)).toContainText("Ride down to the server floor", { timeout: 20_000 });
  // The office's labels are visible in Guided Mode; clicking one walks the avatar over.
  await label(page, "Deploy").click();
  await expect(prompt(page)).toContainText("Inspect Deploy", { timeout: 40_000 });
  const deployReveal = page.getByRole("dialog", { name: "Deploy inspected" });
  await expect(deployReveal).toBeVisible();
  await expect(metrics).toContainText("Deploy · Company operations");
  await deployReveal.getByRole("button", { name: "Return to room" }).click();
  // Deselect through the canvas' own empty-space click, then let Space do the inspection.
  await page.getByRole("main").locator("canvas").click({ position: { x: 8, y: 8 } });
  await expect(metrics).not.toContainText("Company operations");
  await page.keyboard.press("Space");
  await expect(deployReveal).toBeVisible();
  await expect(metrics).toContainText("Infrastructure changes activate after their listed delay.");
  await expect(metrics).toContainText("Deploy · Company operations");
  await deployReveal.getByRole("button", { name: "Return to room" }).click();
});

test("walking away from the meeting leaves its nearby presentation sound behind", async ({ page }) => {
  test.slow();
  // The meeting-room talk's three tones, as MIDI 50, 55 and 52 come through the real audio.
  const PRESENTATION = [146.832, 195.998, 164.814];
  // The talk makes exactly three oscillators in one synchronous burst, so its triplet lands in consecutive entries.
  const heard = (frequencies: number[]) => frequencies.some((_, i) => PRESENTATION.every((hz) => near(frequencies.slice(i, i + 4), hz)));
  const audio = await trackEffectFrequencies(page);
  await open(page);
  await openRoomControls(page); await floor(page, "Office floor").click();
  await expect(floor(page, "Office floor")).toHaveAttribute("aria-pressed", "true");
  await chooseWalkMode(page);
  await expect(walk(page)).toHaveAttribute("aria-pressed", "true");
  // Walk mode begins beside the meeting room: its talk is heard through real Web Audio.
  await audio.reset();
  await expect
    .poll(async () => heard(await audio.frequencies()), { timeout: 10_000 })
    .toBe(true);
  // Let the room plan a route through the meeting-room door to Growth, rather than assuming
  // timed key presses travel far enough on every renderer. Its arrival prompt proves the avatar
  // is on the open floor, well beyond the presentation's 11 m reach.
  await label(page, "Growth").click();
  const growthReveal = page.getByRole("dialog", { name: "Growth inspected" });
  await expect(growthReveal).toBeVisible();
  await growthReveal.getByRole("button", { name: "Return to room" }).click();
  await expect(prompt(page)).toContainText("Inspect Growth", { timeout: 40_000 });
  await expect(walk(page)).toHaveAttribute("aria-pressed", "true");
  await expect(floor(page, "Office floor")).toHaveAttribute("aria-pressed", "true");
  // Out of earshot now: over longer than the talk's longest gap it never sounds its three tones together again.
  await audio.reset();
  await page.waitForTimeout(8_200);
  const away = await audio.frequencies();
  // Other nearby sources keep playing: absence of the talk must not pass because all audio stopped.
  expect(away.length).toBeGreaterThan(0);
  expect(heard(away)).toBe(false);
});

test("changes the avatar mid-game from the menu, fetching only the one chosen", async ({ page }) => {
  const fetched: string[] = [];
  page.on("request", (r) => {
    const m = /\/models\/avatars\/([a-z]+)\.glb/.exec(r.url());
    if (m) fetched.push(m[1]);
  });
  await open(page);
  await expect.poll(() => fetched).toEqual(["fox"]);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await menu.getByRole("tab", { name: "Avatar" }).click();
  await menu.getByRole("radio", { name: "Panda" }).check();
  await expect(menu.getByRole("radio", { name: "Panda" })).toBeChecked();
  await expect.poll(() => fetched).toEqual(["fox", "panda"]);
  await menu.getByRole("button", { name: "Close" }).click();
  // Remembered for the next visit, and never in the save.
  expect(await page.evaluate(() => localStorage.getItem("nn.avatar.v1"))).toBe("panda");
  expect(await page.evaluate(() => localStorage.getItem("nn.classic.save.v1") ?? "")).not.toContain("panda");
  expect(await events(page, "avatar_")).toEqual(["avatar_changed"]);
});

test("walks straight across the server hall where no machine has been fitted yet", async ({ page }) => {
  test.slow();
  // In the aisle between the second row of app server places and the row kept for autoscaling, all of them empty
  // in week 2: one app server stands, at the first place of the front row.
  await page.addInitScript(() =>
    localStorage.setItem(
      "nn.classic.exploration.v1",
      JSON.stringify({ version: 1, floor: "servers", walking: true, avatar: { floor: "servers", x: -3.0, z: -2.3, yaw: 0 }, camera: null }),
    ),
  );
  await open(page);
  await expect(walk(page)).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await exploration(page))?.avatar?.z).toBe(-2.3);
  // Up walks away from the camera, diagonally across the empty places, into the cold aisle in front of the server.
  await page.keyboard.down("ArrowUp");
  await expect.poll(async () => (await exploration(page))?.avatar?.z ?? 0, { timeout: 20_000 }).toBeLessThan(-4.6);
  await page.keyboard.up("ArrowUp");
});

test("walking leaves the camera in place", async ({ page }) => {
  test.slow();
  // Resume mid-walk in the open aisle, as in the hall-crossing test, so Up has room to carry the avatar.
  await page.addInitScript(() =>
    localStorage.setItem(
      "nn.classic.exploration.v1",
      JSON.stringify({ version: 1, floor: "servers", walking: true, avatar: { floor: "servers", x: -3.0, z: -2.3, yaw: 0 }, camera: null }),
    ),
  );
  await open(page);
  await expect(walk(page)).toHaveAttribute("aria-pressed", "true");
  const before = await settledView(page);
  const start = (await exploration(page))?.avatar as { x: number; z: number };
  const walked = async () => {
    const a = (await exploration(page))?.avatar as { x: number; z: number };
    return Math.hypot(a.x - start.x, a.z - start.z);
  };
  try {
    await page.keyboard.down("ArrowUp");
    await expect.poll(walked, { timeout: 30_000 }).toBeGreaterThanOrEqual(1);
  } finally {
    await page.keyboard.up("ArrowUp");
  }
  expect(await walked()).toBeGreaterThanOrEqual(1);
  const after = await settledView(page);
  expect(after.target.x).toBeCloseTo(before.target.x, 3);
  expect(after.target.z).toBeCloseTo(before.target.z, 3);
});

test("restores the mode, floor, walk position and camera view after a reload", async ({ page }) => {
  test.slow();
  await open(page);
  await chooseWalkMode(page);
  await expect(prompt(page)).toContainText("Ride up");
  // Send the avatar to the monitoring room, so its spot is worth remembering.
  await label(page, "Monitoring").click();
  const restoreReveal = page.getByRole("dialog", { name: "Monitoring inspected" });
  await expect(restoreReveal).toBeVisible();
  await restoreReveal.getByRole("button", { name: "Return to room" }).click();
  await expect(prompt(page)).toContainText("Inspect Monitoring", { timeout: 40_000 });
  await page.getByRole("complementary", { name: "Details" }).getByRole("button", { name: "Close" }).click();
  await expect.poll(async () => (await exploration(page))?.avatar?.floor).toBe("servers");
  // A turn and a closer look, taken through the room's own camera buttons.
  const before = await settledView(page);
  await openCameraControls(page); await page.getByRole("button", { name: "Rotate right" }).click();
  await openCameraControls(page); await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await openCameraControls(page); await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect.poll(async () => (await exploration(page))?.camera?.zoom ?? 0).toBeGreaterThan(before.zoom);
  const view = await settledView(page);
  expect(view.zoom).toBeGreaterThan(before.zoom);
  // What the camera settled on: where two labels stand on screen now.
  const monitoring = await labelCentre(page, "Monitoring");
  const database = await labelCentre(page, "Database");

  await page.reload();
  await page.getByRole("button", { name: "Continue week 2" }).click();
  await expectRoom(page);
  // Mode, floor and walk mode are picked up exactly where they were left.
  await expect(floor(page, "Server floor")).toHaveAttribute("aria-pressed", "true");
  await expect(walk(page)).toHaveAttribute("aria-pressed", "true");
  // The avatar stands by Monitoring without being walked there again: the prompt is back in reach.
  await expect(prompt(page)).toContainText("Inspect Monitoring", { timeout: 20_000 });
  // And the camera came back to the same view: both labels return to their screen spots.
  await expect
    .poll(async () => Math.hypot((await labelCentre(page, "Monitoring")).x - monitoring.x, (await labelCentre(page, "Monitoring")).y - monitoring.y), { timeout: 20_000 })
    .toBeLessThan(4);
  await expect
    .poll(async () => Math.hypot((await labelCentre(page, "Database")).x - database.x, (await labelCentre(page, "Database")).y - database.y), { timeout: 20_000 })
    .toBeLessThan(4);
  // Challenge Mode stays the last mode played, and the view record is its own, not the campaign's.
  expect(await page.evaluate(() => localStorage.getItem("nn.mode.v1"))).toBe("classic");
  expect(await page.evaluate(() => localStorage.getItem("nn.campaign.exploration.v1"))).toBeNull();
});
