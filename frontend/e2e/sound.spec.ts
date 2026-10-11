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

test("sounds the alarm when the opening incident starts, and nothing while muted", async ({ page, withoutRoom }) => {
  // The effects need no room; skipping its software WebGL keeps this journey fast.
  await withoutRoom();
  const problems: string[] = [];
  // Audio failures only: without a backend, the account panel's requests fail on every page.
  page.on("console", message => { if (/could not be (prepared|played)/.test(message.text())) problems.push(message.text()); });
  const voices = await countEffects(page);
  await page.goto("/"); await page.getByRole("button", { name: "Try Prototype", exact: true }).click();
  await page.getByRole("button", { name: "Skip introduction" }).click();
  const advance = page.getByRole("button", { name: "Advance step", exact: true });
  for (let i = 0; i < 5; i++) await advance.click();
  // Quiet steps make no sound.
  expect(await voices()).toBe(0);
  await advance.click();
  await expect(page.getByRole("banner")).toHaveClass(/is-incident/);
  // The alarm: two siren whoops over a low hit.
  await expect.poll(voices).toBeGreaterThanOrEqual(3);
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
