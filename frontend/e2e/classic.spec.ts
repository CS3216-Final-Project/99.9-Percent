import { test, expect, expectRoom, savedClassicGame as savedGame, seedClassicSave as seedSave } from './fixtures';
import { advanceTurn, newLegacyGame as newGame } from '../src/sim';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('nn.mode.v1', 'classic'));
});

test('completes the first-week tutorial, purchases equipment and resumes after reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expectRoom(page);
  await expect(page.getByRole('dialog', { name: /Tutorial, step 1/ })).toBeVisible();
  await page.getByRole('button', { name: 'Servers', exact: true }).click();
  await page.getByRole('button', { name: /Add server/ }).click();
  await expect(page.getByRole('dialog', { name: /Tutorial, step 2/ })).toBeVisible();
  await page.getByRole('button', { name: 'Tech', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Tech tree' }).locator('.node')).toHaveCount(9);
  await page.getByRole('button', { name: 'Scale Up: Available' }).click();
  await page.getByRole('button', { name: /^Start/ }).click();
  await expect(page.getByRole('dialog', { name: /Tutorial, step 3/ })).toBeVisible();
  await page.getByRole('button', { name: 'Growth', exact: true }).click();
  await page.getByRole('button', { name: /^Launch/ }).first().click();
  await expect(page.getByRole('dialog', { name: /Tutorial, step 4/ })).toBeVisible();
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  const before = await savedGame(page);
  expect(before.turn).toBe(2);
  expect(before.infra.appHosts).toHaveLength(2);
  expect(before.totals.promosRun).toBe(1);
  expect(before.tasks.some(task => task.techId === 'larger_servers') || before.releases.some(release => release.techId === 'larger_servers') || before.techDone.includes('larger_servers')).toBe(true);
  await page.reload();
  await page.getByRole('button', { name: 'Continue week 2' }).click();
  await expectRoom(page);
  expect(await savedGame(page)).toEqual(before);
  await expect(page.getByRole('dialog', { name: /Tutorial/ })).toHaveCount(0);
});

test('keeps the game playable when the furniture models cannot be downloaded', async ({ page }) => {
  await page.route('**/models/**', route => route.abort());
  const skipped = page.waitForEvent('console', message => message.text().includes('Furniture models failed to load'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await skipped;
  await expectRoom(page);
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  expect((await savedGame(page)).turn).toBe(2);
  await expectRoom(page);
});

test('keeps a browser without a GPU on the basic look and never downloads HD assets', async ({ page }) => {
  // CI draws with SwiftShader, which the room detects as software rendering.
  const hd: string[] = [];
  const crew = new Set<string>();
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/textures/') || url.includes('/models/polyhaven/')) hd.push(url);
  });
  page.on('response', response => { if (response.url().includes('/models/creatures/') && response.ok()) crew.add(response.url()); });
  await page.goto('/');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await expectRoom(page);
  // The monster crew works at every level of detail.
  await expect.poll(() => crew.size).toBe(14);
  await page.waitForLoadState('networkidle');
  expect(hd).toEqual([]);
});

test('draws the photo-scanned surfaces and furniture when HD detail is forced', async ({ page }) => {
  // Forcing HD on SwiftShader draws physically based materials and the detailed models on the CPU,
  // which took up to 30 seconds locally, so it gets the same headroom as other slow journeys.
  test.setTimeout(120_000);
  const textures = new Set<string>();
  const furniture = new Set<string>();
  page.on('response', response => {
    if (!response.ok()) return;
    const path = new URL(response.url()).pathname;
    if (path.includes('/textures/')) textures.add(path);
    if (path.includes('/models/polyhaven/')) furniture.add(path);
  });
  await page.goto('/?graphics=hd');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await expectRoom(page);
  // Six surfaces, each with a colour, a normal and a roughness map, and nine photo-scanned models.
  await expect.poll(() => textures.size).toBe(18);
  await expect.poll(() => furniture.size).toBe(9);
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  expect((await savedGame(page)).turn).toBe(2);
  await expectRoom(page);
});

test('keeps the game playable when the HD textures and furniture cannot be downloaded', async ({ page }) => {
  await page.route('**/textures/**', route => route.abort());
  await page.route('**/models/polyhaven/**', route => route.abort());
  const surfaces = page.waitForEvent('console', message => message.text().includes('HD textures failed to load'));
  const furniture = page.waitForEvent('console', message => message.text().includes('HD furniture failed to load'));
  await page.goto('/?graphics=hd');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await surfaces;
  await furniture;
  await expectRoom(page);
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  expect((await savedGame(page)).turn).toBe(2);
  await expectRoom(page);
});

test('keeps the game playable when the creature models cannot be downloaded', async ({ page }) => {
  await page.route('**/models/creatures/**', route => route.abort());
  const skipped = page.waitForEvent('console', message => message.text().includes('Creature models failed to load'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await skipped;
  await expectRoom(page);
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  expect((await savedGame(page)).turn).toBe(2);
  await expectRoom(page);
});

test('recovers from a corrupt save through the playable first-run flow', async ({ page, withoutRoom }) => {
  await withoutRoom();
  await page.addInitScript(() => localStorage.setItem('nn.classic.save.v1', '{'));
  await page.goto('/');
  await expect(page.getByRole('alert')).toHaveText('Saved classic run was unreadable. Started a new one.');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  expect((await savedGame(page)).turn).toBe(2);
});

test('confirms replacing a run and starts the supplied replay seed', async ({ page, withoutRoom }) => {
  await withoutRoom();
  await seedSave(page, advanceTurn(newGame(1)));
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue week 2' }).click();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Menu' });
  await menu.getByRole('textbox').fill('e2e-repeatable');
  await menu.getByRole('button', { name: 'New game', exact: true }).click();
  expect((await savedGame(page)).turn).toBe(2);
  await menu.getByRole('button', { name: 'Lose this run? Press again', exact: true }).click();
  await expect(menu).toHaveCount(0);
  expect(await savedGame(page)).toEqual(newGame('e2e-repeatable'));
});

test('resumes an incident paused, investigates, fixes it and acknowledges the postmortem', async ({ page, withoutRoom }) => {
  // Clock.runFor would also draw every WebGL animation frame, turning 13 virtual seconds into a minute.
  await withoutRoom();
  const incident = advanceTurn({ ...newGame(1), users: 4500, techDone: ['monitoring'] });
  expect(incident.incident?.type).toBe('app_overload');
  await seedSave(page, incident);
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue week 1' }).click();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  const panel = page.getByRole('region', { name: 'Incident', exact: true });
  const clock = panel.locator('.clock-time');
  await expect(clock).toHaveText('0:00');
  await page.clock.runFor(1200);
  await expect(clock).toHaveText('0:00');
  await panel.getByRole('button', { name: 'Servers', exact: true }).click();
  await page.getByRole('button', { name: 'Resume the incident clock' }).click();
  await page.clock.runFor(3200);
  await expect(panel.locator('.evidence')).toContainText('CPU 100%');
  await expect(panel.locator('.evidence')).toContainText('of capacity');
  await page.getByRole('button', { name: 'Pause the incident clock' }).click();
  const elapsed = (await savedGame(page)).incident!.elapsed;
  const pausedClock = await clock.textContent();
  await page.clock.runFor(1000);
  await expect(clock).toHaveText(pausedClock!);
  expect((await savedGame(page)).incident!.elapsed).toBe(elapsed);
  await panel.getByRole('button', { name: /^Add (a|\d+) server/ }).click();
  await page.getByRole('button', { name: '2×', exact: true }).click();
  await page.getByRole('button', { name: 'Resume the incident clock' }).click();
  await page.clock.runFor(8000);
  const report = page.getByRole('dialog');
  await expect(report).toContainText('Fixed');
  const reviewed = await savedGame(page);
  expect(reviewed.phase).toBe('review');
  expect(reviewed.postmortems.at(-1)?.outcome).toBe('resolved');
  await report.getByRole('button', { name: 'Continue', exact: true }).click();
  expect((await savedGame(page)).phase).toBe('management');
  expect((await savedGame(page)).turn).toBe(2);
});

test('plays music from the first click and remembers when it is turned off', async ({ page, withoutRoom }) => {
  await withoutRoom();
  const problems: string[] = [];
  page.on('console', message => { if (message.text().includes('music could not be prepared')) problems.push(message.text()); });
  await page.goto('/');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  const music = page.getByRole('button', { name: 'Music' });
  await expect(music).toHaveAttribute('aria-pressed', 'true');
  // Give the loops time to be synthesised; a failure would be reported on the console.
  await page.waitForTimeout(3000);
  expect(problems).toEqual([]);
  await music.click();
  await expect(music).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Music' })).toHaveAttribute('aria-pressed', 'false');
});
