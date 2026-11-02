import { test, expect, seedSave, savedGame } from './fixtures';
import { dataCompany } from '../src/sim/__tests__/spikeFixtures';
import { openGatewayManagement, closeInspection } from './componentInspection';

test('routing picks keep the Network window open and apply as one change when it is closed', async ({ page, withoutRoom }) => {
  await withoutRoom();
  await seedSave(page, dataCompany());
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue company', exact: true }).click();
  const network = await openGatewayManagement(page);
  const server = (n: number) => network.getByRole('checkbox', { name: `Server ${n}`, exact: true });
  await expect(network.getByRole('group', { name: /Send traffic to/ })).toContainText('applies when you close this window');
  await server(2).click();
  // The pick stays a draft: the window is still open and nothing is queued yet.
  await expect(network).toBeVisible();
  await expect(server(2)).toHaveAttribute('aria-checked', 'false');
  await expect(server(1)).toBeDisabled();
  expect((await savedGame(page)).campaign!.pending.some(a => a.type === 'routing')).toBe(false);
  // A second pick changes the draft back and forth without leaving the window.
  await server(2).click();
  await server(2).click();
  await expect(network).toBeVisible();
  await closeInspection(page);
  await expect(network).toBeHidden();
  await expect.poll(async () => (await savedGame(page)).campaign!.pending.filter(a => a.type === 'routing').map(a => a.routing?.targets)).toEqual([['app-1']]);
});

test('closing the Network window with the routing as it was queues nothing', async ({ page, withoutRoom }) => {
  await withoutRoom();
  await seedSave(page, dataCompany());
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue company', exact: true }).click();
  const network = await openGatewayManagement(page);
  const server2 = network.getByRole('checkbox', { name: 'Server 2', exact: true });
  await server2.click();
  await server2.click();
  await closeInspection(page);
  await expect(network).toBeHidden();
  expect((await savedGame(page)).campaign!.pending.some(a => a.type === 'routing')).toBe(false);
});
