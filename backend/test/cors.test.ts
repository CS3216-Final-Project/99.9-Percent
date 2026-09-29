import { describe, expect, it } from 'vitest';
import { isAllowedOrigin, parseAllowedOrigins } from '../src/cors.js';

describe('CORS origins', () => {
  const allowed = parseAllowedOrigins(
    'https://lingoquest.vercel.app/, https://lingoquest-*-myteam.vercel.app',
  );

  it('allows listed origins, ignoring a trailing slash in the setting', () => {
    expect(isAllowedOrigin('https://lingoquest.vercel.app', allowed)).toBe(true);
  });

  it('allows our own preview URLs through a pattern', () => {
    expect(isAllowedOrigin('https://lingoquest-abc123-myteam.vercel.app', allowed)).toBe(true);
    expect(isAllowedOrigin('https://lingoquest-git-fe-map-myteam.vercel.app', allowed)).toBe(true);
  });

  it('rejects other Vercel sites and look-alikes', () => {
    expect(isAllowedOrigin('https://someone-else.vercel.app', allowed)).toBe(false);
    expect(isAllowedOrigin('https://lingoquest-x-otherteam.vercel.app', allowed)).toBe(false);
    expect(isAllowedOrigin('https://lingoquest.vercel.app.evil.com', allowed)).toBe(false);
    expect(isAllowedOrigin('https://lingoquest.x.evil.com/-myteam.vercel.app', allowed)).toBe(false);
  });

  it('defaults to the local dev server', () => {
    const local = parseAllowedOrigins(undefined);
    expect(isAllowedOrigin('http://localhost:5173', local)).toBe(true);
    expect(isAllowedOrigin('https://lingoquest.vercel.app', local)).toBe(false);
  });
});
