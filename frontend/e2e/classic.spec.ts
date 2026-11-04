import { setGameSpeed, openRoomControls } from "./fixtures";
import { test, expect, expectRoom, chooseAppProfile, savedClassicGame as savedGame, seedClassicSave as seedSave, unlockChallenge } from './fixtures';
import { advanceTurn, BALANCE, newLegacyGame as newGame } from '../src/sim';
import { balanced, runBot } from '../src/sim/__tests__/bots';

test.beforeEach(async ({ page }) => {
  await unlockChallenge(page);
  await page.addInitScript(() => localStorage.setItem('nn.mode.v1', 'classic'));
});

test('completes the first-week tutorial on the basic look, purchases equipment and resumes after reload', async ({ page }) => {
  // This journey renders the live room through the whole tutorial and again after reload. SwiftShader can spend
  // most of the default budget drawing those transitions, so give the interaction assertions CPU headroom.
  test.setTimeout(120_000);
  // CI draws with SwiftShader, which the room detects as software rendering, so no HD asset may be downloaded.
  const hd: string[] = [];
  const crew = new Set<string>();
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/textures/') || url.includes('/models/polyhaven/')) hd.push(url);
  });
  page.on('response', response => { if (response.url().includes('/models/creatures/') && response.ok()) crew.add(response.url()); });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Challenge Mode', exact: true }).click();
  await expectRoom(page);
  // The monster crew works at every level of detail.
  await expect.poll(() => crew.size).toBe(14);
  await expect(page.getByRole('dialog', { name: /Tutorial, step 1/ })).toBeVisible();
  await page.getByRole('button', { name: 'Servers', exact: true }).click();
  const reveal = page.getByRole('dialog', { name: 'Servers', exact: true });
  await expect(reveal).toBeVisible();
  await reveal.getByRole('button', { name: 'Return to room' }).click();
  await page.getByRole('button', { name: /Add server/ }).click();
  await expect(page.getByRole('dialog', { name: /Tutorial, step 2/ })).toBeVisible();
  await page.getByRole('button', { name: 'Tech', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Tech tree' }).locator('.node')).toHaveCount(9);
  // All nine technologies fit next to the detail panel.
  expect(await page.getByRole('region', { name: 'Tech tree' }).locator('[data-tech]').evaluateAll(nodes => nodes.every(node => {
    const box = node.getBoundingClientRect(), viewport = node.closest('.tree-scroll')!.getBoundingClientRect();
    return box.left >= viewport.left && box.right <= viewport.right;
  })), 'All nine technologies fit beside the detail panel on desktop').toBe(true);
  // The top bar stays above the tree, so the logo, cash and settings remain in reach.
  const topbar = page.locator('.topbar');
  await expect(topbar).toBeVisible();
  await expect(topbar.locator('.brand-mark')).toHaveText('99.99%');
  await expect(topbar).toContainText('Cash');
  await expect(topbar.getByRole('button', { name: 'Menu', exact: true })).toBeInViewport({ ratio: 1 });
  const topbarBox = (await topbar.boundingBox())!;
  expect((await page.getByRole('region', { name: 'Tech tree' }).boundingBox())!.y).toBeCloseTo(topbarBox.y + topbarBox.height, 0);
  await page.getByRole('button', { name: 'Scale Up: Available' }).click();
  await page.getByRole('button', { name: /^Start/ }).click();
  await expect(page.getByRole('dialog', { name: /Tutorial, step 3/ })).toBeVisible();
  await page.getByRole('button', { name: 'Growth', exact: true }).click();
  const growthReveal = page.getByRole('dialog', { name: 'Growth', exact: true });
  await expect(growthReveal).toBeVisible();
  await growthReveal.getByRole('button', { name: 'Return to room' }).click();
  await page.getByRole('button', { name: /^Launch/ }).first().click();
  await expect(page.getByRole('dialog', { name: /Tutorial, step 4/ })).toBeVisible();
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  // Playing the week is the last step: the guide closes by itself, and the company says what it builds.
  await expect(page.getByRole('dialog', { name: /Tutorial, step/ })).toBeHidden();
  const picker = page.getByRole('dialog', { name: 'What are you building?' });
  await expect(picker.getByRole('radio')).toHaveCount(4);
  await expect(picker.getByRole('button', { name: 'Start building', exact: true })).toBeDisabled();
  await page.screenshot({ path: test.info().outputPath('app-profile-picker.png') });
  // Weeks wait for the choice.
  await page.keyboard.press('n');
  expect((await savedGame(page)).turn).toBe(2);
  // Tab keeps to the cards, the way a modal should, and reaches Start building once one is chosen.
  await page.keyboard.press('Tab');
  await expect(picker.getByRole('radio', { name: 'Social media' })).toBeFocused();
  await picker.getByRole('radio', { name: 'Online game' }).check();
  await page.keyboard.press('Tab');
  await expect(picker.getByRole('button', { name: 'Start building', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(picker.getByRole('radio', { name: 'Online game' })).toBeFocused();
  await page.screenshot({ path: test.info().outputPath('app-profile-picked.png') });
  await picker.getByRole('button', { name: 'Start building', exact: true }).click();
  await expect(picker).toBeHidden();
  // The choice stays in the top bar, where Guided Mode keeps Hint.
  const yourApp = page.locator('.topbar').getByRole('button', { name: 'Your app: Online game' });
  await yourApp.click();
  await expect(page.getByRole('dialog', { name: 'Your app' })).toContainText('Players leave the moment it lags');
  await page.screenshot({ path: test.info().outputPath('app-profile-card.png') });
  await page.keyboard.press('Escape');
  const before = await savedGame(page);
  expect(before.turn).toBe(2);
  expect(before.appProfile).toBe('gaming');
  expect(before.infra.appHosts).toHaveLength(2);
  expect(before.totals.promosRun).toBe(1);
  expect(before.tasks.some(task => task.techId === 'larger_servers') || before.releases.some(release => release.techId === 'larger_servers') || before.techDone.includes('larger_servers')).toBe(true);
  await page.reload();
  await page.getByRole('button', { name: 'Continue week 2' }).click();
  // The tutorial left the view on the office floor, which is the floor the reload restores.
  await openRoomControls(page);
  await page.getByRole('button', { name: 'Server floor', exact: true }).click();
  await expectRoom(page);
  expect(await savedGame(page)).toEqual(before);
  await expect(page.getByRole('dialog', { name: /Tutorial/ })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'What are you building?' })).toHaveCount(0);
  await expect(page.locator('.topbar').getByRole('button', { name: 'Your app: Online game' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(hd).toEqual([]);
});

test('keeps the game playable when the furniture and creature models cannot be downloaded', async ({ page }) => {
  await page.route('**/models/**', route => route.abort());
  const skipped = page.waitForEvent('console', message => message.text().includes('Furniture models failed to load'));
  const crew = page.waitForEvent('console', message => message.text().includes('Creature models failed to load'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Challenge Mode', exact: true }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await chooseAppProfile(page);
  await skipped;
  await crew;
  await expectRoom(page);
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  expect((await savedGame(page)).turn).toBe(2);
  await expectRoom(page);
});

test('draws the photo-scanned surfaces and furniture when HD detail is forced', async ({ page }) => {
  // Forcing HD on SwiftShader draws physically based materials and the detailed models on the CPU,
  // which took up to 30 seconds locally, so it gets the same headroom as other slow journeys.
  test.setTimeout(120_000);
  const textures = new Set<string>();
  const city = new Set<string>();
  const furniture = new Set<string>();
  // The city's ground and roofs have photo sets of their own, apart from the office's.
  const outside = /\/textures\/(asphalt|lawn|pavement|gravel|roof-tiles|bark|leaves)\//;
  page.on('response', response => {
    if (!response.ok()) return;
    const path = new URL(response.url()).pathname;
    if (outside.test(path)) city.add(path);
    else if (path.includes('/textures/')) textures.add(path);
    if (path.includes('/models/polyhaven/')) furniture.add(path);
  });
  await page.goto('/?graphics=hd');
  await page.getByRole('button', { name: 'Start Challenge Mode', exact: true }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await chooseAppProfile(page);
  // Compiling the HD shaders in software can block the page for longer than the default 10 seconds.
  await expectRoom(page, 30_000);
  // Five surfaces, each with a colour, a normal and a roughness map, and nine photo-scanned models.
  await expect.poll(() => textures.size).toBe(15);
  await expect.poll(() => furniture.size).toBe(9);
  // Seven surfaces outside, each with a colour and a normal map.
  await expect.poll(() => city.size).toBe(14);
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
  await page.getByRole('button', { name: 'Start Challenge Mode', exact: true }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await chooseAppProfile(page);
  await surfaces;
  await furniture;
  await expectRoom(page, 30_000);
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  expect((await savedGame(page)).turn).toBe(2);
  await expectRoom(page);
});

test('recovers from a corrupt save through the playable first-run flow', async ({ page, withoutRoom }) => {
  await withoutRoom();
  await page.addInitScript(() => localStorage.setItem('nn.classic.save.v1', '{'));
  await page.goto('/');
  await expect(page.getByRole('alert')).toHaveText('Saved Challenge Mode run was unreadable. Started a new one.');
  await page.getByRole('button', { name: 'Start Challenge Mode', exact: true }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await chooseAppProfile(page);
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
  await menu.getByRole('tab', { name: 'Saves' }).click();
  await menu.getByRole('textbox').fill('e2e-repeatable');
  await menu.getByRole('button', { name: 'New game', exact: true }).click();
  expect((await savedGame(page)).turn).toBe(2);
  await menu.getByRole('button', { name: 'Lose this run? Press again', exact: true }).click();
  await expect(menu).toHaveCount(0);
  expect(await savedGame(page)).toEqual(newGame('e2e-repeatable'));
});

test('resumes an incident paused, investigates, fixes it and acknowledges the postmortem', async ({ page, withoutRoom , installClock}) => {
 await installClock();
  // Clock.runFor would also draw every WebGL animation frame, turning 13 virtual seconds into a minute.
  await withoutRoom();
  const incident = advanceTurn({ ...newGame(1), users: 4500, techDone: ['monitoring'] });
  expect(incident.incident?.type).toBe('app_overload');
  await seedSave(page, incident);

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
  await setGameSpeed(page,2);
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

test('plays sound from the first click, follows the menu sliders and remembers a mute', async ({ page, withoutRoom }) => {
  await withoutRoom();
  const problems: string[] = [];
  page.on('console', message => { if (/could not be (prepared|played)/.test(message.text())) problems.push(message.text()); });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Challenge Mode', exact: true }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await chooseAppProfile(page);
  const mute = page.getByRole('button', { name: 'Mute sound' });
  await expect(mute).toHaveAttribute('aria-pressed', 'false');
  // Give the loops time to be synthesised; a failure would be reported on the console.
  await page.waitForTimeout(3000);
  expect(problems).toEqual([]);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Menu' });
  await menu.getByRole('tab', { name: 'Sound' }).click();
  const effects = menu.getByRole('slider', { name: 'Sound effects' });
  await effects.fill('40');
  await expect(effects).toHaveAttribute('aria-valuetext', '40%');
  await effects.press('ArrowRight');
  await expect(effects).toHaveAttribute('aria-valuetext', '45%');
  await expect(menu).toBeVisible();
  await menu.getByRole('tab', { name: 'Run', exact: true }).click();
  await menu.getByRole('button', { name: 'Resume', exact: true }).click();
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  expect(problems).toEqual([]);
  await page.reload();
  await page.getByRole('button', { name: 'Start Challenge Mode', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mute sound' })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nn.audio.v1')!))).toEqual({ music: 80, effects: 45, muted: true, captions: true });
});

test('keeps a company going past its Series A with no deadline, and resumes it after a reload', async ({ page, withoutRoom }) => {
  await withoutRoom();
  const won = runBot(BALANCE.introSeed, balanced, 'expert').state;
  expect(won).toMatchObject({ phase: 'ended', outcome: 'won' });
  await seedSave(page, won);
  await page.goto('/');
  const card = page.getByRole('region', { name: 'Choose how you want to play' }).getByRole('region', { name: 'Challenge Mode' });
  await expect(card).toContainText('Series A secured');
  await card.getByRole('button', { name: 'See your results', exact: true }).click();
  await expectRoom(page);

  const report = page.getByRole('dialog', { name: 'Series A secured' });
  const keep = report.getByRole('button', { name: 'Keep playing', exact: true });
  await expect(keep).toBeFocused();
  await expect(report.getByRole('button', { name: 'Play again', exact: true })).toBeVisible();
  await keep.click();
  await expect(report).toBeHidden();

  const time = page.getByRole('group', { name: 'Time' });
  await expect(time).toContainText(`Week ${won.turn}`);
  await expect(time).not.toContainText(`/${BALANCE.maxTurns}`);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const glance = page.getByRole('dialog', { name: 'Menu' }).getByRole('region', { name: 'At a glance' });
  // The week has no total once there is no deadline.
  await expect(glance.getByRole('definition').first()).toHaveText(String(won.turn));
  await page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name: 'Resume', exact: true }).click();
  expect(await savedGame(page)).toMatchObject({ phase: 'management', outcome: null, seriesAWeek: won.totals.weeks });

  // The growing company outgrows its database in its first week past the Series A, so play carries on as normal.
  await time.getByRole('button', { name: 'Next week', exact: true }).click();
  await expect(page.getByRole('button', { name: /incident clock/ })).toBeVisible();
  expect(await savedGame(page)).toMatchObject({ phase: 'incident', seriesAWeek: won.totals.weeks });

  await page.reload();
  await expect(card).toContainText(`Week ${won.turn}: Series A secured`);
  await card.getByRole('button', { name: `Continue week ${won.turn}`, exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume the incident clock' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Series A secured' })).toHaveCount(0);
});
