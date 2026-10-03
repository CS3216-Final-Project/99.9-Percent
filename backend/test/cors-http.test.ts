import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('CORS_ORIGINS', 'https://99-99-percent-web.vercel.app,https://frontend-*-hoo-di-hengs-projects.vercel.app');
});
afterEach(() => vi.unstubAllEnvs());

async function api() { return (await import('../src/app.js')).default; }

describe('browser CORS contract', () => {
  it.each([
    'https://99-99-percent-web.vercel.app',
    'https://frontend-feature-hoo-di-hengs-projects.vercel.app',
  ])('allows the configured origin %s', async origin => {
    const res = await request(await api()).get('/api/health').set('Origin', origin);
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
    expect(res.headers.vary).toContain('Origin');
  });

  it.each(['https://evil.example', 'https://99-99-percent-web.vercel.app.evil.example'])('withholds CORS headers from %s', async origin => {
    const res = await request(await api()).get('/api/health').set('Origin', origin);
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows a browser JSON POST preflight from the production frontend', async () => {
    const origin = 'https://99-99-percent-web.vercel.app';
    const res = await request(await api()).options('/api/dialogue')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
    expect(res.headers['access-control-allow-methods']).toContain('POST');
    expect(res.headers['access-control-allow-headers']).toBe('content-type');
  });
});
