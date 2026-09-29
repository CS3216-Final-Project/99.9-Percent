import { afterEach, describe, expect, it, vi } from 'vitest';
import { getHealth } from './api.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getHealth', () => {
  it('returns the health response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: 'ok', time: 't' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getHealth()).resolves.toEqual({ status: 'ok', time: 't' });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/health$/));
  });

  it('throws when the API returns an error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    await expect(getHealth()).rejects.toThrow('API returned 503');
  });
});
