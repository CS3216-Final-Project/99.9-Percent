import type { Page } from '@playwright/test';
import { test, expect, seedClassicSave, unlockChallenge } from './fixtures';
import { advanceTurn, newLegacyGame as newGame } from '../src/sim';

// Animations are paused at a fixed time, so each in-between frame is checked exactly, however slowly the browser draws.
async function freezeAt(page: Page, time: number) {
  await page.evaluate(time => document.getAnimations().forEach(animation => { animation.pause(); animation.currentTime = time; }), time);
}
const finish = (page: Page) => page.evaluate(() => document.getAnimations().forEach(animation => animation.play()));
const box = async (page: Page, selector: string) => (await page.locator(selector).boundingBox())!;

async function openChallenge(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await unlockChallenge(page);
  await page.addInitScript(() => localStorage.setItem('nn.mode.v1', 'classic'));
  await seedClassicSave(page, advanceTurn(newGame(1)));
  await page.goto('/');
  // The title screen draws over the room; the panel's controls stay out of it.
  await expect(page.getByRole('button', { name: 'Hide equipment and actions', exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Continue week 2', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Details' })).toBeVisible();
}

test.beforeEach(async ({ withoutRoom }) => { await withoutRoom(); });

test('the selected machine\'s details tween their height when they open and when another machine is chosen', async ({ page }) => {
  await openChallenge(page, 1440);
  const panel = page.getByRole('complementary', { name: 'Details' });
  await panel.getByRole('button', { name: 'Inspect Network', exact: true }).click();
  await freezeAt(page, 30);
  const opening = (await box(page, '.reveal')).height;
  await finish(page);
  await expect.poll(() => page.evaluate(() => document.querySelector('.reveal')!.getAnimations().length)).toBe(0);
  const network = (await box(page, '.reveal')).height;
  // The standard curve starts gently: a tenth of the way in, the box has not yet covered half its height.
  expect(opening).toBeGreaterThan(0);
  expect(opening).toBeLessThan(network / 2);

  await panel.getByRole('button', { name: 'Inspect Growth', exact: true }).click();
  await freezeAt(page, 150);
  const between = (await box(page, '.reveal')).height;
  await finish(page);
  await expect.poll(() => page.evaluate(() => document.querySelector('.reveal')!.getAnimations().length)).toBe(0);
  const growth = (await box(page, '.reveal')).height;
  expect(Math.abs(growth - network)).toBeGreaterThan(100);
  expect(between).toBeGreaterThan(Math.min(network, growth) + 10);
  expect(between).toBeLessThan(Math.max(network, growth) - 10);
});

test('hiding the panel keeps its button in full view as it glides to the reopen button', async ({ page }) => {
  await openChallenge(page, 1440);
  const hide = await box(page, '.panel-toggle');
  await page.getByRole('button', { name: 'Hide equipment and actions', exact: true }).click();
  await freezeAt(page, 150);
  const button = page.getByRole('button', { name: 'Equipment & actions', exact: true });
  await expect(button).toBeVisible();
  expect(await button.evaluate(el => getComputedStyle(el).opacity)).toBe('1');
  const middle = (await button.boundingBox())!;
  await finish(page);
  await expect(page.locator('.equipment-shell.is-collapsed')).toHaveCount(1);
  await expect(button).toBeFocused();
  await expect.poll(() => button.evaluate(el => el.getAnimations().length)).toBe(0);
  const reopen = (await button.boundingBox())!;
  // Halfway there in place and in size.
  expect(middle.x).toBeGreaterThan(hide.x + 10);
  expect(middle.x).toBeLessThan(reopen.x - 10);
  expect(middle.width).toBeGreaterThan(hide.width + 10);
  expect(middle.width).toBeLessThan(reopen.width - 10);

  await button.click();
  await freezeAt(page, 150);
  const back = page.getByRole('button', { name: 'Hide equipment and actions', exact: true });
  expect(await back.evaluate(el => getComputedStyle(el).opacity)).toBe('1');
  expect((await back.boundingBox())!.x).toBeGreaterThan(hide.x + 10);
  await finish(page);
  await expect(back).toBeFocused();
  await expect.poll(async () => (await back.boundingBox())!.x).toBeCloseTo(hide.x, 0);
});

test('over the bottom sheet the button stays at the bottom edge and its chevron flips between down and up', async ({ page }) => {
  await openChallenge(page, 820);
  const rotation = (selector: string) => page.locator(`${selector} .toggle-sheet-icon`).evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a);
  await expect(page.locator('.panel-toggle .toggle-side-icon')).toBeHidden();
  expect(await rotation('.panel-toggle')).toBe(1);
  await page.getByRole('button', { name: 'Hide equipment and actions', exact: true }).click();
  const button = page.getByRole('button', { name: 'Equipment & actions', exact: true });
  await expect(page.locator('.equipment-shell.is-collapsed')).toHaveCount(1);
  await expect.poll(() => rotation('.panel-reopen')).toBeCloseTo(-1, 3);
  await expect.poll(() => button.evaluate(el => el.getAnimations().length)).toBe(0);
  const stage = (await page.getByRole('main').boundingBox())!, reopen = (await button.boundingBox())!;
  expect(stage.y + stage.height - (reopen.y + reopen.height)).toBeCloseTo(12, 0);
  expect(stage.x + stage.width - (reopen.x + reopen.width)).toBeCloseTo(12, 0);
});
