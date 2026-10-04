import { test, expect, expectRoom, savedGame } from './fixtures';

test('plays a first week and opens and closes Tech on a touch viewport', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await expectRoom(page);
  await page.getByRole('button', { name: 'Tech', exact: true }).tap();
  const tech = page.getByRole('region', { name: 'Tech tree' });
  await expect(tech).toBeVisible();
  await tech.getByRole('button', { name: 'Close', exact: true }).tap();
  await page.getByRole('button', { name: 'Next week', exact: true }).tap();
  expect((await savedGame(page)).turn).toBe(2);
  const viewportWidth = page.viewportSize()!.width;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewportWidth);
});
