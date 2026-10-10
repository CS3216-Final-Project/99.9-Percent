import { test, expect, expectRoom, savedClassicGame as savedGame, seedClassicSave as seedSave } from './fixtures';
import { newLegacyGame as newGame } from '../src/sim';

// The founder walks in real time; a walk across the office and a moment's work take several seconds.
const WALK = { timeout: 30_000 };
test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('nn.mode.v1', 'classic'));
  await seedSave(page, newGame('founder'));
  await page.goto('/');
  // A company nobody has played yet opens with Play.
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expectRoom(page);
});

test('walks to the servers and only adds one once the work there is done', async ({ page }) => {
  const before = await savedGame(page);
  await page.getByRole('button', { name: 'Servers', exact: true }).click();
  await page.getByRole('button', { name: /Add server/ }).click();
  const bubble = page.getByRole('status').filter({ hasText: 'Adding a server' });
  await expect(bubble).toBeVisible();
  // Nothing is bought until the founder has worked the machine.
  expect((await savedGame(page)).infra.appHosts).toHaveLength(before.infra.appHosts.length);
  await expect(bubble.getByRole('progressbar')).toBeVisible(WALK);
  await expect.poll(async () => (await savedGame(page)).infra.appHosts.length, WALK).toBe(before.infra.appHosts.length + 1);
  expect((await savedGame(page)).cash).toBeLessThan(before.cash);
  await expect(bubble).toHaveCount(0);
});

test('steers with the keyboard and works the machine it stands at with Space', async ({ page }) => {
  await page.getByRole('button', { name: 'Growth', exact: true }).click();
  const prompt = page.getByRole('button', { name: /Space\s*Growth/ });
  await expect(prompt).toBeVisible(WALK);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('complementary').getByRole('heading', { name: 'Growth' })).toHaveCount(0);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Space');
  await expect(page.getByRole('complementary').getByRole('heading', { name: 'Growth' })).toBeVisible();
  // Space again closes it.
  await page.keyboard.press('Space');
  await expect(page.getByRole('complementary').getByRole('heading', { name: 'Growth' })).toHaveCount(0);
  // Walking away from the machine takes the prompt away.
  await page.keyboard.down('s');
  await expect(prompt).toHaveCount(0, WALK);
  await page.keyboard.up('s');
});
