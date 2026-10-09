import { describe, expect, it } from 'vitest';
import { isAllowedOrigin, parseAllowedOrigins } from '../src/cors.js';

describe('CORS origins', () => {
  const allowed = parseAllowedOrigins(
    'https://99-99-percent.vercel.app/, https://99-99-percent-*-myteam.vercel.app',
  );

  it('allows listed origins, ignoring a trailing slash in the setting', () => {
    expect(isAllowedOrigin('https://99-99-percent.vercel.app', allowed)).toBe(true);
  });

  it('allows our own preview URLs through a pattern', () => {
    expect(isAllowedOrigin('https://99-99-percent-abc123-myteam.vercel.app', allowed)).toBe(true);
    expect(isAllowedOrigin('https://99-99-percent-git-fe-map-myteam.vercel.app', allowed)).toBe(true);
  });

  it('rejects other Vercel sites and look-alikes', () => {
    expect(isAllowedOrigin('https://someone-else.vercel.app', allowed)).toBe(false);
    expect(isAllowedOrigin('https://99-99-percent-x-otherteam.vercel.app', allowed)).toBe(false);
    expect(isAllowedOrigin('https://99-99-percent.vercel.app.evil.com', allowed)).toBe(false);
    expect(isAllowedOrigin('https://99-99-percent.x.evil.com/-myteam.vercel.app', allowed)).toBe(false);
  });

  it('defaults to the local dev server', () => {
    const local = parseAllowedOrigins(undefined);
    expect(isAllowedOrigin('http://localhost:5173', local)).toBe(true);
    expect(isAllowedOrigin('https://99-99-percent.vercel.app', local)).toBe(false);
  });
});
