import { afterEach, expect, it, vi } from 'vitest';
import { sendFeedback } from './feedback';

const value = { id: '819251a5-e7bb-4e98-8c99-758bfc36b723', message: 'Useful evidence', mode: 'classic' as const };
afterEach(() => { vi.unstubAllGlobals(); });

it('sends feedback without account cookies and requires the saved row confirmation', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: value.id }), { status: 201 }));
  vi.stubGlobal('fetch', fetch);
  expect(await sendFeedback(value, new AbortController().signal)).toEqual({ id: value.id });
  expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/feedback$/), expect.objectContaining({
    method: 'POST', credentials: 'omit', body: JSON.stringify(value),
  }));
});

it('does not confirm failed writes or malformed acknowledgements', async () => {
  for (const response of [
    new Response('{}', { status: 503 }),
    new Response('{}', { status: 201 }),
    new Response(JSON.stringify({ id: 'different' }), { status: 201 }),
  ]) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    await expect(sendFeedback(value, new AbortController().signal)).rejects.toThrow();
  }
});
