import type { Page } from "@playwright/test";
import { test, expect, expectRoom, seedClassicSave, unlockChallenge } from "./fixtures";
import { advanceTurn, newLegacyGame } from "../src/sim";

test.beforeEach(async ({ page }) => {
  await unlockChallenge(page);
  await page.addInitScript(() => localStorage.setItem("nn.mode.v1", "classic"));
  await seedClassicSave(page, advanceTurn(newLegacyGame(1)));
});

const label = (page: Page, name: string) => page.getByRole("main").locator(".eq-labels").getByRole("button", { name, exact: true });
const floor = (page: Page, name: "Office floor" | "Server floor") => page.getByRole("group", { name: "Floors" }).getByRole("button", { name: new RegExp(`^${name}`) });
const walk = (page: Page) => page.getByRole("main").getByRole("button", { name: "Walk", exact: true });
const prompt = (page: Page) => page.locator(".walk-prompt");
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
  await walk(page).click();
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
  await open(page);
  await walk(page).click();
  await expect(prompt(page)).toContainText("Ride up");
  // The monitoring room is just past the elevator, through its glass door.
  await label(page, "Monitoring").click();
  await expect(label(page, "Monitoring")).toHaveAttribute("aria-pressed", "true");
  await expect(prompt(page)).toContainText("Inspect Monitoring", { timeout: 40_000 });
  // Close the inspector, then Space opens it again from where the avatar stands: a nearby
  // prompt wins even while a room control like Zoom in still holds the page's focus.
  await page.getByRole("complementary", { name: "Details" }).getByRole("button", { name: "Close" }).click();
  await expect(label(page, "Monitoring")).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Zoom in", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(label(page, "Monitoring")).toHaveAttribute("aria-pressed", "true");
  // The prompt is a button too, for a phone with no Space key.
  await page.getByRole("complementary", { name: "Details" }).getByRole("button", { name: "Close" }).click();
  await prompt(page).click();
  await expect(label(page, "Monitoring")).toHaveAttribute("aria-pressed", "true");
});

test("walking away from the meeting leaves its nearby presentation sound behind", async ({ page }) => {
  test.slow();
  // The meeting-room talk's three tones, as MIDI 50, 55 and 52 come through the real audio.
  const PRESENTATION = [146.832, 195.998, 164.814];
  // The talk makes exactly three oscillators in one synchronous burst, so its triplet lands in consecutive entries.
  const heard = (frequencies: number[]) => frequencies.some((_, i) => PRESENTATION.every((hz) => near(frequencies.slice(i, i + 4), hz)));
  const audio = await trackEffectFrequencies(page);
  await open(page);
  await floor(page, "Office floor").click();
  await expect(floor(page, "Office floor")).toHaveAttribute("aria-pressed", "true");
  await walk(page).click();
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
