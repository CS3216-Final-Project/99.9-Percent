import { test, expect, savedClassicGame } from './fixtures';

const board = {
  top: [
    { name: 'Ada', score: 91, grade: 'S', weeks: 14, users: 52_000, outcome: 'won', createdAt: '2026-11-12T07:00:00Z' },
    { name: 'Grace', score: 60, grade: 'B', weeks: 26, users: 30_000, outcome: 'deadline', createdAt: '2026-11-12T07:05:00Z' },
  ],
  recent: [{ name: 'Grace', score: 60, grade: 'B', weeks: 26, users: 30_000, outcome: 'deadline', createdAt: '2026-11-12T07:05:00Z' }],
  total: 2,
  generatedAt: '2026-11-12T07:06:00Z',
};

test('booth play: a named visitor plays a fresh Challenge company, posts once and hands over', async ({ page, withoutRoom }) => {
  await withoutRoom();
  const posts: Record<string, unknown>[] = [];
  await page.route('**/api/leaderboard', async route => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: board });
    const body = route.request().postDataJSON() as Record<string, unknown>;
    posts.push(body);
    return route.fulfill({ status: 201, json: { id: body.id, rank: 3, total: 5 } });
  });
  await page.goto('/steps');
  const entry = page.getByRole('dialog', { name: 'Can you keep the startup online?' });
  await expect(entry).toBeVisible();
  await entry.getByLabel('Your name on the leaderboard').fill('  Booth   Visitor ');
  await entry.getByRole('button', { name: 'Start playing' }).click();
  await expect(entry).toBeHidden();
  // Challenge Mode is still locked on this profile, yet the booth starts it with the first-week walkthrough.
  await expect(page.getByRole('dialog', { name: /Tutorial, step 1/ })).toBeVisible();
  const chip = page.getByRole('complementary', { name: 'Leaderboard' });
  await expect(chip).toContainText('Booth Visitor');
  await expect(chip).toContainText('pts');
  // The chip never covers the top bar's metrics.
  const bar = (await page.locator('.topbar').boundingBox())!;
  expect((await chip.boundingBox())!.y).toBeGreaterThanOrEqual(bar.y + bar.height);

  // A reload before posting boots this locked device into Guided Mode; the visitor continues the same company.
  const seed = (await savedClassicGame(page)).seed;
  await page.reload();
  await page.getByRole('complementary', { name: 'Leaderboard' }).getByRole('button', { name: 'Continue my run' }).click();
  await expect(chip).toContainText('pts');
  await expect(chip.getByRole('button', { name: 'Finish & post' })).toBeVisible();
  expect((await savedClassicGame(page)).seed).toBe(seed);
  expect(posts).toHaveLength(0);

  await chip.getByRole('button', { name: 'Finish & post' }).click();
  await expect(chip.getByRole('status')).toContainText('#3 of 5');
  expect(posts).toHaveLength(1);
  expect(posts[0]).toMatchObject({ name: 'Booth Visitor', outcome: 'unfinished', weeks: expect.any(Number) });
  // A reload keeps the visitor's place until the next player takes over.
  await page.reload();
  await expect(page.getByRole('complementary', { name: 'Leaderboard' }).getByRole('status')).toContainText('#3 of 5');
  await page.getByRole('button', { name: 'Next player' }).click();
  await expect(page.getByRole('dialog', { name: 'Can you keep the startup online?' })).toBeVisible();
  expect(posts).toHaveLength(1);
});

test('booth board: the big screen lists the top scores and how to play', async ({ page }) => {
  await page.route('**/api/leaderboard', route => route.fulfill({ json: board }));
  await page.goto('/steps/board');
  const top = page.getByRole('region', { name: 'Top scores' });
  await expect(top.getByRole('listitem')).toHaveCount(2);
  await expect(top.getByRole('listitem').first()).toContainText('Ada');
  await expect(page.getByText(/Play at .*\/steps/)).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
});
