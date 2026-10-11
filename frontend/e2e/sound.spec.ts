import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

/** Count the voices the sound effects start. The music synthesises offline and only plays buffers in real time. */
async function countEffects(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { effectVoices: number };
    w.effectVoices = 0;
    const make = BaseAudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (this: AudioContext) {
      w.effectVoices++;
      return make.call(this);
    };
  });
  return () => page.evaluate(() => (window as unknown as { effectVoices: number }).effectVoices);
}

test("sounds the company starting, each introduction prompt and the alarm, and nothing while muted", async ({ page, withoutRoom }) => {
  // The effects need no room; skipping its software WebGL keeps this journey fast.
  await withoutRoom();
  const problems: string[] = [];
  // Audio failures only: without a backend, the account panel's requests fail on every page.
  page.on("console", message => { if (/could not be (prepared|played)/.test(message.text())) problems.push(message.text()); });
  const voices = await countEffects(page);
  await page.goto("/");
  // The title screen is silent; starting the company powers it up: a fan sweep, two bells and a soft chord.
  await page.waitForTimeout(300);
  expect(await voices()).toBe(0);
  await page.getByRole("button", { name: "Try Prototype", exact: true }).click();
  await expect.poll(voices).toBeGreaterThanOrEqual(5);
  const launch = await voices();
  // Each prompt of the introduction ticks.
  await page.getByRole("button", { name: "Skip introduction" }).click();
  await expect.poll(voices).toBeGreaterThan(launch);
  const introduced = await voices();
  const advance = page.getByRole("button", { name: "Advance step", exact: true });
  for (let i = 0; i < 5; i++) await advance.click();
  // Quiet steps make no sound.
  expect(await voices()).toBe(introduced);
  await advance.click();
  await expect(page.getByRole("banner")).toHaveClass(/is-incident/);
  // The alarm: two siren whoops over a low hit.
  await expect.poll(voices).toBeGreaterThanOrEqual(introduced + 3);
  const alarm = await voices();
  const mute = page.getByRole("button", { name: "Mute sound", exact: true });
  const inspect = page.getByRole("complementary", { name: "System metrics" }).getByRole("button", { name: "Monitoring", exact: true });
  await mute.click();
  await inspect.click();
  await page.waitForTimeout(300);
  expect(await voices()).toBe(alarm);
  // Unmuting plays a sample, and decisions are heard again.
  await mute.click();
  await expect.poll(voices).toBeGreaterThan(alarm);
  const unmuted = await voices();
  await inspect.click();
  await expect.poll(voices).toBeGreaterThan(unmuted);
  expect(problems).toEqual([]);
});

test("the header sound button follows the menu sliders and turns sound back on from silence", async ({ page, withoutRoom }) => {
  await withoutRoom();
  await page.goto("/"); await page.getByRole("button", { name: "Try Prototype", exact: true }).click();
  await page.getByRole("button", { name: "Skip introduction" }).click();
  const mute = page.getByRole("button", { name: "Mute sound", exact: true });
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await menu.getByRole("tab", { name: "Sound" }).click();
  // The menu covers the header button, which still shows what the sliders say.
  await menu.getByRole("slider", { name: "Music" }).fill("0");
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  await menu.getByRole("slider", { name: "Sound effects" }).fill("0");
  await expect(mute).toHaveAttribute("aria-pressed", "true");
  await expect(menu.getByRole("button", { name: "Mute all" })).toHaveAttribute("aria-pressed", "true");
  await menu.getByRole("button", { name: "Close" }).click();
  // A real click on the button: silent at 0 and 0 means turning sound on, not muting again.
  await mute.click();
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("nn.audio.v1")!))).toEqual({ music: 80, effects: 80, muted: false });
});

test("starts a new company with the same sound, and lets a saved one continue quietly", async ({ page, withoutRoom }) => {
  await withoutRoom();
  const voices = await countEffects(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Try Prototype", exact: true }).click();
  await expect.poll(voices).toBeGreaterThanOrEqual(5);
  await page.getByRole("button", { name: "Skip introduction" }).click();
  await expect(page.getByRole("dialog", { name: "Company introduction" })).toBeHidden();
  // Reloading counts from zero again: the saved company continues without its start-up sound.
  await page.reload();
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await page.waitForTimeout(500);
  expect(await voices()).toBe(0);
  const menu = page.getByRole("dialog", { name: "Menu" });
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await menu.getByRole("tab", { name: "Saves" }).click();
  await menu.getByRole("button", { name: "New company", exact: true }).click();
  await menu.getByRole("button", { name: "Confirm new company" }).click();
  await expect.poll(voices).toBeGreaterThanOrEqual(5);
});
