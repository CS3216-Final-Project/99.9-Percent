import { afterEach, expect, it, vi } from 'vitest';
import { fetchBoard, postScore } from './leaderboard';

const value = { id: '5d0c2b9e-3f6a-4b8e-9c1d-2a7f0e4b6c11', name: 'Ada', score: 72, grade: 'B' as const, weeks: 18, users: 51_000, outcome: 'won' as const };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
afterEach(() => { vi.unstubAllGlobals(); });

it('posts a score without cookies and returns the confirmed place', async () => {
  const fetch = vi.fn().mockResolvedValue(json({ id: value.id, rank: 2, total: 9 }, 201));
  vi.stubGlobal('fetch', fetch);
  expect(await postScore(value)).toEqual({ id: value.id, rank: 2, total: 9 });
  expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/leaderboard$/), expect.objectContaining({
    method: 'POST', credentials: 'omit', body: JSON.stringify(value),
  }));
});

it('does not confirm failed posts or malformed acknowledgements', async () => {
  for (const response of [json({}, 503), json({ id: value.id }, 201), json({ id: 'other', rank: 1, total: 1 }, 201)]) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    await expect(postScore(value)).rejects.toThrow();
  }
});

it('reads the board and rejects unavailable or malformed boards', async () => {
  const board = { top: [], recent: [], total: 0, generatedAt: '2026-11-12T07:00:00Z' };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(board)));
  expect(await fetchBoard()).toEqual(board);
  for (const response of [json({}, 503), json({ top: 'x', recent: [], total: 0 }), json({ top: [], recent: [] })]) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    await expect(fetchBoard()).rejects.toThrow();
  }
});
